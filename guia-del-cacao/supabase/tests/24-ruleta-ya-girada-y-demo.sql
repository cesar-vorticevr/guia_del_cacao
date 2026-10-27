\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages to notice;

-- La ruleta ya girada y la de la demo (000064).
--
-- `mi_giro_en` dice si quien mira ya giro y si le toca otra vez: «una vez»
-- nunca vuelve, «al dia» vuelve mañana, «sin limite» siempre. La ruleta de un
-- negocio de demostracion gira siempre, la puede girar su dueño, contesta con
-- un codigo de muestra y no guarda ningun giro.
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
  if valor then raise notice 'OK     %', etiqueta; else raise notice 'FALLA  %', etiqueta; end if;
end $$;

-- 1 negocio real con ruleta, 2 negocio demo con ruleta, 3 cliente.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('f2600000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'girada-uno@prueba.mx', 'x', now(),
   '{}', '{"nombre":"Uno","rol":"negocio"}', now(), now()),
  ('f2600000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'girada-demo@prueba.mx', 'x', now(),
   '{}', '{"nombre":"Demo","rol":"negocio"}', now(), now()),
  ('f2600000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'girada-cliente@prueba.mx', 'x', now(),
   '{}', '{"nombre":"Clienta","rol":"cliente"}', now(), now());

update public.perfiles set correo_verificado_en = now(), rol_confirmado = true
 where id::text like 'f2600000-%';

insert into public.marcas (id, perfil_id, nombre_comercial, categoria_id)
select v.id::uuid, v.perfil::uuid, v.nombre, c.id
  from (values
    ('f2700000-0000-0000-0000-0000000000c1', 'f2600000-0000-0000-0000-0000000000c1', 'Uno Girada'),
    ('f2700000-0000-0000-0000-0000000000c2', 'f2600000-0000-0000-0000-0000000000c2', 'Demo Girada')
  ) as v (id, perfil, nombre)
  cross join (select id from public.categorias where slug = 'chocolateria') c;

update public.marcas set es_demo = true where id = 'f2700000-0000-0000-0000-0000000000c2';

insert into public.productos_servicios (marca_id, nombre)
values ('f2700000-0000-0000-0000-0000000000c1', 'Barra'), ('f2700000-0000-0000-0000-0000000000c2', 'Barra');

insert into public.sucursales (id, marca_id, nombre_sucursal, slug, entidad, estado, acerca_de, logo, tier_id)
values
  ('f2800000-0000-0000-0000-0000000000c1', 'f2700000-0000-0000-0000-0000000000c1',
   'Centro', 'girada-uno', 'Tabasco', 'publicado', 'Cacao', 'logo.png', 3),
  ('f2800000-0000-0000-0000-0000000000c2', 'f2700000-0000-0000-0000-0000000000c2',
   'Centro', 'girada-demo', 'Tabasco', 'publicado', 'Cacao', 'logo.png', 3);

insert into public.suscripciones (sucursal_id, tier_id, monto_mensual, estado, fecha_proximo_cobro)
values ('f2800000-0000-0000-0000-0000000000c1', 3, 0, 'activo', now() + interval '1 month'),
       ('f2800000-0000-0000-0000-0000000000c2', 3, 0, 'activo', now() + interval '1 month');

-- Las dos «una vez por persona», con un premio seguro.
insert into public.ruletas (sucursal_id, frecuencia, relleno)
values ('f2800000-0000-0000-0000-0000000000c1', 'una_vez', 'repetir'),
       ('f2800000-0000-0000-0000-0000000000c2', 'una_vez', 'repetir');
insert into public.premios_ruleta (sucursal_id, orden, texto, probabilidad, es_premio) values
  ('f2800000-0000-0000-0000-0000000000c1', 1, 'Trufa', 100, true),
  ('f2800000-0000-0000-0000-0000000000c2', 1, 'Trufa demo', 100, true);

-- ---------------------------------------------------------------- la clienta, en el negocio real
set local role authenticated;
set local request.jwt.claims to '{"sub":"f2600000-0000-0000-0000-0000000000c3","role":"authenticated"}';

