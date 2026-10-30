\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages to notice;

-- Cuentas de ventas (migracion 000067).
--
-- Solo el administrador da de alta a un vendedor; el negocio ahorra 15%; la
-- comision es 25% de lo cobrado hasta `comision_hasta`, que solo mueve el
-- administrador; y cada vendedor ve y escribe solo su libreta de prospectos.
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

-- ---------------------------------------------------------------- datos
-- 1 vendedor, 2 negocio que llega con su codigo, 3 administrador, 4 otro vendedor.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('e6000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'jorge@prueba.mx', 'x', now(),
   '{}', '{"nombre":"Jorge Ruiz","rol":"cliente"}', now(), now()),
  ('e6000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'referido-ventas@prueba.mx', 'x', now(),
   '{}', '{"nombre":"Referido","rol":"negocio"}', now(), now()),
  ('e6000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'admin-ventas@prueba.mx', 'x', now(),
   '{}', '{"nombre":"Admin","rol":"cliente"}', now(), now()),
  ('e6000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'otro-vendedor@prueba.mx', 'x', now(),
   '{}', '{"nombre":"Otra Vendedora","rol":"cliente"}', now(), now());

update public.perfiles set rol = 'admin' where id = 'e6000000-0000-0000-0000-000000000003';
update public.perfiles set correo_verificado_en = now() where id::text like 'e6000000-%';

insert into public.marcas (id, perfil_id, nombre_comercial, categoria_id)
select 'e6100000-0000-0000-0000-000000000002', 'e6000000-0000-0000-0000-000000000002', 'Cacao de Jorge', c.id
  from public.categorias c where c.slug = 'chocolateria';

select pg_temp.debe_ser('el negocio ahorra 15% y el vendedor gana 25%',
  public.descuento_de_embajador() = 15 and public.comision_de_embajador() = 25);

-- ---------------------------------------------------------------- solo el administrador da de alta
set local role authenticated;
set local request.jwt.claims to '{"sub":"e6000000-0000-0000-0000-000000000001","role":"authenticated"}';

select pg_temp.debe_fallar('nadie se da de alta solo',
  $q$ select public.asignar_embajador('e6000000-0000-0000-0000-000000000001') $q$);
select pg_temp.debe_fallar('nadie pide ser vendedor',
  $q$ insert into public.embajadores (perfil_id) values ('e6000000-0000-0000-0000-000000000001') $q$);
select pg_temp.debe_ser('sin cuenta de ventas no es vendedor', not public.es_vendedor());

reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub":"e6000000-0000-0000-0000-000000000003","role":"authenticated"}';

select public.asignar_embajador('e6000000-0000-0000-0000-000000000001') as codigo \gset
select pg_temp.debe_ser('el codigo nace del nombre: ' || :'codigo', :'codigo' like 'JORGE-____');
select pg_temp.debe_ser('asignarlo otra vez conserva el codigo',
  public.asignar_embajador('e6000000-0000-0000-0000-000000000001') = :'codigo');
select pg_temp.debe_ser('la vigencia nace al 30 de abril de 2027',
  (select comision_hasta from public.embajadores where perfil_id = 'e6000000-0000-0000-0000-000000000001') = '2027-04-30');
select public.asignar_embajador('e6000000-0000-0000-0000-000000000004') as otro \gset

reset role;

-- ---------------------------------------------------------------- el vendedor no se cambia la vigencia
set local role authenticated;
set local request.jwt.claims to '{"sub":"e6000000-0000-0000-0000-000000000001","role":"authenticated"}';

select pg_temp.debe_ser('ahora si es vendedor', public.es_vendedor());
select pg_temp.debe_fallar('el vendedor no alarga su vigencia',
  $q$ update public.embajadores set comision_hasta = '2030-01-01' where perfil_id = 'e6000000-0000-0000-0000-000000000001' $q$);

reset role;

-- ---------------------------------------------------------------- la comision, hasta la fecha
set local role authenticated;
set local request.jwt.claims to '{"sub":"e6000000-0000-0000-0000-000000000002","role":"authenticated"}';
select public.vincular_embajador('e6100000-0000-0000-0000-000000000002', :'codigo');
reset role;

set local request.jwt.claims to '{"role":"service_role"}';

-- 499 con 15% = 424.15; el 25% de eso.
select public.registrar_comision('e6100000-0000-0000-0000-000000000002', 424.15, 'sub_jorge', 'in_j1') as primera \gset
select pg_temp.debe_ser('la comision va sobre lo pagado con descuento: ' || :'primera', :'primera'::numeric = 106.04);

update public.embajadores set comision_hasta = '2026-01-01'
 where perfil_id = 'e6000000-0000-0000-0000-000000000001';
select public.registrar_comision('e6100000-0000-0000-0000-000000000002', 499, 'sub_jorge', 'in_j2') as vencida \gset
select pg_temp.debe_ser('pasada la fecha ya no deja comision', :'vencida'::numeric = 0);

reset role;

-- ---------------------------------------------------------------- la libreta de prospectos
set local role authenticated;
set local request.jwt.claims to '{"sub":"e6000000-0000-0000-0000-000000000001","role":"authenticated"}';

insert into public.prospectos (embajador_id, negocio, telefono, etapa)
values ('e6000000-0000-0000-0000-000000000001', 'Chocolates del Río', '9931234567', 'contactado');

select pg_temp.debe_fallar('no apunta en la libreta de otro',
  $q$ insert into public.prospectos (embajador_id, negocio) values ('e6000000-0000-0000-0000-000000000004', 'Ajeno') $q$);
select pg_temp.debe_fallar('la etapa es de la lista',
  $q$ insert into public.prospectos (embajador_id, negocio, etapa) values ('e6000000-0000-0000-0000-000000000001', 'X', 'casi') $q$);

reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub":"e6000000-0000-0000-0000-000000000004","role":"authenticated"}';

select pg_temp.debe_ser('la otra vendedora no ve la libreta de Jorge',
  (select count(*) from public.prospectos) = 0);

reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub":"e6000000-0000-0000-0000-000000000002","role":"authenticated"}';

select pg_temp.debe_fallar('un negocio no tiene libreta',
  $q$ insert into public.prospectos (embajador_id, negocio) values ('e6000000-0000-0000-0000-000000000002', 'Yo') $q$);

reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub":"e6000000-0000-0000-0000-000000000003","role":"authenticated"}';

select pg_temp.debe_ser('el administrador ve todas las libretas',
  (select count(*) from public.prospectos where embajador_id::text like 'e6000000-%') = 1);

reset role;

rollback;
