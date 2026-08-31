\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages to notice;

-- Eventos y noticias son del plan que los incluye (migracion 000028).
--
-- Lo que hay que dejar demostrado es que bajar de plan **no borra nada**: el
-- publico deja de verlo, el dueno lo sigue viendo, no lo puede editar, y al
-- volver a subir vuelve a verse. Las negativas son las importantes: es donde
-- estaba el agujero antes de la migracion, cuando `puede_publicar_contenido`
-- no lo comprobaba nadie.

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
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'negocio@prueba.mx', 'x', now(),
   '{}', '{"nombre":"Beto Negocio","rol":"negocio"}', now(), now());

insert into public.marcas (id, perfil_id, nombre_comercial, categoria_id)
select '44444444-4444-4444-4444-444444444444',
       '22222222-2222-2222-2222-222222222222',
       'Chocolates Grijalva', id
  from public.categorias where slug = 'chocolateria';

insert into public.sucursales (id, marca_id, nombre_sucursal, slug, tier_id, estado)
values ('55555555-5555-5555-5555-555555555555',
        '44444444-4444-4444-4444-444444444444',
        'Matriz', 'grijalva-matriz', 3, 'publicado');

-- Premier: el plan que incluye publicar.
insert into public.suscripciones (marca_id, sucursal_id, tier_id, estado, monto_mensual, fecha_proximo_cobro)
values ('44444444-4444-4444-4444-444444444444',
        '55555555-5555-5555-5555-555555555555',
        3, 'activo', 399, now() + interval '30 days');

\echo '--- con Premier, marca_publica_contenido es cierto ---'
select public.marca_publica_contenido('55555555-5555-5555-5555-555555555555') as publica;

insert into public.eventos (id, sucursal_id, titulo, contenido, fecha_evento)
values ('66666666-6666-6666-6666-666666666666',
        '55555555-5555-5555-5555-555555555555',
        'Cata de temporada', 'Contenido', now() + interval '10 days');

insert into public.noticias (id, sucursal_id, titulo, contenido)
values ('77777777-7777-7777-7777-777777777777',
        '55555555-5555-5555-5555-555555555555',
        'Abrimos los domingos', 'Contenido');

-- ------------------------------------------------------- se baja a Plus
update public.suscripciones set tier_id = 2
 where marca_id = '44444444-4444-4444-4444-444444444444';

\echo '--- con Plus ya no publica ---'
select public.marca_publica_contenido('55555555-5555-5555-5555-555555555555') as publica;

\echo '--- lo que NO se puede hacer sin el plan ---'
select pg_temp.debe_fallar('crear evento sin plan', $$
  insert into public.eventos (sucursal_id, titulo, contenido, fecha_evento)
  values ('55555555-5555-5555-5555-555555555555', 'Otra cata', 'x', now() + interval '3 days')
$$);

select pg_temp.debe_fallar('editar evento sin plan', $$
  update public.eventos set titulo = 'Cambiado'
   where id = '66666666-6666-6666-6666-666666666666'
$$);

select pg_temp.debe_fallar('cancelar evento sin plan', $$
  update public.eventos set cancelado_en = now()
   where id = '66666666-6666-6666-6666-666666666666'
$$);

select pg_temp.debe_fallar('crear noticia sin plan', $$
  insert into public.noticias (sucursal_id, titulo, contenido)
  values ('55555555-5555-5555-5555-555555555555', 'Otra noticia', 'x')
$$);

\echo '--- pero nada se borro ---'
select
  (select count(*) from public.eventos  where id = '66666666-6666-6666-6666-666666666666') as evento,
  (select count(*) from public.noticias where id = '77777777-7777-7777-7777-777777777777') as noticia;

-- --------------------------------------------------- quien lo ve y quien no
-- `set local` solo surte efecto dentro de una transaccion, y como `postgres` es
-- superusuario hay que cambiar de rol de verdad o la prueba pasaria sin
-- comprobar ninguna politica.
begin;
set local role anon;
\echo '--- el publico no ve lo de una marca que bajo de plan ---'
select
  (select count(*) from public.eventos  where id = '66666666-6666-6666-6666-666666666666') as evento_visible,
  (select count(*) from public.noticias where id = '77777777-7777-7777-7777-777777777777') as noticia_visible;
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
\echo '--- el dueno si lo ve: es lo que le deja saber que esta oculto ---'
select
  (select count(*) from public.eventos  where id = '66666666-6666-6666-6666-666666666666') as evento_visible,
  (select count(*) from public.noticias where id = '77777777-7777-7777-7777-777777777777') as noticia_visible;
rollback;

-- ------------------------------------------------------ vuelve a Premier
update public.suscripciones set tier_id = 3
 where marca_id = '44444444-4444-4444-4444-444444444444';

begin;
set local role anon;
\echo '--- al volver a subir, el publico lo ve otra vez ---'
select
  (select count(*) from public.eventos  where id = '66666666-6666-6666-6666-666666666666') as evento_visible,
  (select count(*) from public.noticias where id = '77777777-7777-7777-7777-777777777777') as noticia_visible;
rollback;

\echo '--- y ya se puede volver a editar ---'
update public.eventos set titulo = 'Cata de temporada (editada)'
 where id = '66666666-6666-6666-6666-666666666666';
select titulo from public.eventos where id = '66666666-6666-6666-6666-666666666666';

-- ------------------------------------------- borrar es suyo aunque no pague
update public.suscripciones set tier_id = 1
 where marca_id = '44444444-4444-4444-4444-444444444444';

\echo '--- borrar SI se puede sin plan: son sus eventos, no se le cobra por limpiar ---'
delete from public.eventos where id = '66666666-6666-6666-6666-666666666666';
select count(*) as quedan from public.eventos where id = '66666666-6666-6666-6666-666666666666';
