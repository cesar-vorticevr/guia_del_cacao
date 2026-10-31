\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages to notice;

-- El producto etiquetado en una publicacion (migracion 000075).
--
-- Solo uno, y solo del catalogo de la marca que firma: ni el de otro negocio,
-- ni una publicacion sin sucursal (una persona). Borrar el producto quita la
-- etiqueta y deja la publicacion.
--
-- Dentro de una transaccion que se deshace. Corre como postgres: lo que se
-- prueba es el trigger, que no depende de quien escribe.

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
  if valor then
    raise notice 'OK     %', etiqueta;
  else
    raise notice 'FALLA  %', etiqueta;
  end if;
end $$;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select v.id::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       v.correo, 'x', now(), '{}', json_build_object('nombre', v.nombre, 'rol', 'negocio')::jsonb, now(), now()
  from (values
    ('f3300000-0000-0000-0000-000000000001', 'uno-etiqueta@prueba.mx', 'Uno'),
    ('f3300000-0000-0000-0000-000000000002', 'dos-etiqueta@prueba.mx', 'Dos')
  ) as v (id, correo, nombre);

update public.perfiles set rol_confirmado = true, correo_verificado_en = now()
 where id::text like 'f3300000-%';

insert into public.marcas (id, perfil_id, nombre_comercial, categoria_id)
select v.id::uuid, v.perfil::uuid, v.nombre, c.id
  from (values
    ('f3310000-0000-0000-0000-000000000001', 'f3300000-0000-0000-0000-000000000001', 'Cacao Uno'),
    ('f3310000-0000-0000-0000-000000000002', 'f3300000-0000-0000-0000-000000000002', 'Cacao Dos')
  ) as v (id, perfil, nombre)
  cross join public.categorias c where c.slug = 'chocolateria';

insert into public.productos_servicios (id, marca_id, nombre)
values ('f3320000-0000-0000-0000-000000000001', 'f3310000-0000-0000-0000-000000000001', 'Barra Uno'),
       ('f3320000-0000-0000-0000-000000000002', 'f3310000-0000-0000-0000-000000000002', 'Barra Dos');

insert into public.sucursales (id, marca_id, nombre_sucursal, slug, entidad, estado, acerca_de, logo, tier_id)
values ('f3330000-0000-0000-0000-000000000001', 'f3310000-0000-0000-0000-000000000001',
        'Centro', 'etiqueta-uno', 'Tabasco', 'borrador', 'Cacao', 'logo.png', 1);

-- Los triggers de la comunidad (mazorca, plan, una al dia) no son lo que se
-- prueba: se apagan para insertar directo y dejar solo el del producto.
set local session_replication_role = replica;
insert into public.publicaciones (id, autor_id, sucursal_id, contenido, imagenes)
values ('f3340000-0000-0000-0000-000000000001', 'f3300000-0000-0000-0000-000000000001',
        'f3330000-0000-0000-0000-000000000001', 'Ya llegó la barra nueva', array['x.jpg']),
       ('f3340000-0000-0000-0000-000000000002', 'f3300000-0000-0000-0000-000000000001',
        null, 'Lo cuenta una persona', array['x.jpg']);
set local session_replication_role = origin;

update public.publicaciones set producto_id = 'f3320000-0000-0000-0000-000000000001'
 where id = 'f3340000-0000-0000-0000-000000000001';
select pg_temp.debe_ser('un negocio etiqueta un producto de su catalogo',
  (select producto_id from public.publicaciones where id = 'f3340000-0000-0000-0000-000000000001')
    = 'f3320000-0000-0000-0000-000000000001');

select pg_temp.debe_fallar('no etiqueta el producto de otro negocio',
  $q$ update public.publicaciones set producto_id = 'f3320000-0000-0000-0000-000000000002'
       where id = 'f3340000-0000-0000-0000-000000000001' $q$);
select pg_temp.debe_fallar('una publicacion sin sucursal no etiqueta productos',
  $q$ update public.publicaciones set producto_id = 'f3320000-0000-0000-0000-000000000001'
       where id = 'f3340000-0000-0000-0000-000000000002' $q$);

delete from public.productos_servicios where id = 'f3320000-0000-0000-0000-000000000001';
select pg_temp.debe_ser('borrar el producto quita la etiqueta y deja la publicacion',
  (select producto_id is null from public.publicaciones where id = 'f3340000-0000-0000-0000-000000000001'));

rollback;
