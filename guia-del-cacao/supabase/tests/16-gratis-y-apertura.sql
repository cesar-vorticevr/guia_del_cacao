\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages to notice;

-- Planes Gratis, Basico y Pro, y la promocion de apertura (migracion 000053).
--
-- Gratis dura treinta dias a $0. La promocion: pagar un mes de Pro con 50%
-- mientras el codigo sirve lo deja pagado hasta su fecha, y despues se cobra el
-- precio normal. En prueba no hay promocion, y se usa una vez por sucursal.
--
-- Dentro de una transaccion que se deshace: corre tambien contra una base con
-- datos.

begin;

create or replace function pg_temp.debe_fallar(etiqueta text, sentencia text)
returns void language plpgsql as $$
begin
  execute sentencia;
  raise notice 'FALLA  %  -> se permitio y no debia', etiqueta;
exception when others then
  raise notice 'OK     %  -> bloqueado: %', etiqueta, sqlerrm;
end $$;

create or replace function pg_temp.vigente(p_sucursal uuid)
returns public.suscripciones language sql as $$
  select * from public.suscripciones
   where sucursal_id = p_sucursal and estado <> 'cancelado'
   order by fecha_inicio desc limit 1;
$$;

-- ---------------------------------------------------------------- datos
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('a1600000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'apertura@prueba.mx', 'x', now(),
   '{}', '{"nombre":"Beto Apertura","rol":"negocio"}', now(), now());

update public.perfiles set correo_verificado_en = now()
 where id = 'a1600000-0000-0000-0000-000000000001';

insert into public.marcas (id, perfil_id, nombre_comercial, categoria_id)
select 'a2600000-0000-0000-0000-000000000001', 'a1600000-0000-0000-0000-000000000001',
       'Cacao de Beto', id
  from public.categorias where slug = 'chocolateria';

insert into public.productos_servicios (marca_id, nombre)
values ('a2600000-0000-0000-0000-000000000001', 'Barra 70%');

insert into public.sucursales (id, marca_id, nombre_sucursal, slug, entidad, estado, acerca_de, logo)
select ('a3600000-0000-0000-0000-00000000000' || n)::uuid,
       'a2600000-0000-0000-0000-000000000001',
       'Local ' || n, 'apertura-prueba-' || n, 'Tabasco', 'borrador', 'Cacao', 'logo.png'
  from generate_series(1, 7) n;

insert into public.productos_sucursal (producto_id, sucursal_id)
select p.id, s.id
  from public.productos_servicios p
  join public.sucursales s on s.marca_id = p.marca_id
 where p.marca_id = 'a2600000-0000-0000-0000-000000000001';

-- La promocion: Pro al 50%, cubre hasta dentro de 60 dias.
insert into public.convenios (id, codigo, descripcion, vigente_desde, vigente_hasta, descuento, plan_id, cubre_hasta)
values ('a4600000-0000-0000-0000-000000000001', 'PRUEBAAPERTURA', 'Apertura',
        current_date - 1, current_date + 10, 50, 3, current_date + 60);

-- Otra: Basico gratis, un solo uso.
insert into public.convenios (id, codigo, descripcion, vigente_desde, vigente_hasta, descuento, plan_id, cubre_hasta, usos_maximos)
values ('a4600000-0000-0000-0000-000000000002', 'PRUEBAUNAVEZ', 'Una vez',
        current_date - 1, current_date + 10, 100, 2, current_date + 30, 1);

\echo '--- los planes ---'
select string_agg(nombre || '=' || precio_mensual::int, ' ' order by id) = 'Gratis=0 Básico=199 Pro=299' as tres_planes
  from public.tiers;

select pg_temp.debe_fallar('una promocion sin fecha de cobertura no se puede crear',
  $q$ insert into public.convenios (codigo, descripcion, vigente_desde, vigente_hasta, descuento, plan_id)
      values ('PRUEBAMALA', 'Mala', current_date, current_date + 1, 50, 3) $q$);

