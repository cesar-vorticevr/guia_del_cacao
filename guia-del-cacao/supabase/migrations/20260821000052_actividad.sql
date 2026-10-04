-- Medir lo que pasa en la guia: visitas, busquedas y cada boton de contacto.
--
-- Es lo que sostiene el modelo de la migracion 000051. Aparecer es gratis y se
-- paga por lo que el Basico no tiene; para que alguien pague hay que poder
-- decirle "en diciembre tu pagina tuvo 340 visitas y 28 personas te
-- escribieron". Y es el reporte que se le entrega a la Secretaria de Turismo.
--
-- **Solo conteos.** No se guarda quien hizo cada cosa: ni usuario, ni IP, ni
-- un identificador del navegador, ni cookies. Una fila dice "alguien pulso
-- WhatsApp en esta sucursal a esta hora", y nada mas. Asi lo dice el aviso de
-- privacidad, y si esta tabla gana una columna que identifique a alguien, el
-- aviso tiene que cambiar el mismo dia.
--
-- Lo que ya vive en su propia tabla (resenas, calificaciones, favoritos,
-- cuentas, eventos) no se copia aqui: se cuenta donde esta.

create table if not exists public.actividad (
  id           bigint generated always as identity primary key,
  tipo         text not null check (tipo in (
                 'vista_pagina',      -- detalle: la ruta
                 'vista_micrositio',
                 'vista_evento',
                 'busqueda',          -- detalle: lo que se escribio
                 'filtro',            -- detalle: 'estado:Tabasco', 'categoria:3'
                 'whatsapp',
                 'telefono',
                 'correo',
                 'mapa',
                 'red',               -- detalle: facebook, instagram, ...
                 'compartir',
                 'catalogo_pdf'
               )),
  sucursal_id  uuid references public.sucursales (id) on delete cascade,
  evento_id    uuid references public.eventos (id) on delete cascade,
  detalle      text check (length(detalle) <= 120),
  ocurrio_en   timestamptz not null default now()
);

comment on table public.actividad is
  'Conteos anonimos de visitas, busquedas y botones de contacto. Sin datos de quien. Ver migracion 000052.';

create index if not exists actividad_por_tipo on public.actividad (tipo, ocurrio_en);
create index if not exists actividad_por_sucursal on public.actividad (sucursal_id, tipo, ocurrio_en)
  where sucursal_id is not null;

alter table public.actividad enable row level security;

-- Leer, solo el administrador. Escribir, nadie directo: por `anotar`.
drop policy if exists actividad_admin on public.actividad;
create policy actividad_admin on public.actividad
  for select using (public.es_admin());

