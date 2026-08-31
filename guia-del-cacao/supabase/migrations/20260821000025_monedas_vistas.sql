-- Cuando el negocio miro por ultima vez sus solicitudes de monedas.
--
-- Hace falta para distinguir dos cosas que hoy se ven igual: una solicitud
-- **pendiente** —que sigue sin resolver y por eso el icono no se apaga— y una
-- solicitud **nueva** —que ademas llego despues de la ultima vez que entro, y
-- por eso destella—.
--
-- No es una tabla de "leidas" por solicitud: lo que interesa no es cual se vio,
-- sino si hay algo posterior a la ultima visita. Una marca de tiempo en el
-- perfil basta y no crece con el uso.

alter table public.perfiles
  add column if not exists monedas_vistas_en timestamptz;

comment on column public.perfiles.monedas_vistas_en is
  'Ultima vez que este negocio abrio la seccion de monedas. Lo posterior a esta fecha se marca como nuevo.';

/**
 * Cuantas solicitudes pendientes tiene cada sucursal y cuantas son nuevas.
 *
 * Va en una sola consulta y no en una por sucursal: el panel las pinta todas a
 * la vez, y preguntar de a una convertiria el panel en una tanda de viajes a la
 * base que crece con el numero de locales.
 */
create or replace function public.solicitudes_por_sucursal()
returns table (sucursal_id uuid, pendientes bigint, nuevas bigint)
language sql
stable
security definer
set search_path = ''
as $fn$
  select
    s.sucursal_id,
    count(*) as pendientes,
    count(*) filter (
      where s.fecha_solicitud > coalesce(p.monedas_vistas_en, 'epoch'::timestamptz)
    ) as nuevas
  from public.solicitudes_puntos s
  join public.sucursales su on su.id = s.sucursal_id
  join public.marcas m on m.id = su.marca_id
  join public.perfiles p on p.id = m.perfil_id
 where s.estado = 'pendiente'
   and m.perfil_id = (select auth.uid())
 group by s.sucursal_id;
$fn$;

revoke all on function public.solicitudes_por_sucursal() from public;
grant execute on function public.solicitudes_por_sucursal() to authenticated;
