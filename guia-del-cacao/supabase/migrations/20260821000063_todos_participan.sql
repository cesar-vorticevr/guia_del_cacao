-- Todos participan: los negocios tambien reseñan, califican, guardan
-- favoritos y comentan eventos de OTROS negocios. Nunca en lo suyo.
--
-- Hasta aqui eso era solo de clientes, y la puerta era una sola funcion,
-- `es_cliente()` (migracion 000009), usada en las politicas de reseñas,
-- calificaciones, favoritos, comentarios de eventos y las fotos de reseña.
-- Se cambia ahi: ahora dice «puede participar como visitante», que es cliente
-- o negocio con su rol ya elegido. El nombre se conserva para no tocar cada
-- politica que la usa.
--
-- Lo que faltaba al abrirlo: que un negocio no se reseñe, no se califique ni
-- se guarde a si mismo. Lo imponen triggers y no solo la pantalla.

create or replace function public.es_cliente()
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select exists (
    select 1 from public.perfiles p
     where p.id = (select auth.uid())
       and p.rol in ('cliente', 'negocio')
       and p.rol_confirmado
  );
$fn$;

comment on function public.es_cliente() is
  'Puede participar como visitante: cliente o negocio con su rol elegido. Desde la migracion 000063 incluye a los negocios; lo propio lo frena no_en_lo_propio().';

-- Nunca en lo propio: reseñar, calificar o guardar tu propio negocio.
create or replace function public.no_en_lo_propio()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and public.posee_sucursal(new.sucursal_id) then
    raise exception 'Es tu propio negocio: aquí opinan y guardan los demás.';
  end if;
  return new;
end;
$$;

drop trigger if exists al_resenar_no_lo_propio on public.resenas;
create trigger al_resenar_no_lo_propio
  before insert on public.resenas
  for each row execute function public.no_en_lo_propio();

drop trigger if exists al_calificar_no_lo_propio on public.calificaciones;
create trigger al_calificar_no_lo_propio
  before insert on public.calificaciones
  for each row execute function public.no_en_lo_propio();

drop trigger if exists al_guardar_no_lo_propio on public.favoritos;
create trigger al_guardar_no_lo_propio
  before insert on public.favoritos
  for each row execute function public.no_en_lo_propio();
