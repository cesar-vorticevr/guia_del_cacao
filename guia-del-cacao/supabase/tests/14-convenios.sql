\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages to notice;

-- Basico gratis y convenio del Festival (migracion 000051): un codigo para
-- todos, acotado por fechas; Premier gratis hasta una fecha, y al vencer se
-- baja a Basico sin ocultar nada.
--
-- Va dentro de una transaccion que se deshace al final: no deja nada atras, asi
-- que corre tambien contra una base con datos.

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

-- ---------------------------------------------------------------- datos
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('c1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'convenio-a@prueba.mx', 'x', now(),
   '{}', '{"nombre":"Ana Convenio","rol":"negocio"}', now(), now()),
  ('c1000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'convenio-b@prueba.mx', 'x', now(),
   '{}', '{"nombre":"Beto Convenio","rol":"negocio"}', now(), now());

update public.perfiles set correo_verificado_en = now()
 where id in ('c1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002');

insert into public.marcas (id, perfil_id, nombre_comercial, categoria_id)
select v.id, v.perfil, v.nombre, c.id
  from (values
    ('c2000000-0000-0000-0000-000000000001'::uuid, 'c1000000-0000-0000-0000-000000000001'::uuid, 'Cacao de Ana'),
    ('c2000000-0000-0000-0000-000000000002'::uuid, 'c1000000-0000-0000-0000-000000000002'::uuid, 'Cacao de Beto')
  ) as v(id, perfil, nombre)
  cross join (select id from public.categorias where slug = 'chocolateria') c;

insert into public.productos_servicios (marca_id, nombre)
values ('c2000000-0000-0000-0000-000000000001', 'Barra 70%'),
       ('c2000000-0000-0000-0000-000000000002', 'Barra 70%');

-- Micrositio completo, o publicar lo frenaria por otra razon.
insert into public.sucursales (id, marca_id, nombre_sucursal, slug, entidad, estado, acerca_de, logo)
values ('c3000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001',
        'Matriz', 'convenio-prueba-ana', 'Tabasco', 'borrador', 'Cacao de Comalcalco', 'logo.png'),
       ('c3000000-0000-0000-0000-000000000002', 'c2000000-0000-0000-0000-000000000002',
        'Matriz', 'convenio-prueba-beto', 'Tabasco', 'borrador', 'Cacao de Cunduacan', 'logo.png');

insert into public.productos_sucursal (producto_id, sucursal_id)
select p.id, s.id
  from public.productos_servicios p
  join public.sucursales s on s.marca_id = p.marca_id
 where s.id in ('c3000000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-000000000002');

insert into public.convenios (id, codigo, descripcion, vigente_desde, vigente_hasta, premier_gratis_hasta)
values ('c4000000-0000-0000-0000-000000000001', 'PRUEBAVIGENTE', 'Vigente', current_date - 10, current_date + 10, current_date + 40),
       ('c4000000-0000-0000-0000-000000000002', 'PRUEBAVENCIDO', 'Vencido', current_date - 60, current_date - 30, current_date - 30),
       ('c4000000-0000-0000-0000-000000000003', 'PRUEBAFUTURO',  'Futuro',  current_date + 30, current_date + 60, current_date + 60);

\echo '--- el Basico es gratis ---'
select precio_mensual = 0 as basico_gratis from public.tiers order by precio_mensual limit 1;

\echo '--- el codigo se compara sin espacios, guiones ni minusculas ---'
select public.normalizar_codigo(' festival-chocolate ') = 'FESTIVALCHOCOLATE' as normaliza;

select pg_temp.debe_fallar('un codigo en minusculas no se puede guardar tal cual',
  $q$ insert into public.convenios (codigo, descripcion, vigente_desde, vigente_hasta, premier_gratis_hasta)
      values ('minusculas', 'x', current_date, current_date, current_date) $q$);

-- ---------------------------------------------------------------- Beto
set local role authenticated;
set local request.jwt.claims to '{"sub":"c1000000-0000-0000-0000-000000000002","role":"authenticated"}';

\echo '--- un negocio no ve la lista de codigos ---'
select count(*) = 0 as no_ve_codigos from public.convenios;

select pg_temp.debe_fallar('un codigo inventado no existe',
  $q$ select public.revisar_convenio('NOEXISTE') $q$);
select pg_temp.debe_fallar('un codigo vencido ya no sirve',
  $q$ select public.revisar_convenio('pruebavencido') $q$);
