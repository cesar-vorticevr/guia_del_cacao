-- Guía del Cacao — comentarios en eventos y noticias
--
-- Hasta ahora las publicaciones de un negocio eran de una sola via: el negocio
-- hablaba y nadie contestaba. Esto abre la conversacion, con tres reglas:
--
--   * Un comentario por persona y por publicacion. No es un chat: es "que me
--     parece esto". Quien quiera decir mas, edita el suyo.
--   * Se puede editar y borrar el propio, siempre.
--   * El negocio no borra lo que le dijeron: lo OCULTA. La diferencia importa,
--     porque un comentario oculto lo sigue viendo quien lo escribio. Borrar en
--     silencio se siente como censura y ademas confunde: la persona ve que su
--     comentario desaparecio y vuelve a escribirlo.

-- ---------------------------------------------------------------------------
-- La tabla
-- ---------------------------------------------------------------------------

-- Dos llaves foraneas anulables en vez de un id generico con una columna de
-- tipo: asi el borrado en cascada lo hace Postgres cuando se borra el evento o
-- la noticia, en vez de quedar filas apuntando a algo que ya no existe.
create table public.comentarios_publicacion (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  evento_id uuid references public.eventos (id) on delete cascade,
  noticia_id uuid references public.noticias (id) on delete cascade,
  texto text not null check (length(btrim(texto)) between 2 and 1000),
  oculto boolean not null default false,
  fecha timestamptz not null default now(),
  fecha_edicion timestamptz,
  constraint comentario_de_una_sola_publicacion check (
    (evento_id is not null and noticia_id is null)
    or (evento_id is null and noticia_id is not null)
  )
);

-- La regla de "uno por publicacion", impuesta por la base y no por la pantalla.
-- Van dos indices parciales porque la llave cambia segun de que cuelgue.
create unique index comentario_unico_por_evento
  on public.comentarios_publicacion (usuario_id, evento_id)
  where evento_id is not null;

create unique index comentario_unico_por_noticia
  on public.comentarios_publicacion (usuario_id, noticia_id)
  where noticia_id is not null;

create index comentarios_de_evento_idx
  on public.comentarios_publicacion (evento_id, fecha desc)
  where evento_id is not null;

create index comentarios_de_noticia_idx
  on public.comentarios_publicacion (noticia_id, fecha desc)
  where noticia_id is not null;

-- ---------------------------------------------------------------------------
-- Quien es el dueno de la publicacion comentada
-- ---------------------------------------------------------------------------

-- Se consulta en linea dentro de las politicas, asi que va como security
-- definer: preguntarle a eventos/noticias desde una politica de otra tabla sin
-- esto encadena RLS con RLS y termina en recursion.
create or replace function public.posee_publicacion(p_evento uuid, p_noticia uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select case
    when p_evento is not null then
      exists (select 1 from public.eventos e
               where e.id = p_evento and public.posee_sucursal(e.sucursal_id))
    when p_noticia is not null then
      exists (select 1 from public.noticias n
               where n.id = p_noticia and public.posee_sucursal(n.sucursal_id))
    else false
  end;
$fn$;

-- Lo mismo, pero para saber si la publicacion es de un micrositio publicado:
-- comentar el evento de un borrador seria comentar algo que no existe todavia.
create or replace function public.publicacion_visible(p_evento uuid, p_noticia uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select case
    when p_evento is not null then
      exists (select 1 from public.eventos e
               where e.id = p_evento and public.sucursal_publicada(e.sucursal_id))
    when p_noticia is not null then
      exists (select 1 from public.noticias n
               where n.id = p_noticia and public.sucursal_publicada(n.sucursal_id))
    else false
  end;
$fn$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.comentarios_publicacion enable row level security;

grant select on public.comentarios_publicacion to anon, authenticated;
grant insert, update, delete on public.comentarios_publicacion to authenticated;

-- Un comentario oculto lo sigue viendo quien lo escribio. Para el resto del
-- mundo no existe: ni el numero de comentarios lo cuenta.
create policy comentarios_publicacion_lectura on public.comentarios_publicacion
  for select using (
    (not oculto and public.publicacion_visible(evento_id, noticia_id))
    or usuario_id = (select auth.uid())
    or public.posee_publicacion(evento_id, noticia_id)
    or public.es_admin()
  );

create policy comentarios_publicacion_crea on public.comentarios_publicacion
  for insert with check (
    usuario_id = (select auth.uid())
    and public.es_cliente()
    and public.publicacion_visible(evento_id, noticia_id)
  );

-- El autor edita su texto; el negocio solo puede ocultar. El reparto exacto de
-- columnas lo impone el trigger de abajo, igual que en las resenas.
create policy comentarios_publicacion_edita on public.comentarios_publicacion
  for update using (
    usuario_id = (select auth.uid())
    or public.posee_publicacion(evento_id, noticia_id)
    or public.es_admin()
  )
  with check (
    usuario_id = (select auth.uid())
    or public.posee_publicacion(evento_id, noticia_id)
    or public.es_admin()
  );

-- Borrar es cosa del autor. El negocio oculta, no borra.
create policy comentarios_publicacion_borra on public.comentarios_publicacion
  for delete using (
    usuario_id = (select auth.uid())
    or public.es_admin()
  );

create or replace function public.proteger_comentario_publicacion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  soy_el_autor boolean := new.usuario_id = (select auth.uid());
begin
  if (select auth.uid()) is not null
     and not soy_el_autor
     and not public.es_admin()
     and new.texto is distinct from old.texto
  then
    raise exception 'El negocio puede ocultar un comentario, no reescribirlo';
  end if;

  -- Quien escribio no puede desocultarse a si mismo: si pudiera, ocultar no
  -- serviria de nada.
  if soy_el_autor
     and not public.es_admin()
     and new.oculto is distinct from old.oculto
  then
    raise exception 'Solo el negocio o un administrador pueden ocultar o mostrar un comentario';
  end if;

  if new.texto is distinct from old.texto then
    new.fecha_edicion := now();
  end if;

  return new;
end;
$fn$;

create trigger al_actualizar_comentario_publicacion
  before update on public.comentarios_publicacion
  for each row execute function public.proteger_comentario_publicacion();