select pg_temp.debe_ser('sin girar, mi_giro_en no trae nada',
  (select count(*) from public.mi_giro_en('f2800000-0000-0000-0000-0000000000c1')) = 0);

select codigo as codigo_real from public.girar_ruleta('f2800000-0000-0000-0000-0000000000c1') \gset

select pg_temp.debe_ser('ya giro: trae su premio con su codigo y no le toca otra vez',
  (select premio = 'Trufa' and es_premio and codigo = :'codigo_real' and not puede_girar
     from public.mi_giro_en('f2800000-0000-0000-0000-0000000000c1')));

select pg_temp.debe_fallar('una vez es una vez',
  $q$ select * from public.girar_ruleta('f2800000-0000-0000-0000-0000000000c1') $q$);

reset role;

-- «Al dia»: el giro de ayer deja volver; el de hoy no.
update public.ruletas set frecuencia = 'diaria' where sucursal_id = 'f2800000-0000-0000-0000-0000000000c1';
set local role authenticated;
set local request.jwt.claims to '{"sub":"f2600000-0000-0000-0000-0000000000c3","role":"authenticated"}';
select pg_temp.debe_ser('al dia: hoy ya no',
  (select not puede_girar from public.mi_giro_en('f2800000-0000-0000-0000-0000000000c1')));
reset role;

update public.giros set creado_en = now() - interval '2 days'
 where sucursal_id = 'f2800000-0000-0000-0000-0000000000c1';
set local role authenticated;
set local request.jwt.claims to '{"sub":"f2600000-0000-0000-0000-0000000000c3","role":"authenticated"}';
select pg_temp.debe_ser('al dia: lo de antier deja volver',
  (select puede_girar from public.mi_giro_en('f2800000-0000-0000-0000-0000000000c1')));
reset role;

-- Sin limite: con el premio ya canjeado (desde la 000066, uno vigente sin
-- canjear manda a la ruleta de cacao; eso lo prueba 25).
update public.ruletas set frecuencia = 'ilimitada' where sucursal_id = 'f2800000-0000-0000-0000-0000000000c1';
update public.giros set canjeado_en = now() where sucursal_id = 'f2800000-0000-0000-0000-0000000000c1';
set local role authenticated;
set local request.jwt.claims to '{"sub":"f2600000-0000-0000-0000-0000000000c3","role":"authenticated"}';
select pg_temp.debe_ser('sin limite: siempre puede',
  (select puede_girar from public.mi_giro_en('f2800000-0000-0000-0000-0000000000c1')));

-- ---------------------------------------------------------------- la demo
create temp table tiros_demo as
  select * from public.girar_ruleta('f2800000-0000-0000-0000-0000000000c2')
  union all select * from public.girar_ruleta('f2800000-0000-0000-0000-0000000000c2')
  union all select * from public.girar_ruleta('f2800000-0000-0000-0000-0000000000c2');

select pg_temp.debe_ser('la demo gira aunque sea «una vez», con codigo de muestra',
  (select count(*) = 3 and bool_and(codigo = 'DEMO-MUESTRA') from tiros_demo));

select pg_temp.debe_ser('la demo no deja premios en la cuenta',
  (select count(*) from public.mis_premios() where codigo = 'DEMO-MUESTRA') = 0);

reset role;

-- Su dueño tambien la gira (es para enseñarla), y tampoco se guarda.
set local role authenticated;
set local request.jwt.claims to '{"sub":"f2600000-0000-0000-0000-0000000000c2","role":"authenticated"}';
select pg_temp.debe_ser('el dueño de la demo la gira',
  (select codigo = 'DEMO-MUESTRA' from public.girar_ruleta('f2800000-0000-0000-0000-0000000000c2')));
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub":"f2600000-0000-0000-0000-0000000000c1","role":"authenticated"}';
select pg_temp.debe_fallar('el dueño de un negocio real no gira la suya',
  $q$ select * from public.girar_ruleta('f2800000-0000-0000-0000-0000000000c1') $q$);
reset role;

select pg_temp.debe_ser('ningun giro guardado en la demo',
  (select count(*) from public.giros where sucursal_id = 'f2800000-0000-0000-0000-0000000000c2') = 0);

rollback;
