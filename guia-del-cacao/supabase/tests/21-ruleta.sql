\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages to notice;

-- La Ruleta Magica y los negocios de demostracion (migracion 000060).
--
-- Solo con plan Pro; el resultado lo pone la base; una vez es una vez y una
-- al dia es una al dia; el negocio no gira la suya; cada quien ve sus premios;
-- solo el negocio que lo dio canjea un codigo, y una sola vez; y nadie se
-- marca como demo solo.
--
-- Dentro de una transaccion que se deshace.

begin;

create or replace function pg_temp.debe_fallar(etiqueta text, sentencia text)
returns void language plpgsql as $$
begin
  execute sentencia;
  raise notice 'FALLA  %  -> se permitio y no debia', etiqueta;
exception when others then
  raise notice 'OK     %  -> bloqueado: %', etiqueta, sqlerrm;
end $$;

create or replace function pg_temp.debe_ser(etiqueta text, valor boolean)
returns void language plpgsql as $$
begin
  if valor then raise notice 'OK     %', etiqueta;
  else raise notice 'FALLA  %', etiqueta; end if;
end $$;

-- ---------------------------------------------------------------- datos
-- 1 negocio Pro, 2 negocio Gratis, 3 clienta, 4 otra clienta.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('f2100000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ruleta-pro@prueba.mx', 'x', now(),
   '{}', '{"nombre":"Pro","rol":"negocio"}', now(), now()),
  ('f2100000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ruleta-gratis@prueba.mx', 'x', now(),
   '{}', '{"nombre":"Gratis","rol":"negocio"}', now(), now()),
  ('f2100000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ruleta-clienta@prueba.mx', 'x', now(),
   '{}', '{"nombre":"Clienta","rol":"cliente"}', now(), now()),
  ('f2100000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ruleta-otra@prueba.mx', 'x', now(),
   '{}', '{"nombre":"Otra","rol":"cliente"}', now(), now());

update public.perfiles set correo_verificado_en = now(), rol_confirmado = true
 where id::text like 'f2100000-%';

insert into public.marcas (id, perfil_id, nombre_comercial, categoria_id)
select v.id::uuid, v.perfil::uuid, v.nombre, c.id
  from (values
    ('f2200000-0000-0000-0000-000000000001', 'f2100000-0000-0000-0000-000000000001', 'Mazorca Pro'),
    ('f2200000-0000-0000-0000-000000000002', 'f2100000-0000-0000-0000-000000000002', 'Grano Gratis')
  ) as v (id, perfil, nombre)
  cross join (select id from public.categorias where slug = 'chocolateria') c;

insert into public.productos_servicios (marca_id, nombre)
values ('f2200000-0000-0000-0000-000000000001', 'Barra'),
       ('f2200000-0000-0000-0000-000000000002', 'Barra');

insert into public.sucursales (id, marca_id, nombre_sucursal, slug, entidad, estado, acerca_de, logo, tier_id)
values
  ('f2300000-0000-0000-0000-000000000001', 'f2200000-0000-0000-0000-000000000001',
   'Centro', 'ruleta-pro', 'Tabasco', 'publicado', 'Cacao', 'logo.png', 3),
  ('f2300000-0000-0000-0000-000000000002', 'f2200000-0000-0000-0000-000000000002',
   'Centro', 'ruleta-gratis', 'Tabasco', 'publicado', 'Cacao', 'logo.png', 1);

insert into public.suscripciones (sucursal_id, tier_id, monto_mensual, estado, fecha_proximo_cobro)
values ('f2300000-0000-0000-0000-000000000001', 3, 0, 'activo', now() + interval '1 month'),
       ('f2300000-0000-0000-0000-000000000002', 1, 0, 'trial', now() + interval '1 month');

-- ---------------------------------------------------------------- el negocio arma su ruleta
set local role authenticated;
set local request.jwt.claims to '{"sub":"f2100000-0000-0000-0000-000000000002","role":"authenticated"}';

select pg_temp.debe_fallar('sin plan Pro no hay ruleta',
  $q$ insert into public.ruletas (sucursal_id) values ('f2300000-0000-0000-0000-000000000002') $q$);
select pg_temp.debe_fallar('no se arma la ruleta de otro',
  $q$ insert into public.ruletas (sucursal_id) values ('f2300000-0000-0000-0000-000000000001') $q$);
select pg_temp.debe_fallar('nadie se marca como demo solo',
  $q$ update public.marcas set es_demo = true where id = 'f2200000-0000-0000-0000-000000000002' $q$);

reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub":"f2100000-0000-0000-0000-000000000001","role":"authenticated"}';

insert into public.ruletas (sucursal_id, frecuencia, vigencia_dias)
values ('f2300000-0000-0000-0000-000000000001', 'una_vez', 30);

