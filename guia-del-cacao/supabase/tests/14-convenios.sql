\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages to notice;

-- Convenio con Turismo (migracion 000051): un codigo para todos, acotado por
-- fechas, y el precio lo pone la base.
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

insert into public.convenios (id, codigo, descripcion, vigente_desde, vigente_hasta)
values ('c4000000-0000-0000-0000-000000000001', 'PRUEBAVIGENTE', 'Vigente', current_date - 10, current_date + 10),
       ('c4000000-0000-0000-0000-000000000002', 'PRUEBAVENCIDO', 'Vencido', current_date - 60, current_date - 30),
       ('c4000000-0000-0000-0000-000000000003', 'PRUEBAFUTURO',  'Futuro',  current_date + 30, current_date + 60);

\echo '--- el codigo se compara sin espacios, guiones ni minusculas ---'
select public.normalizar_codigo(' festival-chocolate ') = 'FESTIVALCHOCOLATE' as normaliza;

select pg_temp.debe_fallar('un codigo en minusculas no se puede guardar tal cual',
  $q$ insert into public.convenios (codigo, descripcion, vigente_desde, vigente_hasta)
      values ('minusculas', 'x', current_date, current_date) $q$);

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

select pg_temp.debe_fallar('el convenio no deja elegir otro plan que Premier',
  $q$ insert into public.suscripciones (sucursal_id, tier_id, monto_mensual, estado, fecha_proximo_cobro, convenio_id)
      values ('c3000000-0000-0000-0000-000000000002', 1, 99, 'trial', now() + interval '1 month',
              'c4000000-0000-0000-0000-000000000001') $q$);

-- ---------------------------------------------------------------- Ana
set local request.jwt.claims to '{"sub":"c1000000-0000-0000-0000-000000000001","role":"authenticated"}';

-- Manda 299: el trigger tiene que dejarlo en 99.
insert into public.suscripciones (sucursal_id, tier_id, monto_mensual, estado, fecha_proximo_cobro, convenio_id)
values ('c3000000-0000-0000-0000-000000000001', 3, 299, 'trial', now() + interval '1 month',
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

\echo '--- el precio lo pone la base y los tres meses arrancan tras la prueba ---'
select monto_mensual = 99 as precio_99,
       fecha_fin_trial is not null as prueba_arranco,
       precio_convenio_hasta::date = (fecha_fin_trial + interval '3 months')::date as tres_meses
  from public.suscripciones
 where sucursal_id = 'c3000000-0000-0000-0000-000000000001';

-- Ya publicada, el codigo vence: los tres meses prometidos se respetan.
update public.convenios set vigente_desde = current_date - 20, vigente_hasta = current_date - 1
 where id = 'c4000000-0000-0000-0000-000000000001';

set local role authenticated;
set local request.jwt.claims to '{"sub":"c1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select pg_temp.debe_pasar('al vencer el codigo, la suscripcion de Ana sigue en pie',
  $q$ update public.suscripciones set fecha_proximo_cobro = now() + interval '2 months'
      where sucursal_id = 'c3000000-0000-0000-0000-000000000001' $q$);

reset role;

rollback;
