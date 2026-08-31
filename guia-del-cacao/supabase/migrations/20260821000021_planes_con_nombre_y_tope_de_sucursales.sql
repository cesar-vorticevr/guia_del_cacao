-- Los planes dejan de llamarse "Tier 1, 2, 3" y ganan un tope de sucursales.
--
-- "Tier" no es una palabra que use nadie en una chocolateria, y numerarlos no
-- dice que se gana al subir. Los nombres nuevos siguen la cadena real del cacao
-- —la mazorca se abre, el grano se tuesta, la barra se vende—, asi que el orden
-- se entiende sin leer la tabla de precios. No chocan con los rangos del
-- pasaporte (Curioso, Catador, Conocedor, Maestro cacaotero): esos son de quien
-- visita, estos de quien vende.

alter table public.tiers
  add column if not exists max_sucursales smallint not null default 1;

comment on column public.tiers.max_sucursales is
  'Cuantas sucursales puede tener en total una marca con este plan activo.';

update public.tiers set nombre = 'Mazorca', max_sucursales = 1  where id = 1;
update public.tiers set nombre = 'Grano',   max_sucursales = 3  where id = 2;
update public.tiers set nombre = 'Barra',   max_sucursales = 20 where id = 3;

-- ---------------------------------------------------------------------------
-- Cuantas sucursales caben
-- ---------------------------------------------------------------------------

/*
  El tope lo pone el plan mas alto que la marca tenga pagado, no la suma de sus
  planes: cada sucursal se cobra aparte, y sumar topes convertiria "tres
  sucursales" en "tres por cada una que ya tengas".

  Sin ninguna suscripcion activa el tope es 1. Esa primera sucursal es la que se
  arma sin pagar para poder publicarla despues; si fuera 0, un negocio recien
  llegado no tendria por donde empezar.
*/
create or replace function public.tope_de_sucursales(p_marca uuid)
returns smallint
language sql
stable
security definer
set search_path = ''
as $fn$
  select greatest(
    coalesce(
      (select max(t.max_sucursales)
         from public.suscripciones s
         join public.sucursales su on su.id = s.sucursal_id
         join public.tiers t on t.id = s.tier_id
        where su.marca_id = p_marca
          and s.estado = 'activo'),
      1
    ),
    1
  )::smallint;
$fn$;

create or replace function public.exigir_tope_de_sucursales()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  cuantas integer;
  tope smallint;
begin
  if public.es_admin() then
    return new;
  end if;

  select count(*) into cuantas
    from public.sucursales
   where marca_id = new.marca_id;

  tope := public.tope_de_sucursales(new.marca_id);

  if cuantas >= tope then
    raise exception
      'Tu plan permite % %. Sube de plan para agregar mas.',
      tope,
      case when tope = 1 then 'sucursal' else 'sucursales' end;
  end if;

  return new;
end;
$fn$;

-- Despues del de correo verificado: si le faltan las dos cosas, primero se le
-- dice la que puede resolver sin pagar.
drop trigger if exists al_crear_sucursal_exigir_tope on public.sucursales;

create trigger al_crear_sucursal_exigir_tope
  before insert on public.sucursales
  for each row execute function public.exigir_tope_de_sucursales();