-- ---------------------------------------------------------------- Beto
set local role authenticated;
set local request.jwt.claims to '{"sub":"a1600000-0000-0000-0000-000000000001","role":"authenticated"}';

\echo '--- el codigo dice que plan paga y hasta cuando ---'
select plan_id = 3 as es_pro, cubre_hasta = current_date + 60 as cubre, descuento = 50 as mitad
  from public.revisar_convenio('prueba-apertura');

-- 1: Gratis, sin convenio.
insert into public.suscripciones (sucursal_id, tier_id, monto_mensual, estado, fecha_proximo_cobro)
values ('a3600000-0000-0000-0000-000000000001', 1, 99, 'activo', now() + interval '1 month');
-- 2: Pro pagado con la promocion.
insert into public.suscripciones (sucursal_id, tier_id, monto_mensual, estado, fecha_proximo_cobro, convenio_id)
values ('a3600000-0000-0000-0000-000000000002', 3, 1, 'activo', now() + interval '1 month',
        'a4600000-0000-0000-0000-000000000001');
-- 3: Pro en prueba con el codigo: no hay promocion sin pago.
insert into public.suscripciones (sucursal_id, tier_id, monto_mensual, estado, fecha_proximo_cobro, convenio_id)
values ('a3600000-0000-0000-0000-000000000003', 3, 1, 'trial', now() + interval '1 month',
        'a4600000-0000-0000-0000-000000000001');
-- 4: Basico pagado con el codigo de Pro: ni promocion ni descuento.
insert into public.suscripciones (sucursal_id, tier_id, monto_mensual, estado, fecha_proximo_cobro, convenio_id)
values ('a3600000-0000-0000-0000-000000000004', 2, 1, 'activo', now() + interval '1 month',
        'a4600000-0000-0000-0000-000000000001');

\echo '--- Gratis: $0, en prueba, treinta dias ---'
select s.monto_por_cobro = 0 as cero,
       s.estado = 'trial' as en_prueba,
       s.fecha_fin_trial between now() + interval '29 days' and now() + interval '31 days' as treinta_dias
  from pg_temp.vigente('a3600000-0000-0000-0000-000000000001') s;

\echo '--- promocion: paga 150 y queda cubierto hasta su fecha; despues, 299 ---'
select s.pago_de_apertura = 150 as pago_150,
       s.monto_por_cobro = 299 as despues_299,
       s.fecha_fin_trial is null as sin_prueba,
       (s.fecha_proximo_cobro at time zone 'America/Mexico_City')::date = current_date + 61 as cobra_al_dia_siguiente
  from pg_temp.vigente('a3600000-0000-0000-0000-000000000002') s;

\echo '--- en prueba no hay promocion: 15 dias y precio normal ---'
select s.pago_de_apertura is null as sin_pago,
       s.monto_por_cobro = 299 as precio_normal,
       s.fecha_fin_trial <= now() + interval '15 days' as quince_dias
  from pg_temp.vigente('a3600000-0000-0000-0000-000000000003') s;

\echo '--- el codigo de Pro no descuenta Basico ---'
select s.pago_de_apertura is null as sin_pago, s.monto_por_cobro = 199 as basico_199
  from pg_temp.vigente('a3600000-0000-0000-0000-000000000004') s;

select pg_temp.debe_fallar('el pago de apertura no se edita',
  $q$ update public.suscripciones set pago_de_apertura = 1
      where sucursal_id = 'a3600000-0000-0000-0000-000000000002' $q$);

\echo '--- la promocion es una vez por sucursal ---'
update public.suscripciones set estado = 'cancelado'
 where sucursal_id = 'a3600000-0000-0000-0000-000000000002' and estado = 'activo';
insert into public.suscripciones (sucursal_id, tier_id, monto_mensual, estado, fecha_proximo_cobro, convenio_id)
values ('a3600000-0000-0000-0000-000000000002', 3, 1, 'activo', now() + interval '1 month',
        'a4600000-0000-0000-0000-000000000001');
