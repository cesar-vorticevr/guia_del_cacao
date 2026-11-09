\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages to notice;

-- Cuentas compartidas, fase 1 (migracion 000078): el @usuario y la lista de
-- administradores de cada marca.
--
-- El @usuario nace solo, sin acentos ni repetidos, y se cambia una vez cada 30
-- dias. Cada marca tiene a su dueño en la lista, y `posee_marca` le pregunta a
-- la lista: con un administrador agregado, este edita la marca; quien no esta
-- en la lista no. Nadie se agrega solo.
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

-- ---------------------------------------------------------------- datos
-- 1 Jorge (dueño), 2 Ana (la que le ayuda), 3 otro Jorge, 4 alguien de fuera.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('f3400000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'jorge-admins@prueba.mx', 'x', now(),
   '{}', '{"nombre":"Jorge Otero","rol":"negocio"}', now(), now()),
  ('f3400000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ana-admins@prueba.mx', 'x', now(),
   '{}', '{"nombre":"Ana Pérez","rol":"cliente"}', now(), now()),
  ('f3400000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'jorge2-admins@prueba.mx', 'x', now(),
   '{}', '{"nombre":"Jorge Otero","rol":"cliente"}', now(), now()),
  ('f3400000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'fuera-admins@prueba.mx', 'x', now(),
   '{}', '{"nombre":"De Fuera","rol":"negocio"}', now(), now());

-- ---------------------------------------------------------------- @usuario
select pg_temp.debe_ser('el @usuario nace solo, sin acentos ni espacios',
  (select usuario from public.perfiles where id = 'f3400000-0000-0000-0000-000000000002') = 'anaperez');
select pg_temp.debe_ser('dos con el mismo nombre no comparten @usuario',
  (select usuario from public.perfiles where id = 'f3400000-0000-0000-0000-000000000001')
  <> (select usuario from public.perfiles where id = 'f3400000-0000-0000-0000-000000000003'));
select pg_temp.debe_ser('el @usuario se ve en perfiles_publicos',
  exists (select 1 from public.perfiles_publicos where id = 'f3400000-0000-0000-0000-000000000002' and usuario = 'anaperez'));

set local role authenticated;
select pg_temp.como('f3400000-0000-0000-0000-000000000002');

update public.perfiles set usuario = '@Ana.Cacao' where id = 'f3400000-0000-0000-0000-000000000002';
select pg_temp.debe_ser('al cambiarlo se quita la arroba y queda en minusculas',
  (select usuario from public.perfiles where id = 'f3400000-0000-0000-0000-000000000002') = 'ana.cacao');
select pg_temp.debe_fallar('no se cambia otra vez antes de 30 dias',
  $q$ update public.perfiles set usuario = 'ana.otra' where id = 'f3400000-0000-0000-0000-000000000002' $q$);

reset role;
update public.perfiles set usuario_cambiado_en = now() - interval '31 days'
 where id = 'f3400000-0000-0000-0000-000000000002';
set local role authenticated;

select pg_temp.debe_fallar('no se toma el @usuario de otra cuenta',
  $q$ update public.perfiles set usuario = (select usuario from public.perfiles_publicos where id = 'f3400000-0000-0000-0000-000000000001')
       where id = 'f3400000-0000-0000-0000-000000000002' $q$);
select pg_temp.debe_fallar('un @usuario con espacios o simbolos no entra',
  $q$ update public.perfiles set usuario = 'ana cacao!' where id = 'f3400000-0000-0000-0000-000000000002' $q$);

-- ---------------------------------------------------------------- la lista de administradores
reset role;
insert into public.marcas (id, perfil_id, nombre_comercial, categoria_id)
values ('f3410000-0000-0000-0000-000000000001', 'f3400000-0000-0000-0000-000000000001', 'Cacao de Jorge', 1);

select pg_temp.debe_ser('al crear la marca, su dueño queda en la lista',
  exists (select 1 from public.administradores_marca
           where marca_id = 'f3410000-0000-0000-0000-000000000001'
             and perfil_id = 'f3400000-0000-0000-0000-000000000001' and papel = 'dueno'));
