-- Guía del Cacao — pausa propia y pausa por moderación
--
-- El estado 'pausado' de §6 no distinguia quien lo puso, y eso deja dos huecos
-- opuestos:
--
--   Si solo el administrador puede devolver a 'publicado', un negocio que pausa
--   su micrositio por su cuenta queda atrapado y necesita otra aprobacion para
--   volver, aunque ya se la habian dado.
--
--   Si cualquiera puede devolverlo, un micrositio pausado por moderacion se
--   reactiva solo, y la moderacion no sirve de nada.
--
-- La diferencia es quien pauso. Se guarda al pausar y decide quien reactiva.

alter table public.sucursales
  add column pausado_por_admin boolean not null default false;

comment on column public.sucursales.pausado_por_admin is
  'true cuando la pausa fue una decision de moderacion. Solo un administrador puede levantarla.';

create or replace function public.proteger_estado_sucursal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  es_admin boolean := (select auth.uid()) is null
    or coalesce(
      (select p.rol from public.perfiles p where p.id = (select auth.uid())),
      'cliente'
    ) = 'admin';
begin
  if new.estado is not distinct from old.estado then
    return new;
  end if;

  -- Rechazar es siempre decision del administrador (spec §3.3).
  if new.estado = 'rechazado' and not es_admin then
    raise exception 'Solo un administrador puede rechazar una sucursal';
  end if;

  if new.estado = 'publicado' and not es_admin then
    -- Unica excepcion: retomar una pausa que el propio dueno se puso sobre un
    -- micrositio ya aprobado antes. No hace falta volver a revisarlo.
    if old.estado = 'pausado'
       and not old.pausado_por_admin
       and old.fecha_publicacion is not null
    then
      return new;
    end if;

    raise exception 'Solo un administrador puede publicar una sucursal';
  end if;

  -- Queda constancia de quien pauso, que es lo que decide quien puede levantar
  -- la pausa despues.
  if new.estado = 'pausado' then
    new.pausado_por_admin := es_admin;
  elsif old.estado = 'pausado' then
    new.pausado_por_admin := false;
  end if;

  if new.estado = 'publicado' and old.estado <> 'publicado' then
    new.fecha_publicacion := coalesce(new.fecha_publicacion, now());
  end if;

  return new;
end;
$fn$;