select s.pago_de_apertura is null as no_se_repite, s.monto_por_cobro = 299 as precio_normal
  from pg_temp.vigente('a3600000-0000-0000-0000-000000000002') s;

\echo '--- pasarse de Pro en prueba a Gratis no regala dias ---'
update public.suscripciones set estado = 'cancelado'
 where sucursal_id = 'a3600000-0000-0000-0000-000000000003' and estado = 'trial';
insert into public.suscripciones (sucursal_id, tier_id, monto_mensual, estado, fecha_proximo_cobro, fecha_fin_trial)
values ('a3600000-0000-0000-0000-000000000003', 1, 0, 'trial', now() + interval '1 month',
        now() + interval '5 days');
select s.fecha_fin_trial <= now() + interval '5 days' as conserva_su_fecha
  from pg_temp.vigente('a3600000-0000-0000-0000-000000000003') s;

\echo '--- al 100%: gratis hasta su fecha, y el codigo se gasta ---'
select quedan = 1 as queda_uno from public.revisar_convenio('PRUEBAUNAVEZ');
insert into public.suscripciones (sucursal_id, tier_id, monto_mensual, estado, fecha_proximo_cobro, convenio_id)
values ('a3600000-0000-0000-0000-000000000006', 2, 1, 'activo', now() + interval '1 month',
        'a4600000-0000-0000-0000-000000000002');
select s.pago_de_apertura = 0 as pago_cero, s.monto_por_cobro = 199 as despues_199
  from pg_temp.vigente('a3600000-0000-0000-0000-000000000006') s;

select pg_temp.debe_fallar('un codigo agotado ya no se revisa como vigente',
  $q$ select * from public.revisar_convenio('PRUEBAUNAVEZ') $q$);
select pg_temp.debe_fallar('un codigo agotado no se canjea por la puerta de atras',
  $q$ insert into public.suscripciones (sucursal_id, tier_id, monto_mensual, estado, fecha_proximo_cobro, convenio_id)
      values ('a3600000-0000-0000-0000-000000000007', 2, 1, 'activo', now() + interval '1 month',
              'a4600000-0000-0000-0000-000000000002') $q$);

reset role;

\echo '--- al vencer lo que cubria una promo al 100%, sin tarjeta, se oculta ---'
update public.sucursales set estado = 'publicado', tier_id = 2
 where id = 'a3600000-0000-0000-0000-000000000006';
update public.suscripciones set fecha_proximo_cobro = now() - interval '1 minute'
 where sucursal_id = 'a3600000-0000-0000-0000-000000000006' and estado = 'activo';
select public.vencer_pruebas() >= 1 as vencio;
select (select estado from public.suscripciones
         where sucursal_id = 'a3600000-0000-0000-0000-000000000006'
         order by fecha_inicio desc limit 1) = 'pausado_por_pago' as por_pagar,
       (select estado from public.sucursales
         where id = 'a3600000-0000-0000-0000-000000000006') = 'pausado' as oculta;

-- Vencido el codigo, una sucursal nueva ya no tiene promocion.
update public.convenios set vigente_desde = (now() at time zone 'America/Mexico_City')::date - 20,
       vigente_hasta = (now() at time zone 'America/Mexico_City')::date - 1
 where id = 'a4600000-0000-0000-0000-000000000001';

set local role authenticated;
set local request.jwt.claims to '{"sub":"a1600000-0000-0000-0000-000000000001","role":"authenticated"}';

select pg_temp.debe_fallar('con el codigo vencido, una sucursal nueva ya no lo usa',
  $q$ insert into public.suscripciones (sucursal_id, tier_id, monto_mensual, estado, fecha_proximo_cobro, convenio_id)
      values ('a3600000-0000-0000-0000-000000000005', 3, 1, 'activo', now() + interval '1 month',
              'a4600000-0000-0000-0000-000000000001') $q$);

reset role;

rollback;