select pg_temp.debe_fallar('una marca no tiene dos dueños',
  $q$ insert into public.administradores_marca (marca_id, perfil_id, papel)
      values ('f3410000-0000-0000-0000-000000000001', 'f3400000-0000-0000-0000-000000000004', 'dueno') $q$);

set local role authenticated;
select pg_temp.como('f3400000-0000-0000-0000-000000000001');
select pg_temp.debe_ser('el dueño posee su marca', public.posee_marca('f3410000-0000-0000-0000-000000000001'));
select pg_temp.debe_ser('y es su dueño', public.es_dueno_de_marca('f3410000-0000-0000-0000-000000000001'));
select pg_temp.debe_ser('mis_marcas le devuelve la suya',
  (select count(*) from public.mis_marcas()) = 1);

select pg_temp.como('f3400000-0000-0000-0000-000000000002');
select pg_temp.debe_ser('Ana todavia no administra la marca', not public.posee_marca('f3410000-0000-0000-0000-000000000001'));
select pg_temp.debe_fallar('Ana no se agrega sola a la lista',
  $q$ insert into public.administradores_marca (marca_id, perfil_id)
      values ('f3410000-0000-0000-0000-000000000001', 'f3400000-0000-0000-0000-000000000002') $q$);
select pg_temp.debe_fallar('ni edita la marca',
  $q$ do $d$ begin
        update public.marcas set nombre_comercial = 'Mia' where id = 'f3410000-0000-0000-0000-000000000001';
        if not found then raise exception 'no la ve'; end if;
      end $d$ $q$);

-- Lo que hara la fase 3 con una funcion: Jorge la agrega como administradora.
reset role;
insert into public.administradores_marca (marca_id, perfil_id, papel, agregado_por)
values ('f3410000-0000-0000-0000-000000000001', 'f3400000-0000-0000-0000-000000000002', 'admin',
        'f3400000-0000-0000-0000-000000000001');
set local role authenticated;

select pg_temp.como('f3400000-0000-0000-0000-000000000002');
select pg_temp.debe_ser('agregada, Ana administra la marca', public.posee_marca('f3410000-0000-0000-0000-000000000001'));
select pg_temp.debe_ser('pero no es su dueña', not public.es_dueno_de_marca('f3410000-0000-0000-0000-000000000001'));
select pg_temp.debe_ser('ve a sus compañeros en la lista',
  (select count(*) from public.administradores_marca where marca_id = 'f3410000-0000-0000-0000-000000000001') = 2);

select pg_temp.como('f3400000-0000-0000-0000-000000000004');
select pg_temp.debe_ser('alguien de fuera no ve la lista',
  not exists (select 1 from public.administradores_marca where marca_id = 'f3410000-0000-0000-0000-000000000001'));

-- Si cambia el dueño en la marca, el anterior se queda como administrador.
reset role;
update public.marcas set perfil_id = 'f3400000-0000-0000-0000-000000000002'
 where id = 'f3410000-0000-0000-0000-000000000001';
select pg_temp.debe_ser('al cambiar de dueño, la lista lo sigue',
  (select perfil_id from public.administradores_marca
    where marca_id = 'f3410000-0000-0000-0000-000000000001' and papel = 'dueno')
  = 'f3400000-0000-0000-0000-000000000002');
select pg_temp.debe_ser('y el dueño anterior queda como administrador',
  exists (select 1 from public.administradores_marca
           where marca_id = 'f3410000-0000-0000-0000-000000000001'
             and perfil_id = 'f3400000-0000-0000-0000-000000000001' and papel = 'admin'));

select pg_temp.debe_ser('la lista no apunta a perfiles (PGRST201)',
  not exists (
    select 1 from pg_constraint
     where conrelid = 'public.administradores_marca'::regclass
       and confrelid = 'public.perfiles'::regclass));

rollback;
