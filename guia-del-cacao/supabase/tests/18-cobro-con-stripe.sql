\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages to notice;

-- Cobro con Stripe (migracion 000056).
--
-- Los identificadores de Stripe solo los escribe el webhook (sin usuario, con
-- la llave de servicio): un negocio no puede abrir una suscripcion «pagada con
-- Stripe» ni ponerse el cliente de otro. Y el webhook si puede cerrar y abrir
-- filas aunque cambie el plan.
--
-- Dentro de una transaccion que se deshace.

begin;

-- Esta prueba es de las reglas de precio, y las cuentas estan hechas con los
-- tres planes de entonces: Gratis $0, Basico $199 y Pro $299, los tres a la
-- venta. Desde la migracion 000059 hay un solo plan de pago ($499) y el
-- Basico ya no se ofrece; los precios de hoy los revisa 20-embajadores.sql.
-- Aqui se ponen los de entonces, dentro de la transaccion que se deshace.
update public.tiers set se_ofrece = true where id = 2;
update public.tiers set precio_mensual = 299 where id = 3;

create or replace function pg_temp.debe_fallar(etiqueta text, sentencia text)
returns void language plpgsql as $$
begin
  execute sentencia;
  raise notice 'FALLA  %  -> se permitio y no debia', etiqueta;
exception when others then
  raise notice 'OK     %  -> bloqueado: %', etiqueta, sqlerrm;
end $$;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('d1800000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'stripe-prueba@prueba.mx', 'x', now(),
   '{}', '{"nombre":"Stripe","rol":"negocio"}', now(), now());

update public.perfiles set correo_verificado_en = now()
 where id = 'd1800000-0000-0000-0000-000000000001';

insert into public.marcas (id, perfil_id, nombre_comercial, categoria_id)
select 'd2800000-0000-0000-0000-000000000001', 'd1800000-0000-0000-0000-000000000001',
       'Cacao con Tarjeta', id
  from public.categorias where slug = 'chocolateria';

insert into public.productos_servicios (marca_id, nombre)
values ('d2800000-0000-0000-0000-000000000001', 'Barra');

insert into public.sucursales (id, marca_id, nombre_sucursal, slug, entidad, estado, acerca_de, logo)
values ('d3800000-0000-0000-0000-000000000001', 'd2800000-0000-0000-0000-000000000001',
        'Centro', 'stripe-prueba', 'Tabasco', 'borrador', 'Cacao', 'logo.png');

-- ---------------------------------------------------------------- el negocio
set local role authenticated;
set local request.jwt.claims to '{"sub":"d1800000-0000-0000-0000-000000000001","role":"authenticated"}';

select pg_temp.debe_fallar('no se abre una suscripcion como pagada con Stripe',
  $q$ insert into public.suscripciones (sucursal_id, tier_id, monto_mensual, estado, fecha_proximo_cobro, stripe_subscription_id)
      values ('d3800000-0000-0000-0000-000000000001', 3, 1, 'activo', now() + interval '1 month', 'sub_inventada') $q$);

insert into public.suscripciones (sucursal_id, tier_id, monto_mensual, estado, fecha_proximo_cobro)
values ('d3800000-0000-0000-0000-000000000001', 3, 1, 'trial', now() + interval '1 month');

select pg_temp.debe_fallar('no se le pega una suscripcion de Stripe despues',
  $q$ update public.suscripciones set stripe_subscription_id = 'sub_inventada'
      where sucursal_id = 'd3800000-0000-0000-0000-000000000001' $q$);

select pg_temp.debe_fallar('no se cambia el cliente de Stripe de su marca',
  $q$ update public.marcas set stripe_customer_id = 'cus_ajeno'
      where id = 'd2800000-0000-0000-0000-000000000001' $q$);

reset role;

-- ---------------------------------------------------------------- el webhook
-- Sin usuario: asi llega la llave de servicio, cuyo JWT no trae 'sub'.
set local request.jwt.claims to '{"role":"service_role"}';
update public.suscripciones set estado = 'cancelado'
 where sucursal_id = 'd3800000-0000-0000-0000-000000000001';

insert into public.suscripciones (sucursal_id, tier_id, monto_mensual, estado, fecha_proximo_cobro, stripe_subscription_id)
values ('d3800000-0000-0000-0000-000000000001', 2, 0, 'activo', now() + interval '1 month', 'sub_de_stripe');

update public.marcas set stripe_customer_id = 'cus_de_stripe'
 where id = 'd2800000-0000-0000-0000-000000000001';

\echo '--- el webhook abre la pagada, con el precio que fija la base ---'
select stripe_subscription_id = 'sub_de_stripe' as con_stripe,
       monto_por_cobro = 199 as basico_199,
       (select stripe_customer_id from public.marcas
         where id = 'd2800000-0000-0000-0000-000000000001') = 'cus_de_stripe' as cliente
  from public.suscripciones
 where sucursal_id = 'd3800000-0000-0000-0000-000000000001' and estado = 'activo';

rollback;