insert into public.premios_ruleta (sucursal_id, orden, texto, probabilidad) values
  ('f2300000-0000-0000-0000-000000000001', 1, '10% de descuento', 60),
  ('f2300000-0000-0000-0000-000000000001', 2, 'Bebida gratis', 30),
  ('f2300000-0000-0000-0000-000000000001', 3, 'Caja de trufas', 10);

select pg_temp.debe_fallar('no hay un cuarto premio',
  $q$ insert into public.premios_ruleta (sucursal_id, orden, texto, probabilidad)
      values ('f2300000-0000-0000-0000-000000000001', 4, 'Otro', 10) $q$);

select pg_temp.debe_fallar('el negocio no gira su propia ruleta',
  $q$ select * from public.girar_ruleta('f2300000-0000-0000-0000-000000000001') $q$);

reset role;

select pg_temp.debe_ser('la sucursal Pro sale entre las que tienen ruleta',
  'f2300000-0000-0000-0000-000000000001' in (select public.sucursales_con_ruleta())
  and 'f2300000-0000-0000-0000-000000000002' not in (select public.sucursales_con_ruleta()));

-- ---------------------------------------------------------------- la clienta gira
set local role authenticated;
set local request.jwt.claims to '{"sub":"f2100000-0000-0000-0000-000000000003","role":"authenticated"}';

select codigo, premio, vence_en from public.girar_ruleta('f2300000-0000-0000-0000-000000000001') \gset

select pg_temp.debe_ser('gana uno de los tres premios: ' || :'premio',
  :'premio' in ('10% de descuento', 'Bebida gratis', 'Caja de trufas'));
select pg_temp.debe_ser('el codigo empieza por la marca: ' || :'codigo', :'codigo' like 'MAZ-_____');
select pg_temp.debe_ser('vale 30 dias',
  :'vence_en'::date = (now() at time zone 'America/Mexico_City')::date + 30);

select pg_temp.debe_fallar('una vez es una vez',
  $q$ select * from public.girar_ruleta('f2300000-0000-0000-0000-000000000001') $q$);

select pg_temp.debe_fallar('no se escribe un giro a mano',
  $q$ insert into public.giros (sucursal_id, usuario_id, orden, premio, codigo, vence_en)
      values ('f2300000-0000-0000-0000-000000000001', 'f2100000-0000-0000-0000-000000000003', 3, 'Caja de trufas', 'X-1', current_date + 99) $q$);

select pg_temp.debe_fallar('no se canjea su propio premio',
  format($q$ select * from public.canjear_premio(%L) $q$, :'codigo'));

select pg_temp.debe_ser('lo ve en sus premios',
  (select count(*) from public.mis_premios()) = 1);

reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub":"f2100000-0000-0000-0000-000000000004","role":"authenticated"}';

select pg_temp.debe_ser('la otra clienta no ve premios ajenos',
  (select count(*) from public.giros) = 0 and (select count(*) from public.mis_premios()) = 0);

reset role;

-- ---------------------------------------------------------------- una al dia
update public.ruletas set frecuencia = 'diaria'
 where sucursal_id = 'f2300000-0000-0000-0000-000000000001';

set local role authenticated;
set local request.jwt.claims to '{"sub":"f2100000-0000-0000-0000-000000000004","role":"authenticated"}';

select count(*) as un_giro from public.girar_ruleta('f2300000-0000-0000-0000-000000000001') \gset
select pg_temp.debe_fallar('una al dia es una al dia',
  $q$ select * from public.girar_ruleta('f2300000-0000-0000-0000-000000000001') $q$);

reset role;

update public.ruletas set frecuencia = 'ilimitada'
 where sucursal_id = 'f2300000-0000-0000-0000-000000000001';

set local role authenticated;
set local request.jwt.claims to '{"sub":"f2100000-0000-0000-0000-000000000004","role":"authenticated"}';
select count(*) as otro from public.girar_ruleta('f2300000-0000-0000-0000-000000000001') \gset
select pg_temp.debe_ser('sin limite se puede volver a girar', :'otro'::int = 1);
reset role;

-- ---------------------------------------------------------------- el negocio canjea
set local role authenticated;
set local request.jwt.claims to '{"sub":"f2100000-0000-0000-0000-000000000002","role":"authenticated"}';
select pg_temp.debe_fallar('otro negocio no canjea codigos ajenos',
  format($q$ select * from public.canjear_premio(%L) $q$, :'codigo'));
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub":"f2100000-0000-0000-0000-000000000001","role":"authenticated"}';

select premio as canjeado from public.canjear_premio(lower(replace(:'codigo', '-', ''))) \gset
select pg_temp.debe_ser('el negocio lo canjea escrito como sea', :'canjeado' = :'premio');

select pg_temp.debe_fallar('no se canjea dos veces',
  format($q$ select * from public.canjear_premio(%L) $q$, :'codigo'));

select pg_temp.debe_ser('el negocio ve lo que repartio, con nombre',
  (select count(*) from public.premios_entregados('f2300000-0000-0000-0000-000000000001')
    where cliente in ('Clienta', 'Otra')) = 3);

reset role;

rollback;
