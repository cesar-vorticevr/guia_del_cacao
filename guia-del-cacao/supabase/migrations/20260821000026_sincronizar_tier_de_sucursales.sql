-- El `tier_id` de cada sucursal, alineado con el plan de su marca.
--
-- La migracion 000024 movio el plan a la cuenta pero dejo el `tier_id` de cada
-- sucursal como estaba: una marca en Premier con sucursales marcadas en Basico.
-- Eso no es cosmetico — `validar_solicitud_puntos` lo lee para decidir si la
-- sucursal puede dar monedas, asi que un local de una cuenta Premier rechazaba
-- solicitudes con "requiere Tier 2 o superior".
--
-- Aqui se sincroniza lo existente y se pone un trigger para que no vuelva a
-- separarse: el plan se contrata en un sitio y desde ahi baja a todas.

update public.sucursales s
   set tier_id = public.plan_de_marca(s.marca_id)
 where public.plan_de_marca(s.marca_id) is not null
   and s.tier_id is distinct from public.plan_de_marca(s.marca_id);

/*
  Una sucursal nueva nace con el plan de su marca.

  Sin esto habria que acordarse de ponerselo desde la aplicacion, y el dia que
  alguien creara una sucursal por otra via nacería sin plan aunque su marca
  estuviera pagando.
*/
create or replace function public.heredar_plan_de_marca()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  if new.tier_id is null then
    new.tier_id := public.plan_de_marca(new.marca_id);
  end if;

  return new;
end;
$fn$;

drop trigger if exists al_crear_sucursal_0_plan on public.sucursales;

-- El `0` la pone delante de los otros tres triggers de alta, que corren en
-- orden alfabetico: primero se hereda el plan y despues se comprueba lo demas.
create trigger al_crear_sucursal_0_plan
  before insert on public.sucursales
  for each row execute function public.heredar_plan_de_marca();
