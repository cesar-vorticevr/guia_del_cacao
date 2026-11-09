-- La agenda de la propia Guía no cuenta contra «un evento por semana».
--
-- La regla de la spec (§5.3, migración 000002) es para los negocios: que
-- ninguno llene la agenda. Pero la Guía publica la agenda del Festival del
-- Chocolate entera desde su micrositio (`scripts/agenda-del-festival.mjs`):
-- seis eventos en una semana, y la regla los rechazaba.
--
-- Se salta solo para quien opera la plataforma: el administrador y la llave de
-- servicio, que es con la que corren los scripts. Un negocio desde la
-- aplicación entra como `authenticated` y la regla le sigue aplicando igual.

create or replace function public.limitar_evento_semanal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  ya_hay integer;
begin
  if public.es_admin() or (select auth.role()) = 'service_role' then
    return new;
  end if;

  select count(*)
    into ya_hay
    from public.eventos e
    join public.sucursales s on s.id = e.sucursal_id
   where s.marca_id = public.marca_de_sucursal(new.sucursal_id)
     and e.id <> new.id
     and to_char(e.fecha_evento, 'IYYY-IW') = to_char(new.fecha_evento, 'IYYY-IW');

  if ya_hay > 0 then
    raise exception 'Esta marca ya tiene un evento en esa semana (maximo 1 por semana)';
  end if;

  return new;
end;
$fn$;
