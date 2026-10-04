\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages to notice;

-- La medicion (migracion 000052): cualquiera anota, nadie lee salvo el
-- administrador, el negocio solo lo suyo, y el dueno no se cuenta a si mismo.
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

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('a1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'mide-duena@prueba.mx', 'x', now(),
   '{}', '{"nombre":"Duena","rol":"negocio"}', now(), now()),
  ('a1000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'mide-otro@prueba.mx', 'x', now(),
   '{}', '{"nombre":"Otro","rol":"negocio"}', now(), now());

update public.perfiles set correo_verificado_en = now()
 where id in ('a1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002');

insert into public.marcas (id, perfil_id, nombre_comercial, categoria_id)
select 'a2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'Medida', id
  from public.categorias where slug = 'chocolateria';

insert into public.productos_servicios (marca_id, nombre)
values ('a2000000-0000-0000-0000-000000000001', 'Barra');

insert into public.sucursales (id, marca_id, nombre_sucursal, slug, entidad, estado)
values ('a3000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001',
        'Matriz', 'medida-matriz', 'Tabasco', 'borrador');

-- ---------------------------------------------------------------- anonimo
set local role anon;

select public.anotar('whatsapp', 'a3000000-0000-0000-0000-000000000001');
select public.anotar('busqueda', null, null, '  Barra 70%  ');

select pg_temp.debe_fallar('un tipo inventado no entra',
  $q$ select public.anotar('inventado') $q$);
select pg_temp.debe_fallar('nadie escribe en la tabla directo',
  $q$ insert into public.actividad (tipo) values ('whatsapp') $q$);
select pg_temp.debe_fallar('el anonimo no lee el tablero',
  $q$ select * from public.actividad_por_dia(now() - interval '1 day') $q$);

\echo '--- el anonimo no ve las filas ---'
select count(*) = 0 as no_las_ve from public.actividad;

-- ---------------------------------------------------------------- la duena
set local role authenticated;
set local request.jwt.claims to '{"sub":"a1000000-0000-0000-0000-000000000001","role":"authenticated"}';

-- Su propia visita no cuenta.
select public.anotar('vista_micrositio', 'a3000000-0000-0000-0000-000000000001');

\echo '--- la duena ve lo suyo: 1 WhatsApp y ninguna visita propia ---'
select coalesce(sum(total) filter (where tipo = 'whatsapp'), 0) = 1 as un_whatsapp,
       coalesce(sum(total) filter (where tipo = 'vista_micrositio'), 0) = 0 as sin_su_visita
  from public.actividad_de_sucursal('a3000000-0000-0000-0000-000000000001', now() - interval '1 day');

select pg_temp.debe_fallar('la duena no lee el tablero de todos',
  $q$ select * from public.actividad_por_sucursal(now() - interval '1 day') $q$);

-- ---------------------------------------------------------------- otro negocio
set local request.jwt.claims to '{"sub":"a1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select pg_temp.debe_fallar('otro negocio no lee los numeros ajenos',
  $q$ select * from public.actividad_de_sucursal('a3000000-0000-0000-0000-000000000001', now() - interval '1 day') $q$);
select pg_temp.debe_fallar('otro negocio no cuenta favoritos ajenos',
  $q$ select public.favoritos_de_sucursal('a3000000-0000-0000-0000-000000000001') $q$);

reset role;

\echo '--- la busqueda se guarda limpia ---'
select detalle = 'barra 70%' as limpia
  from public.actividad where tipo = 'busqueda' order by id desc limit 1;

rollback;
