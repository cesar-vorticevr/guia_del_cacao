\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages to notice;

-- Cuentas compartidas, fase 4 (migracion 000080): una cuenta para todo.
--
-- Una cuenta de cliente crea su negocio y queda con el rol de negocio sin
-- pedirlo; a quien le comparten un negocio le pasa lo mismo. Nadie se cambia el
-- rol a mano, y una cuenta que llega sin rol (Google) nace confirmada.
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
  if valor then
    raise notice 'OK     %', etiqueta;
  else
    raise notice 'FALLA  %', etiqueta;
  end if;
end $$;

create or replace function pg_temp.como(usuario text)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', usuario, 'role', 'authenticated')::text, true);
end $$;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('f3600000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'clienta-todo@prueba.mx', 'x', now(), '{}', '{"nombre":"Clienta Todo","rol":"cliente"}', now(), now()),
  ('f3600000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'google-todo@prueba.mx', 'x', now(), '{}', '{"full_name":"Por Google"}', now(), now()),
  ('f3600000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ayuda-todo@prueba.mx', 'x', now(), '{}', '{"nombre":"Ayuda Todo","rol":"cliente"}', now(), now());

select pg_temp.debe_ser('quien llega por Google nace con el rol confirmado',
  (select rol = 'cliente' and rol_confirmado from public.perfiles where id = 'f3600000-0000-0000-0000-000000000002'));

set local role authenticated;
select pg_temp.como('f3600000-0000-0000-0000-000000000001');
select pg_temp.debe_fallar('nadie se pone el rol de negocio a mano',
  $q$ update public.perfiles set rol = 'negocio' where id = 'f3600000-0000-0000-0000-000000000001' $q$);

insert into public.marcas (id, perfil_id, nombre_comercial, categoria_id)
values ('f3610000-0000-0000-0000-000000000001', 'f3600000-0000-0000-0000-000000000001', 'Cacao de la clienta', 1);
select pg_temp.debe_ser('la clienta crea su negocio y queda con el rol de negocio',
  (select rol = 'negocio' from public.perfiles where id = 'f3600000-0000-0000-0000-000000000001'));
select pg_temp.debe_ser('y sigue pudiendo reseñar y girar (es_cliente)',
  public.es_cliente());

select public.compartir_marca('f3610000-0000-0000-0000-000000000001', 'ayudatodo');
reset role;
select pg_temp.debe_ser('a quien le comparten un negocio tambien le llega el rol',
  (select rol = 'negocio' from public.perfiles where id = 'f3600000-0000-0000-0000-000000000003'));
select pg_temp.debe_ser('el rol de administrador no se toca',
  not exists (select 1 from public.perfiles where rol = 'admin' and id::text like 'f36%'));

rollback;
