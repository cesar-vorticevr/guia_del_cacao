\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages to notice;

-- Cuentas compartidas, fase 3 (migracion 000079): compartir, quitar, ceder y
-- dejar un negocio, y lo que puede cada quien.
--
-- El dueño comparte por @usuario; el administrador edita la marca pero no la
-- borra, no se queda con ella, no anota la CLABE y no comparte. Ceder cambia al
-- dueño y el anterior se queda o se va. El dueño no se va sin ceder.
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
-- 1 Jorge (dueño), 2 Ana, 3 Beto, 4 alguien de fuera.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('f3500000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'jorge-ceder@prueba.mx', 'x', now(), '{}', '{"nombre":"Jorge Ceder","rol":"negocio"}', now(), now()),
  ('f3500000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ana-ceder@prueba.mx', 'x', now(), '{}', '{"nombre":"Ana Ceder","rol":"cliente"}', now(), now()),
  ('f3500000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'beto-ceder@prueba.mx', 'x', now(), '{}', '{"nombre":"Beto Ceder","rol":"cliente"}', now(), now()),
  ('f3500000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'fuera-ceder@prueba.mx', 'x', now(), '{}', '{"nombre":"Fuera Ceder","rol":"cliente"}', now(), now());

insert into public.marcas (id, perfil_id, nombre_comercial, categoria_id)
values ('f3510000-0000-0000-0000-000000000001', 'f3500000-0000-0000-0000-000000000001', 'Cacao para ceder', 1);

set local role authenticated;

-- ---------------------------------------------------------------- compartir
select pg_temp.como('f3500000-0000-0000-0000-000000000001');
select pg_temp.debe_fallar('no se comparte con un @usuario que no existe',
  $q$ select public.compartir_marca('f3510000-0000-0000-0000-000000000001', '@nadie.existe') $q$);
select public.compartir_marca('f3510000-0000-0000-0000-000000000001', '@AnaCeder');
select pg_temp.debe_ser('el dueño comparte con @anaceder (con arroba y mayusculas)',
  (select count(*) from public.administradores_de('f3510000-0000-0000-0000-000000000001')) = 2);
select pg_temp.debe_fallar('no se comparte dos veces con la misma cuenta',
  $q$ select public.compartir_marca('f3510000-0000-0000-0000-000000000001', 'anaceder') $q$);

-- ---------------------------------------------------------------- lo que puede la administradora
select pg_temp.como('f3500000-0000-0000-0000-000000000002');
update public.marcas set nombre_comercial = 'Cacao editado por Ana' where id = 'f3510000-0000-0000-0000-000000000001';
select pg_temp.debe_ser('la administradora edita la marca',
  (select nombre_comercial from public.marcas where id = 'f3510000-0000-0000-0000-000000000001') = 'Cacao editado por Ana');
select pg_temp.debe_fallar('pero no se queda con ella escribiendo su id',
  $q$ update public.marcas set perfil_id = 'f3500000-0000-0000-0000-000000000002' where id = 'f3510000-0000-0000-0000-000000000001' $q$);
select pg_temp.debe_fallar('ni la borra',
  $q$ do $d$ begin
        delete from public.marcas where id = 'f3510000-0000-0000-0000-000000000001';
        if not found then raise exception 'no la borro'; end if;
      end $d$ $q$);
select pg_temp.debe_fallar('ni anota la CLABE',
  $q$ insert into public.datos_de_pago (marca_id, banco, titular, clabe)
      values ('f3510000-0000-0000-0000-000000000001', 'Banamex', 'Ana', '002010077777777771') $q$);
select pg_temp.debe_fallar('ni comparte el negocio',
  $q$ select public.compartir_marca('f3510000-0000-0000-0000-000000000001', 'betoceder') $q$);
select pg_temp.debe_fallar('ni lo cede',
  $q$ select public.ceder_marca('f3510000-0000-0000-0000-000000000001', 'betoceder') $q$);

select pg_temp.como('f3500000-0000-0000-0000-000000000004');
select pg_temp.debe_ser('alguien de fuera no ve al equipo',
  (select count(*) from public.administradores_de('f3510000-0000-0000-0000-000000000001')) = 0);
select pg_temp.debe_fallar('ni edita la marca',
  $q$ do $d$ begin
        update public.marcas set nombre_comercial = 'Mia' where id = 'f3510000-0000-0000-0000-000000000001';
        if not found then raise exception 'no la ve'; end if;
      end $d$ $q$);

-- ---------------------------------------------------------------- dejar y quitar
select pg_temp.como('f3500000-0000-0000-0000-000000000002');
select public.dejar_marca('f3510000-0000-0000-0000-000000000001');
select pg_temp.debe_ser('la administradora deja el negocio y ya no lo administra',
  not public.posee_marca('f3510000-0000-0000-0000-000000000001'));

select pg_temp.como('f3500000-0000-0000-0000-000000000001');
select pg_temp.debe_fallar('el dueño no se va sin ceder',
  $q$ select public.dejar_marca('f3510000-0000-0000-0000-000000000001') $q$);
select public.compartir_marca('f3510000-0000-0000-0000-000000000001', 'betoceder');
select public.quitar_administrador('f3510000-0000-0000-0000-000000000001', 'f3500000-0000-0000-0000-000000000003');
select pg_temp.debe_ser('el dueño quita a un administrador',
  (select count(*) from public.administradores_de('f3510000-0000-0000-0000-000000000001')) = 1);

-- ---------------------------------------------------------------- ceder
select public.ceder_marca('f3510000-0000-0000-0000-000000000001', 'anaceder');
select pg_temp.debe_ser('al ceder, Ana queda como dueña',
  (select perfil_id from public.administradores_marca
    where marca_id = 'f3510000-0000-0000-0000-000000000001' and papel = 'dueno') = 'f3500000-0000-0000-0000-000000000002');
select pg_temp.debe_ser('y Jorge sigue como administrador',
  public.posee_marca('f3510000-0000-0000-0000-000000000001')
  and not public.es_dueno_de_marca('f3510000-0000-0000-0000-000000000001'));
select pg_temp.debe_fallar('Jorge ya no comparte el negocio',
  $q$ select public.compartir_marca('f3510000-0000-0000-0000-000000000001', 'betoceder') $q$);

select pg_temp.como('f3500000-0000-0000-0000-000000000002');
select public.ceder_marca('f3510000-0000-0000-0000-000000000001', 'betoceder', false);
select pg_temp.debe_ser('Ana cede a Beto y se sale del todo',
  not public.posee_marca('f3510000-0000-0000-0000-000000000001'));

select pg_temp.como('f3500000-0000-0000-0000-000000000003');
select pg_temp.debe_ser('Beto es el dueño',
  public.es_dueno_de_marca('f3510000-0000-0000-0000-000000000001'));
insert into public.datos_de_pago (marca_id, banco, titular, clabe)
values ('f3510000-0000-0000-0000-000000000001', 'Banamex', 'Beto', '002010077777777771');
select pg_temp.debe_ser('el nuevo dueño si anota la CLABE',
  exists (select 1 from public.datos_de_pago where marca_id = 'f3510000-0000-0000-0000-000000000001'));

rollback;