-- ---------------------------------------------------------------------------
-- Anotar
-- ---------------------------------------------------------------------------
--
-- No cuenta al propio negocio mirando su pagina ni al administrador: inflarian
-- justo los numeros que se le ensenan al negocio para que decida si paga.
create or replace function public.anotar(
  p_tipo text,
  p_sucursal uuid default null,
  p_evento uuid default null,
  p_detalle text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.es_admin() and auth.uid() is not null then
    return;
  end if;

  -- Un evento es de una sucursal: su visita cuenta tambien para ese negocio.
  if p_evento is not null and p_sucursal is null then
    select sucursal_id into p_sucursal from public.eventos where id = p_evento;
  end if;

  if p_sucursal is not null and auth.uid() is not null
     and public.posee_sucursal(p_sucursal) then
    return;
  end if;

  if p_sucursal is not null
     and not exists (select 1 from public.sucursales where id = p_sucursal) then
    return;
  end if;

  if p_evento is not null
     and not exists (select 1 from public.eventos where id = p_evento) then
    return;
  end if;

  insert into public.actividad (tipo, sucursal_id, evento_id, detalle)
  values (p_tipo, p_sucursal, p_evento, nullif(left(lower(trim(p_detalle)), 120), ''));
end;
$$;

revoke all on function public.anotar(text, uuid, uuid, text) from public;
grant execute on function public.anotar(text, uuid, uuid, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Leer: el negocio, lo suyo
-- ---------------------------------------------------------------------------

create or replace function public.actividad_de_sucursal(p_sucursal uuid, p_desde timestamptz)
returns table (tipo text, total bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (public.posee_sucursal(p_sucursal) or public.es_admin()) then
    raise exception 'Esa sucursal no es tuya.';
  end if;

  return query
    select a.tipo, count(*)
      from public.actividad a
     where a.sucursal_id = p_sucursal
       and a.ocurrio_en >= p_desde
     group by a.tipo;
end;
$$;

revoke all on function public.actividad_de_sucursal(uuid, timestamptz) from public, anon;
grant execute on function public.actividad_de_sucursal(uuid, timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- Leer: el administrador, todo
-- ---------------------------------------------------------------------------
--
-- Se agrega en la base y no en la pantalla: en el Festival pueden ser decenas
-- de miles de filas, y bajarlas todas para contarlas en el servidor de Next
-- seria lento y caro.

create or replace function public.actividad_por_sucursal(p_desde timestamptz)
returns table (sucursal_id uuid, tipo text, total bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.es_admin() then
    raise exception 'Solo para administradores.';
  end if;

  return query
    select a.sucursal_id, a.tipo, count(*)
      from public.actividad a
     where a.sucursal_id is not null and a.ocurrio_en >= p_desde
     group by a.sucursal_id, a.tipo;
end;
$$;

create or replace function public.actividad_por_dia(p_desde timestamptz)
returns table (dia date, tipo text, total bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.es_admin() then
    raise exception 'Solo para administradores.';
  end if;

  return query
    select (a.ocurrio_en at time zone 'America/Mexico_City')::date, a.tipo, count(*)
      from public.actividad a
     where a.ocurrio_en >= p_desde
     group by 1, 2;
end;
$$;

create or replace function public.detalles_frecuentes(p_tipo text, p_desde timestamptz, p_limite integer default 15)
returns table (detalle text, total bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.es_admin() then
    raise exception 'Solo para administradores.';
  end if;

  return query
    select a.detalle, count(*)
      from public.actividad a
     where a.tipo = p_tipo and a.detalle is not null and a.ocurrio_en >= p_desde
     group by a.detalle
     order by 2 desc, 1
     limit p_limite;
end;
$$;

revoke all on function public.actividad_por_sucursal(timestamptz) from public, anon;
revoke all on function public.actividad_por_dia(timestamptz) from public, anon;
revoke all on function public.detalles_frecuentes(text, timestamptz, integer) from public, anon;
grant execute on function public.actividad_por_sucursal(timestamptz) to authenticated;
grant execute on function public.actividad_por_dia(timestamptz) to authenticated;
grant execute on function public.detalles_frecuentes(text, timestamptz, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Favoritos: la cuenta, no quien
-- ---------------------------------------------------------------------------
--
-- `favoritos` solo la lee su dueno, y asi se queda: no hace falta saber quien
-- guardo a quien. Lo que sirve es cuantos, y eso lo dan estas dos.

create or replace function public.favoritos_por_sucursal(p_desde timestamptz)
returns table (sucursal_id uuid, total bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.es_admin() then
    raise exception 'Solo para administradores.';
  end if;

  return query
    select f.sucursal_id, count(*)
      from public.favoritos f
     where f.fecha >= p_desde
     group by f.sucursal_id;
end;
$$;

create or replace function public.favoritos_de_sucursal(p_sucursal uuid)
returns bigint
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (public.posee_sucursal(p_sucursal) or public.es_admin()) then
    raise exception 'Esa sucursal no es tuya.';
  end if;

  return (select count(*) from public.favoritos where sucursal_id = p_sucursal);
end;
$$;

revoke all on function public.favoritos_por_sucursal(timestamptz) from public, anon;
revoke all on function public.favoritos_de_sucursal(uuid) from public, anon;
grant execute on function public.favoritos_por_sucursal(timestamptz) to authenticated;
grant execute on function public.favoritos_de_sucursal(uuid) to authenticated;
