\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages to notice;

-- El enlace de confirmar la cuenta verifica el correo (migracion 000057).
--
-- Una sesion abierta con el enlace de confirmar la cuenta (`email/signup`) o
-- el de recuperar la contrasena (`recovery`) da el correo por verificado; una
-- con contrasena o con Google, no.
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

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('e1900000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'confirma-1@prueba.mx', 'x', now(),
   '{}', '{"nombre":"Uno","rol":"negocio"}', now(), now()),
  ('e1900000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'confirma-2@prueba.mx', 'x', now(),
   '{}', '{"nombre":"Dos","rol":"negocio"}', now(), now()),
  ('e1900000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'confirma-3@prueba.mx', 'x', now(),
   '{}', '{"nombre":"Tres","rol":"negocio"}', now(), now());

set local role authenticated;

-- Con contrasena: no prueba nada.
set local request.jwt.claims to '{"sub":"e1900000-0000-0000-0000-000000000001","role":"authenticated","amr":[{"method":"password","timestamp":1}]}';
select pg_temp.debe_fallar('una sesion con contrasena no verifica el correo',
  $q$ select public.marcar_correo_verificado() $q$);

-- Con Google: tampoco.
set local request.jwt.claims to '{"sub":"e1900000-0000-0000-0000-000000000001","role":"authenticated","amr":[{"method":"oauth","timestamp":1}]}';
select pg_temp.debe_fallar('una sesion con Google no verifica el correo',
  $q$ select public.marcar_correo_verificado() $q$);

-- Con el enlace de confirmar la cuenta: si.
set local request.jwt.claims to '{"sub":"e1900000-0000-0000-0000-000000000002","role":"authenticated","amr":[{"method":"email/signup","timestamp":1}]}';
select public.marcar_correo_verificado();

-- Con el de recuperar la contrasena: tambien.
set local request.jwt.claims to '{"sub":"e1900000-0000-0000-0000-000000000003","role":"authenticated","amr":[{"method":"recovery","timestamp":1}]}';
select public.marcar_correo_verificado();

reset role;

\echo '--- solo quedan verificados los que abrieron un enlace del correo ---'
select (select correo_verificado_en from public.perfiles where id = 'e1900000-0000-0000-0000-000000000001') is null as contrasena_no,
       (select correo_verificado_en from public.perfiles where id = 'e1900000-0000-0000-0000-000000000002') is not null as confirmar_cuenta_si,
       (select correo_verificado_en from public.perfiles where id = 'e1900000-0000-0000-0000-000000000003') is not null as recuperar_si;

rollback;
