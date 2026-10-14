\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages to notice;

-- Reportar resenas (migracion 000054).
--
-- Cualquiera con sesion reporta una vez cada resena, nunca la suya; ve solo
-- sus reportes; el administrador los ve todos y los descarta. Borrar la resena
-- se lleva sus reportes. Y las resenas siguen trayendo el nombre de su autor:
-- la tabla nueva no abre un segundo camino a perfiles_publicos.
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

-- ---------------------------------------------------------------- datos
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('b1700000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'dueno-reporte@prueba.mx', 'x', now(),
   '{}', '{"nombre":"Dueño","rol":"negocio"}', now(), now()),
  ('b1700000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'autora-reporte@prueba.mx', 'x', now(),
   '{}', '{"nombre":"Autora","rol":"cliente"}', now(), now()),
  ('b1700000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'admin-reporte@prueba.mx', 'x', now(),
   '{}', '{"nombre":"Admin","rol":"cliente"}', now(), now());

update public.perfiles set rol = 'admin' where id = 'b1700000-0000-0000-0000-000000000003';
update public.perfiles set correo_verificado_en = now()
 where id = 'b1700000-0000-0000-0000-000000000001';

insert into public.marcas (id, perfil_id, nombre_comercial, categoria_id)
select 'b2700000-0000-0000-0000-000000000001', 'b1700000-0000-0000-0000-000000000001',
       'Cacao Reportado', id
  from public.categorias where slug = 'chocolateria';

insert into public.productos_servicios (marca_id, nombre)
values ('b2700000-0000-0000-0000-000000000001', 'Barra');

insert into public.sucursales (id, marca_id, nombre_sucursal, slug, entidad, estado, acerca_de, logo)
values ('b3700000-0000-0000-0000-000000000001', 'b2700000-0000-0000-0000-000000000001',
        'Centro', 'reporte-prueba', 'Tabasco', 'borrador', 'Cacao', 'logo.png');

-- La resena se escribe directo como superusuario: lo que se prueba es el
-- reporte, no las reglas de quien puede resenar.
insert into public.calificaciones (usuario_id, sucursal_id, estrellas)
values ('b1700000-0000-0000-0000-000000000002', 'b3700000-0000-0000-0000-000000000001', 1);
insert into public.resenas (id, usuario_id, sucursal_id, texto)
values ('b4700000-0000-0000-0000-000000000001', 'b1700000-0000-0000-0000-000000000002',
        'b3700000-0000-0000-0000-000000000001', 'Pésimo, no vayan');

-- ---------------------------------------------------------------- el dueno
set local role authenticated;
set local request.jwt.claims to '{"sub":"b1700000-0000-0000-0000-000000000001","role":"authenticated"}';

insert into public.reportes_resena (resena_id, usuario_id, motivo, detalle)
values ('b4700000-0000-0000-0000-000000000001', 'b1700000-0000-0000-0000-000000000001',
        'falsa', 'Nunca vino');

select pg_temp.debe_fallar('no se reporta dos veces la misma',
  $q$ insert into public.reportes_resena (resena_id, usuario_id, motivo)
      values ('b4700000-0000-0000-0000-000000000001', 'b1700000-0000-0000-0000-000000000001', 'spam') $q$);
select pg_temp.debe_fallar('no se reporta a nombre de otro',
  $q$ insert into public.reportes_resena (resena_id, usuario_id, motivo)
      values ('b4700000-0000-0000-0000-000000000001', 'b1700000-0000-0000-0000-000000000003', 'spam') $q$);
select pg_temp.debe_fallar('un motivo inventado no entra',
  $q$ insert into public.reportes_resena (resena_id, usuario_id, motivo)
      values ('b4700000-0000-0000-0000-000000000001', 'b1700000-0000-0000-0000-000000000001', 'aburrida') $q$);
-- Sin politica de delete para el, el borrado no falla: no borra nada.
delete from public.reportes_resena where resena_id = 'b4700000-0000-0000-0000-000000000001';
select pg_temp.debe_fallar('un negocio no ve la cola del administrador',
  $q$ select * from public.resenas_reportadas() $q$);

\echo '--- ve su propio reporte ---'
select count(*) = 1 as ve_el_suyo from public.reportes_resena;

-- ---------------------------------------------------------------- la autora
set local request.jwt.claims to '{"sub":"b1700000-0000-0000-0000-000000000002","role":"authenticated"}';

\echo '--- no ve quien la reporto ---'
select count(*) = 0 as no_ve_reportes_ajenos from public.reportes_resena;

select pg_temp.debe_fallar('no se reporta la propia',
  $q$ insert into public.reportes_resena (resena_id, usuario_id, motivo)
      values ('b4700000-0000-0000-0000-000000000001', 'b1700000-0000-0000-0000-000000000002', 'otro') $q$);

-- ---------------------------------------------------------------- el admin
set local request.jwt.claims to '{"sub":"b1700000-0000-0000-0000-000000000003","role":"authenticated"}';

\echo '--- el administrador ve la cola con su motivo y su comentario ---'
select reportes = 1 as un_reporte, motivos = array['falsa'] as motivo, detalles = array['Nunca vino'] as comentario
  from public.resenas_reportadas();

\echo '--- la resena sigue trayendo a su autora (sin PGRST201 en la API) ---'
select not exists (
         select 1 from pg_constraint
          where conrelid = 'public.reportes_resena'::regclass
            and contype = 'f'
            and confrelid = 'public.perfiles'::regclass
       ) as sin_llave_a_perfiles;

delete from public.reportes_resena where resena_id = 'b4700000-0000-0000-0000-000000000001';
\echo '--- descartar deja la resena ---'
select (select count(*) from public.reportes_resena) = 0 as sin_reportes,
       exists (select 1 from public.resenas where id = 'b4700000-0000-0000-0000-000000000001') as resena_sigue;

reset role;

-- Borrar la resena se lleva sus reportes.
insert into public.reportes_resena (resena_id, usuario_id, motivo)
values ('b4700000-0000-0000-0000-000000000001', 'b1700000-0000-0000-0000-000000000001', 'ofensiva');
delete from public.resenas where id = 'b4700000-0000-0000-0000-000000000001';
\echo '--- borrar la resena borra sus reportes ---'
select count(*) = 0 as se_fueron from public.reportes_resena
 where resena_id = 'b4700000-0000-0000-0000-000000000001';

rollback;
