\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages to notice;

-- Precios, pago anual y convenios (migraciones 000051 y 000053).
--
-- Los planes son Gratis (id 1, $0), Basico (id 2, $199) y Pro (id 3, $299).
-- El precio lo calcula la base al abrir la suscripcion; un convenio da Gratis
-- hasta una fecha y descuento en Basico y Pro; el anual descuenta 20%
-- y no se suma al convenio; quien no paga se oculta sin borrarse.
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

create or replace function pg_temp.debe_pasar(etiqueta text, sentencia text)
returns void language plpgsql as $$
begin
  execute sentencia;
  raise notice 'OK     %', etiqueta;
exception when others then
  raise notice 'FALLA  %  -> %', etiqueta, sqlerrm;
end $$;

-- Lo que cobra una suscripcion recien abierta, para las comprobaciones.
create or replace function pg_temp.cobro(p_sucursal uuid)
returns numeric language sql as $$
  select monto_por_cobro from public.suscripciones
   where sucursal_id = p_sucursal and estado <> 'cancelado'
   order by fecha_inicio desc limit 1;
$$;

-- ---------------------------------------------------------------- datos
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('c1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'convenio-a@prueba.mx', 'x', now(),
   '{}', '{"nombre":"Ana Convenio","rol":"negocio"}', now(), now());

update public.perfiles set correo_verificado_en = now()
 where id = 'c1000000-0000-0000-0000-000000000001';

insert into public.marcas (id, perfil_id, nombre_comercial, categoria_id)
select 'c2000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001',
       'Cacao de Ana', id
  from public.categorias where slug = 'chocolateria';

insert into public.productos_servicios (marca_id, nombre)
values ('c2000000-0000-0000-0000-000000000001', 'Barra 70%');

-- Seis sucursales completas, una por caso.
insert into public.sucursales (id, marca_id, nombre_sucursal, slug, entidad, estado, acerca_de, logo)
select ('c3000000-0000-0000-0000-00000000000' || n)::uuid,
       'c2000000-0000-0000-0000-000000000001',
       'Local ' || n, 'convenio-prueba-' || n, 'Tabasco', 'borrador', 'Cacao', 'logo.png'
  from generate_series(1, 6) n;

insert into public.productos_sucursal (producto_id, sucursal_id)
select p.id, s.id
  from public.productos_servicios p
  join public.sucursales s on s.marca_id = p.marca_id
 where p.marca_id = 'c2000000-0000-0000-0000-000000000001';

insert into public.convenios (id, codigo, descripcion, vigente_desde, vigente_hasta, basico_gratis_hasta, descuento)
values ('c4000000-0000-0000-0000-000000000001', 'PRUEBAVIGENTE', 'Vigente',
        current_date - 10, current_date + 10, current_date + 40, 20),
       ('c4000000-0000-0000-0000-000000000002', 'PRUEBAVENCIDO', 'Vencido',
        current_date - 60, current_date - 30, current_date - 30, 20),
       ('c4000000-0000-0000-0000-000000000003', 'PRUEBAFUTURO', 'Futuro',
        current_date + 30, current_date + 60, current_date + 60, 20);

\echo '--- precios base ---'
select string_agg(nombre || '=' || precio_mensual::int, ' ' order by precio_mensual) as planes
  from public.tiers;

\echo '--- el codigo se compara sin espacios, guiones ni minusculas ---'
select public.normalizar_codigo(' festival-chocolate ') = 'FESTIVALCHOCOLATE' as normaliza;

-- ---------------------------------------------------------------- Ana
set local role authenticated;
set local request.jwt.claims to '{"sub":"c1000000-0000-0000-0000-000000000001","role":"authenticated"}';

\echo '--- un negocio no ve la lista de codigos ---'
select count(*) = 0 as no_ve_codigos from public.convenios;

select pg_temp.debe_fallar('un codigo inventado no existe',
  $q$ select * from public.revisar_convenio('NOEXISTE') $q$);
select pg_temp.debe_fallar('un codigo vencido ya no sirve',
  $q$ select * from public.revisar_convenio('pruebavencido') $q$);
select pg_temp.debe_fallar('un codigo que no empieza todavia no sirve',
  $q$ select * from public.revisar_convenio('PRUEBA-FUTURO') $q$);

\echo '--- el vigente dice que ofrece ---'
select descuento = 20 as veinte, basico_gratis_hasta = current_date + 40 as gratis_hasta
  from public.revisar_convenio(' prueba vigente ');

select pg_temp.debe_fallar('no se cuela un convenio vencido por la puerta de atras',
  $q$ insert into public.suscripciones (sucursal_id, tier_id, monto_mensual, estado, fecha_proximo_cobro, convenio_id)
      values ('c3000000-0000-0000-0000-000000000006', 3, 1, 'trial', now() + interval '1 month',
              'c4000000-0000-0000-0000-000000000002') $q$);

-- 1: sin convenio, Pro mensual, mandando un monto inventado.
insert into public.suscripciones (sucursal_id, tier_id, monto_mensual, estado, fecha_proximo_cobro)
values ('c3000000-0000-0000-0000-000000000001', 3, 1, 'trial', now() + interval '1 month');
-- 2: sin convenio, Pro anual.
insert into public.suscripciones (sucursal_id, tier_id, monto_mensual, periodo, estado, fecha_proximo_cobro)
values ('c3000000-0000-0000-0000-000000000002', 3, 1, 'anual', 'trial', now() + interval '1 month');
-- 3: convenio, Gratis.
insert into public.suscripciones (sucursal_id, tier_id, monto_mensual, estado, fecha_proximo_cobro, convenio_id)
values ('c3000000-0000-0000-0000-000000000003', 1, 99, 'trial', now() + interval '1 month',
        'c4000000-0000-0000-0000-000000000001');
