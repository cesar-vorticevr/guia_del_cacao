\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages to notice;

-- Elegir «Soy cliente» confirma el rol (migracion 000061).
--
-- Quien llega por Google ya es cliente sin confirmar: elegir cliente tiene que
-- confirmarlo aunque el rol no cambie. Y con el rol igual, nadie se
-- desconfirma para volver a elegir.
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

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('f2200000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'google-nuevo@prueba.mx', 'x', now(),
   '{}', '{"nombre":"De Google"}', now(), now());

-- Como llega de Google: cliente, sin confirmar.
update public.perfiles set rol = 'cliente', rol_confirmado = false
 where id = 'f2200000-0000-0000-0000-0000000000a1';

set local role authenticated;
set local request.jwt.claims to '{"sub":"f2200000-0000-0000-0000-0000000000a1","role":"authenticated"}';

update public.perfiles set rol = 'cliente', rol_confirmado = true
 where id = 'f2200000-0000-0000-0000-0000000000a1';

select pg_temp.debe_ser('elegir cliente siendo cliente lo confirma',
  (select rol_confirmado from public.perfiles where id = 'f2200000-0000-0000-0000-0000000000a1'));

select pg_temp.debe_fallar('ya confirmado, no se desconfirma',
  $q$ update public.perfiles set rol_confirmado = false
      where id = 'f2200000-0000-0000-0000-0000000000a1' $q$);

select pg_temp.debe_fallar('ya confirmado, no se pasa a negocio',
  $q$ update public.perfiles set rol = 'negocio'
      where id = 'f2200000-0000-0000-0000-0000000000a1' $q$);

reset role;

rollback;
