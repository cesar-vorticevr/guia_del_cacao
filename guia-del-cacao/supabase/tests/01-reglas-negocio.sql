\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages to notice;

-- Helper: ejecuta SQL que DEBE fallar y reporta el resultado.
create or replace function pg_temp.debe_fallar(etiqueta text, sentencia text)
returns void language plpgsql as $$
begin
  execute sentencia;
  raise notice 'FALLA  %  -> se permitio y no debia', etiqueta;
exception when others then
  raise notice 'OK     %  -> bloqueado: %', etiqueta, sqlerrm;
end $$;

-- ---------------------------------------------------------------- usuarios
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'cliente@prueba.mx', 'x', now(),
   '{}', '{"nombre":"Ana Cliente","rol":"cliente"}', now(), now()),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'negocio@prueba.mx', 'x', now(),
   '{}', '{"nombre":"Beto Negocio","rol":"negocio"}', now(), now()),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'hacker@prueba.mx', 'x', now(),
   '{}', '{"nombre":"Colado","rol":"admin"}', now(), now());

\echo '--- perfiles creados por el trigger (el que pidio rol admin debe quedar cliente) ---'
select nombre, rol from public.perfiles order by nombre;

-- ---------------------------------------------------------------- marca
insert into public.marcas (id, perfil_id, nombre_comercial, categoria_id)
select '44444444-4444-4444-4444-444444444444',
       '22222222-2222-2222-2222-222222222222',
       'Chocolates Grijalva', id
  from public.categorias where slug = 'chocolateria';

insert into public.sucursales (id, marca_id, nombre_sucursal, slug, tier_id, estado)
values ('55555555-5555-5555-5555-555555555555',
        '44444444-4444-4444-4444-444444444444',
        'Matriz Villahermosa', 'chocolates-grijalva-matriz', 1, 'borrador');

update public.sucursales set estado = 'publicado'
 where id = '55555555-5555-5555-5555-555555555555';

\echo '--- fecha_publicacion se sella sola al publicar ---'
select estado, fecha_publicacion is not null as tiene_fecha
  from public.sucursales where id = '55555555-5555-5555-5555-555555555555';

-- ---------------------------------------------------------------- tier 1
\echo '--- reglas de Tier 1 ---'
select pg_temp.debe_fallar('Tier 1 publica evento', $q$
  insert into public.eventos (sucursal_id, titulo, contenido, fecha_evento)
  values ('55555555-5555-5555-5555-555555555555', 'Cata', 'texto', now() + interval '3 days')
$q$);

select pg_temp.debe_fallar('Tier 1 recibe solicitud de puntos', $q$
  insert into public.solicitudes_puntos (usuario_id, sucursal_id)
  values ('11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555')
$q$);

select pg_temp.debe_fallar('Tier 1 entra al banner', $q$
  insert into public.banners (sucursal_id, imagen) values ('55555555-5555-5555-5555-555555555555', 'x.jpg')
$q$);

-- ---------------------------------------------------------------- tier 3
update public.sucursales set tier_id = 3 where id = '55555555-5555-5555-5555-555555555555';

\echo '--- reglas de Tier 3 ---'
insert into public.eventos (sucursal_id, titulo, contenido, fecha_evento)
values ('55555555-5555-5555-5555-555555555555', 'Cata de origen', 'texto', now() + interval '3 days');
\echo 'OK     Tier 3 publica evento'

select pg_temp.debe_fallar('Segundo evento en la misma semana', $q$
  insert into public.eventos (sucursal_id, titulo, contenido, fecha_evento)
  values ('55555555-5555-5555-5555-555555555555', 'Otra cata', 'texto', now() + interval '3 days')
$q$);

-- ---------------------------------------------------------------- puntos
\echo '--- pasaporte de puntos ---'
insert into public.solicitudes_puntos (id, usuario_id, sucursal_id)
values ('66666666-6666-6666-6666-666666666666',
        '11111111-1111-1111-1111-111111111111',
        '55555555-5555-5555-5555-555555555555');
\echo 'OK     solicitud creada'

select pg_temp.debe_fallar('Segunda solicitud con una pendiente', $q$
  insert into public.solicitudes_puntos (usuario_id, sucursal_id)
  values ('11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555')
$q$);

update public.solicitudes_puntos
   set estado = 'aprobada', puntos_otorgados = 3, fecha_resolucion = now()
 where id = '66666666-6666-6666-6666-666666666666';
\echo 'OK     solicitud aprobada con 3 puntos'

select 'puntos y rango tras aprobar' as prueba, puntos_acumulados, rango_actual
  from public.rangos_usuario where usuario_id = '11111111-1111-1111-1111-111111111111';

insert into public.solicitudes_puntos (id, usuario_id, sucursal_id)
values ('77777777-7777-7777-7777-777777777777',
        '11111111-1111-1111-1111-111111111111',
        '55555555-5555-5555-5555-555555555555');

select pg_temp.debe_fallar('Cuarto punto del mismo dia a la misma marca', $q$
  update public.solicitudes_puntos
     set estado = 'aprobada', puntos_otorgados = 1, fecha_resolucion = now()
   where id = '77777777-7777-7777-7777-777777777777'
$q$);

-- ---------------------------------------------------------------- RLS
\echo '--- RLS: que ve el visitante anonimo ---'
create table if not exists pg_temp.nada();

insert into public.sucursales (id, marca_id, nombre_sucursal, slug, tier_id, estado)
values ('88888888-8888-8888-8888-888888888888',
        '44444444-4444-4444-4444-444444444444',
        'Sucursal en borrador', 'grijalva-borrador', 1, 'borrador');

set local role anon;
select 'sucursales visibles para anon' as prueba, count(*) from public.sucursales;
select 'suscripciones visibles para anon' as prueba, count(*) from public.suscripciones;
select 'rangos visibles para anon' as prueba, count(*) from public.rangos_usuario;
reset role;

\echo '--- RLS: el cliente ve lo suyo ---'
set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select 'perfiles visibles para el cliente' as prueba, count(*) from public.perfiles;
select 'su propio rango' as prueba, count(*) from public.rangos_usuario;
select 'suscripciones ajenas' as prueba, count(*) from public.suscripciones;
reset role;