-- 4: convenio, Pro mensual.
insert into public.suscripciones (sucursal_id, tier_id, monto_mensual, estado, fecha_proximo_cobro, convenio_id)
values ('c3000000-0000-0000-0000-000000000004', 3, 1, 'trial', now() + interval '1 month',
        'c4000000-0000-0000-0000-000000000001');
-- 5: convenio, Pro anual: los descuentos no se suman.
insert into public.suscripciones (sucursal_id, tier_id, monto_mensual, periodo, estado, fecha_proximo_cobro, convenio_id)
values ('c3000000-0000-0000-0000-000000000005', 3, 1, 'anual', 'trial', now() + interval '1 month',
        'c4000000-0000-0000-0000-000000000001');

\echo '--- el precio lo pone la base ---'
select pg_temp.cobro('c3000000-0000-0000-0000-000000000001') = 299  as pro_mensual_299,
       pg_temp.cobro('c3000000-0000-0000-0000-000000000002') = 2870 as pro_anual_2870,
       pg_temp.cobro('c3000000-0000-0000-0000-000000000003') = 0    as convenio_gratis,
       pg_temp.cobro('c3000000-0000-0000-0000-000000000004') = 239  as convenio_pro_239,
       pg_temp.cobro('c3000000-0000-0000-0000-000000000005') = 2870 as no_se_suman;

\echo '--- con convenio, Gratis dura hasta el dia siguiente a su fecha; una prueba de pago, 15 dias ---'
select (fecha_fin_trial at time zone 'America/Mexico_City')::date = current_date + 41 as gratis_hasta_su_fecha
  from public.suscripciones where sucursal_id = 'c3000000-0000-0000-0000-000000000003';
select fecha_fin_trial <= now() + interval '15 days' as pro_maximo_15_dias
  from public.suscripciones where sucursal_id = 'c3000000-0000-0000-0000-000000000004';

select pg_temp.debe_fallar('el precio no se cambia editando la suscripcion',
  $q$ update public.suscripciones set monto_mensual = 1
      where sucursal_id = 'c3000000-0000-0000-0000-000000000001' $q$);
select pg_temp.debe_fallar('el convenio no se pone despues',
  $q$ update public.suscripciones set convenio_id = 'c4000000-0000-0000-0000-000000000001'
      where sucursal_id = 'c3000000-0000-0000-0000-000000000001' $q$);

select pg_temp.debe_fallar('un negocio no puede correr la bajada de planes',
  $q$ select public.vencer_pruebas() $q$);

\echo '--- la duena ve su convenio ---'
select codigo = 'PRUEBAVIGENTE' as ve_su_convenio
  from public.convenio_de_sucursal('c3000000-0000-0000-0000-000000000003');

reset role;

-- La 3 publica, y su Gratis se acaba.
update public.sucursales set estado = 'publicado', tier_id = 1
 where id = 'c3000000-0000-0000-0000-000000000003';
update public.suscripciones set fecha_fin_trial = now() - interval '1 minute'
 where sucursal_id = 'c3000000-0000-0000-0000-000000000003';

select public.vencer_pruebas() >= 1 as vencio_alguna;

\echo '--- sin pago se oculta, no se borra ---'
select su.estado = 'pausado' as fuera_del_directorio,
       (select estado from public.suscripciones
         where sucursal_id = su.id order by fecha_inicio desc limit 1) = 'pausado_por_pago' as pausada_por_pago,
       exists (select 1 from public.productos_sucursal where sucursal_id = su.id) as conserva_todo
  from public.sucursales su
 where su.id = 'c3000000-0000-0000-0000-000000000003';

set local role authenticated;
set local request.jwt.claims to '{"sub":"c1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select pg_temp.debe_fallar('no se reactiva sola sin pagar',
  $q$ update public.sucursales set estado = 'publicado'
      where id = 'c3000000-0000-0000-0000-000000000003' $q$);

-- Ya vencido el codigo, cambiar de plan conserva el descuento.
reset role;
update public.convenios set vigente_desde = (now() at time zone 'America/Mexico_City')::date - 40,
       vigente_hasta = (now() at time zone 'America/Mexico_City')::date - 1
 where id = 'c4000000-0000-0000-0000-000000000001';

set local role authenticated;
set local request.jwt.claims to '{"sub":"c1000000-0000-0000-0000-000000000001","role":"authenticated"}';

update public.suscripciones set estado = 'cancelado'
 where sucursal_id = 'c3000000-0000-0000-0000-000000000003' and estado = 'pausado_por_pago';

select pg_temp.debe_pasar('con el codigo vencido, quien ya lo tenia conserva el descuento',
  $q$ insert into public.suscripciones (sucursal_id, tier_id, monto_mensual, estado, fecha_proximo_cobro, convenio_id)
      values ('c3000000-0000-0000-0000-000000000003', 2, 1, 'activo', now() + interval '1 month',
              'c4000000-0000-0000-0000-000000000001') $q$);

\echo '--- Basico con convenio: 199 menos 20% ---'
select pg_temp.cobro('c3000000-0000-0000-0000-000000000003') = 159 as basico_159;

select pg_temp.debe_fallar('con el codigo vencido, una sucursal nueva ya no lo usa',
  $q$ insert into public.suscripciones (sucursal_id, tier_id, monto_mensual, estado, fecha_proximo_cobro, convenio_id)
      values ('c3000000-0000-0000-0000-000000000006', 1, 1, 'trial', now() + interval '1 month',
              'c4000000-0000-0000-0000-000000000001') $q$);

reset role;

rollback;
