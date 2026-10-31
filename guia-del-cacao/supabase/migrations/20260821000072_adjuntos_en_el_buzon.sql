-- Adjuntos en el buzon: una imagen, un video o un PDF por mensaje.
--
-- Es lo que pide un pedido (000071): la foto del producto, el comprobante de
-- la transferencia, la ficha en PDF. Tres reglas:
--
-- 1. **El bucket es privado.** Un comprobante trae nombres y cuentas. Sube y
--    lee solo quien es parte de la conversacion (la primera carpeta de la
--    ruta), y el administrador lee para moderar. Las URL son firmadas.
-- 2. **El tamano y el tipo los dice el archivo guardado, no el formulario.**
--    El trigger los lee de `storage.objects`: imagen 5 MB, PDF 10 MB, video
--    20 MB (`tope_de_adjunto`, y `TOPES_DE_ADJUNTO` en `lib/buzon/adjuntos.ts`;
--    si cambia uno, cambian los dos). El bucket pone el techo de 20 MB.
-- 3. **No se borra**, como los mensajes: sin politica de UPDATE ni DELETE en
--    el bucket.
--
-- El archivo sube directo del navegador al bucket: Vercel corta los cuerpos
-- en 4.5 MB y un video pesa mas (como las experiencias, 000066).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'buzon',
  'buzon',
  false,
  20971520,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif',
        'video/mp4', 'video/webm', 'video/quicktime', 'application/pdf']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

/** Si quien mira es parte de la conversacion de la primera carpeta de esta ruta. */
create or replace function public.ruta_de_mi_conversacion(ruta text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  carpeta text := (storage.foldername(ruta))[1];
begin
  if carpeta is null or carpeta !~* '^[0-9a-f-]{36}$' then
    return false;
  end if;

  return public.en_conversacion(carpeta::uuid);
end;
$$;

revoke all on function public.ruta_de_mi_conversacion(text) from public, anon;
grant execute on function public.ruta_de_mi_conversacion(text) to authenticated;

drop policy if exists "buzon lectura de las partes" on storage.objects;
create policy "buzon lectura de las partes"
  on storage.objects for select to authenticated
  using (bucket_id = 'buzon' and (public.ruta_de_mi_conversacion(name) or public.es_admin()));

drop policy if exists "buzon alta de las partes" on storage.objects;
create policy "buzon alta de las partes"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'buzon' and public.ruta_de_mi_conversacion(name));

-- ---------------------------------------------------------------- mensajes
alter table public.mensajes
  add column if not exists adjunto        text,
  add column if not exists adjunto_tipo   text check (adjunto_tipo in ('imagen', 'video', 'pdf')),
  add column if not exists adjunto_nombre text check (char_length(adjunto_nombre) <= 120),
  add column if not exists adjunto_bytes  integer;

comment on column public.mensajes.adjunto is
  'Ruta en el bucket privado `buzon`: {conversacion}/{archivo}. Tipo y tamano los pone el trigger desde storage. Ver migracion 000072.';

-- Un archivo, un mensaje: volver a mandar la misma ruta seria colgar en otra
-- conversacion lo que se subio para esta.
create unique index if not exists mensajes_adjunto_idx
  on public.mensajes (adjunto) where adjunto is not null;

-- Con adjunto, el texto puede ir vacio: una foto ya dice algo.
alter table public.mensajes drop constraint if exists mensajes_texto_check;
alter table public.mensajes
  add constraint mensajes_texto_check
  check (
    char_length(btrim(texto)) <= 2000
    and (char_length(btrim(texto)) >= 1 or adjunto is not null)
  );

/** Hasta cuanto pesa cada tipo de adjunto, en bytes. */
create or replace function public.tope_de_adjunto(p_tipo text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_tipo
    when 'imagen' then 5 * 1024 * 1024
    when 'pdf'    then 10 * 1024 * 1024
    when 'video'  then 20 * 1024 * 1024
  end;
$$;

create or replace function public.revisar_adjunto_de_mensaje()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  archivo record;
  tipo text;
begin
  -- Tipo y tamano no se aceptan de fuera: salen del archivo.
  new.adjunto_tipo := null;
  new.adjunto_bytes := null;

  if new.adjunto is null then
    new.adjunto_nombre := null;
    return new;
  end if;

  if (storage.foldername(new.adjunto))[1] is distinct from new.conversacion_id::text then
    raise exception 'Ese archivo no es de esta conversación.';
  end if;

  select o.metadata, o.owner_id into archivo
    from storage.objects o
   where o.bucket_id = 'buzon' and o.name = new.adjunto;

  if not found then
    raise exception 'El archivo no terminó de subir. Vuelve a adjuntarlo.';
  end if;

  if archivo.owner_id is distinct from new.autor_id::text then
    raise exception 'Ese archivo no lo subiste tú.';
  end if;

  tipo := case
    when archivo.metadata ->> 'mimetype' like 'image/%' then 'imagen'
    when archivo.metadata ->> 'mimetype' like 'video/%' then 'video'
    when archivo.metadata ->> 'mimetype' = 'application/pdf' then 'pdf'
  end;

  if tipo is null then
    raise exception 'Solo se mandan imágenes, videos o PDF.';
  end if;

  new.adjunto_tipo := tipo;
  new.adjunto_bytes := (archivo.metadata ->> 'size')::integer;

  if new.adjunto_bytes > public.tope_de_adjunto(tipo) then
    raise exception 'Ese archivo pesa más de lo permitido: imagen 5 MB, PDF 10 MB, video 20 MB.';
  end if;

  new.adjunto_nombre := left(nullif(btrim(coalesce(new.adjunto_nombre, '')), ''), 120);
  return new;
end;
$$;

drop trigger if exists al_escribir_mensaje_0_adjunto on public.mensajes;
create trigger al_escribir_mensaje_0_adjunto
  before insert on public.mensajes
  for each row execute function public.revisar_adjunto_de_mensaje();

-- El aviso de mensaje nuevo dice «te mandó un archivo» cuando no hay texto.
-- Igual que en 000069, salvo el detalle.
create or replace function public.despues_de_escribir_mensaje()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  destino uuid;
  quiere boolean;
  quien text;
begin
  update public.conversaciones
     set ultimo_mensaje_en = new.creado_en
   where id = new.conversacion_id
  returning case when iniciada_por = new.autor_id then para else iniciada_por end
    into destino;

  insert into public.lecturas_conversacion (conversacion_id, usuario_id, leida_en)
  values (new.conversacion_id, new.autor_id, new.creado_en)
  on conflict (conversacion_id, usuario_id) do update set leida_en = excluded.leida_en;

  select p.avisar_mensajes into quiere from public.perfiles p where p.id = destino;

  if coalesce(quiere, false) and not exists (
    select 1 from public.notificaciones n
     where n.perfil_id = destino
       and n.tipo = 'mensaje'
       and n.enlace = '/buzon/' || new.conversacion_id
       and not n.leida
  ) then
    select b.nombre into quien from public.cuenta_en_buzon(new.autor_id) b;

    insert into public.notificaciones (perfil_id, tipo, titulo, detalle, enlace)
    values (
      destino,
      'mensaje',
      coalesce(quien, 'Alguien') || ' te escribió',
      coalesce(nullif(left(new.texto, 140), ''), 'Te mandó un archivo'),
      '/buzon/' || new.conversacion_id
    );
  end if;

  return new;
end;
$$;
