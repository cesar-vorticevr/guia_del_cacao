-- El plan deja de ser de cada sucursal y pasa a ser de la cuenta.
--
-- Cobrar por sucursal obligaba a repetir la misma decision en cada una: una
-- marca con cuatro locales tenia cuatro suscripciones al mismo plan, cuatro
-- pantallas donde cancelarlo y cuatro fechas de cobro distintas. El plan es de
-- quien paga —la marca—, y lo que cambia con el es cuantas sucursales caben y
-- que puede hacer cada una.
--
-- La sucursal conserva `tier_id` como reflejo del plan de su marca: lo leen el
-- micrositio publico y el panel para saber si reparte monedas o sale en el
-- banner, y cambiarlo ahi seria reescribir media aplicacion sin ganar nada.

-- ---------------------------------------------------------------------------
-- 1. La suscripcion cuelga de la marca
-- ---------------------------------------------------------------------------

alter table public.suscripciones
  add column if not exists marca_id uuid references public.marcas (id) on delete cascade;

update public.suscripciones s
   set marca_id = su.marca_id
  from public.sucursales su
 where su.id = s.sucursal_id
   and s.marca_id is null;

-- ---------------------------------------------------------------------------
-- 2. Una sola activa por marca
-- ---------------------------------------------------------------------------

/*
  Una marca podia tener cuatro activas —una por local— y todas al mismo plan. Se
  conserva la del plan mas alto (la que de verdad estaba pagando por lo mejor) y
  las demas quedan como canceladas en el historial. Nada se borra: son cobros que
  ocurrieron.
*/
with mejor as (
  select distinct on (marca_id)
         id, marca_id
    from public.suscripciones
   where estado = 'activo' and marca_id is not null
   order by marca_id, tier_id desc, fecha_inicio desc
)
update public.suscripciones s
   set estado = 'cancelado'
 where s.estado = 'activo'
   and s.marca_id is not null
   and s.id not in (select id from mejor);

create unique index if not exists suscripcion_activa_por_marca
  on public.suscripciones (marca_id)
  where estado = 'activo';

comment on index public.suscripcion_activa_por_marca is
  'Una marca no puede tener dos planes activos a la vez. Cambiar de plan cancela el anterior y abre otro.';

alter table public.suscripciones
  alter column sucursal_id drop not null;

comment on column public.suscripciones.sucursal_id is
  'EN DESUSO desde esta migracion: el plan es de la marca. Se conserva por historial.';

create index if not exists suscripciones_marca_idx
  on public.suscripciones (marca_id, estado);

-- ---------------------------------------------------------------------------
-- 3. RLS por marca
-- ---------------------------------------------------------------------------

drop policy if exists suscripciones_propias on public.suscripciones;
drop policy if exists suscripciones_crea on public.suscripciones;
drop policy if exists suscripciones_edita on public.suscripciones;

create policy suscripciones_propias on public.suscripciones
  for select using (public.posee_marca(marca_id) or public.es_admin());

create policy suscripciones_crea on public.suscripciones
  for insert with check (public.posee_marca(marca_id) or public.es_admin());

create policy suscripciones_edita on public.suscripciones
  for update using (public.posee_marca(marca_id) or public.es_admin())
  with check (public.posee_marca(marca_id) or public.es_admin());

-- ---------------------------------------------------------------------------
-- 4. El plan de una marca, en un solo lugar
-- ---------------------------------------------------------------------------

/** El tier con suscripcion activa de la marca, o null si no tiene ninguna. */
create or replace function public.plan_de_marca(p_marca uuid)
returns smallint
language sql
stable
security definer
set search_path = ''
as $fn$
  select s.tier_id
    from public.suscripciones s
   where s.marca_id = p_marca and s.estado = 'activo'
   limit 1;
$fn$;

create or replace function public.tope_de_sucursales(p_marca uuid)
returns smallint
language sql
stable
security definer
set search_path = ''
as $fn$
  select greatest(
    coalesce(
      (select t.max_sucursales
         from public.tiers t
        where t.id = public.plan_de_marca(p_marca)),
      1
    ),
    1
  )::smallint;
$fn$;

-- ---------------------------------------------------------------------------
-- 5. Publicar mira el plan de la marca, no el de la sucursal
-- ---------------------------------------------------------------------------

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

  if new.estado = 'rechazado' and not es_admin then
    raise exception 'Solo un administrador puede rechazar una sucursal';
  end if;

  if new.estado = 'publicado' and not es_admin then
    -- Una pausa de moderacion solo la levanta quien la puso.
    if old.estado = 'pausado' and old.pausado_por_admin then
      raise exception 'Este micrositio esta pausado por moderacion: solo un administrador puede reactivarlo';
    end if;

    -- Y lo demas lo decide el plan de la marca. Antes se miraba la suscripcion
    -- de esta sucursal; ahora hay una sola por cuenta y cubre a todas.
    if public.plan_de_marca(new.marca_id) is null then
      raise exception 'Para publicar hace falta un plan activo';
    end if;
  end if;

  return new;
end;
$fn$;