select pg_temp.debe_fallar('un codigo que no empieza todavia no sirve',
  $q$ select public.revisar_convenio('PRUEBA-FUTURO') $q$);
select pg_temp.debe_pasar('el vigente sirve, escrito como sea',
  $q$ select public.revisar_convenio(' prueba vigente ') $q$);

select pg_temp.debe_fallar('no se cuela un convenio vencido por la puerta de atras',
  $q$ insert into public.suscripciones (sucursal_id, tier_id, monto_mensual, estado, fecha_proximo_cobro, convenio_id)
      values ('c3000000-0000-0000-0000-000000000002', 3, 299, 'trial', now() + interval '1 month',
              'c4000000-0000-0000-0000-000000000002') $q$);

-- ---------------------------------------------------------------- Ana
set local request.jwt.claims to '{"sub":"c1000000-0000-0000-0000-000000000001","role":"authenticated"}';

-- Manda Basico, $299 y estado activo: el trigger lo deja en Premier gratis.
insert into public.suscripciones (sucursal_id, tier_id, monto_mensual, estado, fecha_proximo_cobro, convenio_id)
values ('c3000000-0000-0000-0000-000000000001', 1, 299, 'activo', now() + interval '1 month',
        'c4000000-0000-0000-0000-000000000001');

update public.sucursales set estado = 'publicado', tier_id = 3
 where id = 'c3000000-0000-0000-0000-000000000001';

select pg_temp.debe_fallar('Ana no puede pasarse a otro plan con el convenio puesto',
  $q$ update public.suscripciones set tier_id = 1
      where sucursal_id = 'c3000000-0000-0000-0000-000000000001' $q$);

-- ---------------------------------------------------------------- Beto, el mismo codigo
set local request.jwt.claims to '{"sub":"c1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select pg_temp.debe_pasar('Beto usa el mismo codigo que Ana',
  $q$ insert into public.suscripciones (sucursal_id, tier_id, monto_mensual, estado, fecha_proximo_cobro, convenio_id)
      values ('c3000000-0000-0000-0000-000000000002', 3, 299, 'trial', now() + interval '1 month',
              'c4000000-0000-0000-0000-000000000001') $q$);

reset role;

\echo '--- la base pone Premier, gratis, hasta el dia siguiente al fin del convenio ---'
select s.tier_id = (select id from public.tiers where en_banner_principal order by precio_mensual desc limit 1) as premier,
       s.monto_mensual = 0 as gratis,
       s.estado = 'trial' as en_prueba,
       (s.fecha_fin_trial at time zone 'America/Mexico_City')::date = current_date + 41 as hasta_el_dia_siguiente
  from public.suscripciones s
 where s.sucursal_id = 'c3000000-0000-0000-0000-000000000001';

-- Ya publicada, el codigo vence: lo prometido se respeta.
update public.convenios set vigente_desde = current_date - 20, vigente_hasta = current_date - 1
 where id = 'c4000000-0000-0000-0000-000000000001';

set local role authenticated;
set local request.jwt.claims to '{"sub":"c1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select pg_temp.debe_pasar('al vencer el codigo, la suscripcion de Ana sigue en pie',
  $q$ update public.suscripciones set fecha_proximo_cobro = now() + interval '2 months'
      where sucursal_id = 'c3000000-0000-0000-0000-000000000001' $q$);

select pg_temp.debe_fallar('un negocio no puede correr la bajada de planes',
  $q$ select public.vencer_pruebas() $q$);

reset role;

-- Termina el Premier gratis.
update public.suscripciones set fecha_fin_trial = now() - interval '1 minute'
 where sucursal_id = 'c3000000-0000-0000-0000-000000000001' and estado = 'trial';

select public.vencer_pruebas() >= 1 as bajo_alguna;

\echo '--- al vencer, Ana baja a Basico gratis y sigue publicada ---'
select su.tier_id = (select id from public.tiers order by precio_mensual limit 1) as en_basico,
       su.estado = 'publicado' as sigue_publicada,
       (select count(*) from public.suscripciones x
         where x.sucursal_id = su.id and x.estado = 'activo' and x.monto_mensual = 0) = 1 as una_gratis_viva,
       (select count(*) from public.suscripciones x
         where x.sucursal_id = su.id and x.estado = 'cancelado' and x.convenio_id is not null) = 1 as convenio_en_historial
  from public.sucursales su
 where su.id = 'c3000000-0000-0000-0000-000000000001';

rollback;
