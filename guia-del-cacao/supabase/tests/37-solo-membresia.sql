\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages to notice;

-- Solo hay membresia (migracion 000081): el primer mes gratis es una
-- promocion de la membresia, no un plan. Durante ese mes no se sale en el
-- banner, y vencido no se vuelve a publicar sin pagar.
--
-- Dentro de una transaccion que se deshace.

begin;

create or replace function pg_temp.debe_ser(etiqueta text, valor boolean)
returns void language plpgsql as $$
begin
  if valor then
    raise notice 'OK     %', etiqueta;
  else
    raise notice 'FALLA  %', etiqueta;
  end if;
end $$;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('f3700000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'solo-membresia@prueba.mx', 'x', now(),
   '{}', '{"nombre":"Membresia","rol":"negocio"}', now(), now());

update public.perfiles set correo_verificado_en = now() where id = 'f3700000-0000-0000-0000-000000000001';

insert into public.marcas (id, perfil_id, nombre_comercial, categoria_id)
select 'f3710000-0000-0000-0000-000000000001', 'f3700000-0000-0000-0000-000000000001', 'Cacao de membresia', c.id
  from public.categorias c where c.slug = 'chocolateria';

insert into public.productos_servicios (marca_id, nombre)
values ('f3710000-0000-0000-0000-000000000001', 'Barra');

insert into public.sucursales (id, marca_id, nombre_sucursal, slug, entidad, estado, acerca_de, logo, tier_id)
values ('f3720000-0000-0000-0000-000000000001', 'f3710000-0000-0000-0000-000000000001',
        'Centro', 'solo-membresia', 'Tabasco', 'publicado', 'Cacao', 'logo.png', 3);

-- ---------------------------------------------------------------- el Gratis ya no
select pg_temp.debe_ser('el Gratis ya no se ofrece',
  not (select se_ofrece from public.tiers where id = 1));

do $$
begin
  insert into public.suscripciones (sucursal_id, tier_id, monto_mensual, fecha_proximo_cobro)
  values ('f3720000-0000-0000-0000-000000000001', 1, 0, now() + interval '1 month');
  raise notice 'FALLA  abrio una suscripcion en el Gratis';
exception when others then
  raise notice 'OK     no se abre el Gratis  -> bloqueado: %', sqlerrm;
end $$;

-- ---------------------------------------------------------------- el mes gratis
insert into public.suscripciones (sucursal_id, tier_id, monto_mensual, estado, fecha_proximo_cobro)
values ('f3720000-0000-0000-0000-000000000001', 3, 0, 'trial', now() + interval '1 month');

select pg_temp.debe_ser('la membresia en su mes gratis dura treinta dias',
  (select fecha_fin_trial between now() + interval '29 days' and now() + interval '31 days'
     from public.suscripciones
    where sucursal_id = 'f3720000-0000-0000-0000-000000000001' and estado = 'trial'));

select pg_temp.debe_ser('en el mes gratis tiene plan',
  public.plan_de_sucursal('f3720000-0000-0000-0000-000000000001') = 3);

select pg_temp.debe_ser('en el mes gratis no sale en el banner',
  not public.pagada((select s from public.sucursales s where s.id = 'f3720000-0000-0000-0000-000000000001')));

-- ---------------------------------------------------------------- vencida, antes de la noche
-- Vencio hoy y `vencer_pruebas()` todavia no corre: ya no cuenta como plan.
update public.suscripciones set fecha_fin_trial = now() - interval '1 hour'
 where sucursal_id = 'f3720000-0000-0000-0000-000000000001';

select pg_temp.debe_ser('una prueba vencida ya no es plan',
  public.plan_de_sucursal('f3720000-0000-0000-0000-000000000001') is null);

-- La oculta su dueña y quiere volver a publicarla sin pagar.
set local role authenticated;
set local request.jwt.claims to '{"sub":"f3700000-0000-0000-0000-000000000001","role":"authenticated"}';

update public.sucursales set estado = 'pausado' where id = 'f3720000-0000-0000-0000-000000000001';

do $$
begin
  update public.sucursales set estado = 'publicado' where id = 'f3720000-0000-0000-0000-000000000001';
  raise notice 'FALLA  volvio a publicar con la prueba vencida';
exception when others then
  raise notice 'OK     vencida no se vuelve a publicar  -> bloqueado: %', sqlerrm;
end $$;

select pg_temp.debe_ser('oculta no la ve el publico, ni con el enlace',
  not public.sucursal_publicada('f3720000-0000-0000-0000-000000000001'));

reset role;

-- ---------------------------------------------------------------- pagada
update public.suscripciones set estado = 'cancelado'
 where sucursal_id = 'f3720000-0000-0000-0000-000000000001';

insert into public.suscripciones (sucursal_id, tier_id, monto_mensual, estado, fecha_proximo_cobro)
values ('f3720000-0000-0000-0000-000000000001', 3, 0, 'activo', now() + interval '1 month');

select pg_temp.debe_ser('pagada sale en el banner',
  public.pagada((select s from public.sucursales s where s.id = 'f3720000-0000-0000-0000-000000000001')));

rollback;
