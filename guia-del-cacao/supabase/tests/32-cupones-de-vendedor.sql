\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages to notice;

-- Cupones propios de cada vendedor (migracion 000073).
--
-- De 1 a 50%, tres activos a la vez, no se editan. El negocio que lo pone se
-- queda con ese descuento aunque el vendedor lo desactive despues, y el
-- cobro (`codigo_de_embajador_de`) lleva ese porcentaje.
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

-- 1 vendedora, 2 negocio, 3 administrador, 4 otro vendedor, 5 otro negocio.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select v.id::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       v.correo, 'x', now(), '{}', json_build_object('nombre', v.nombre, 'rol', v.rol)::jsonb, now(), now()
  from (values
    ('f3200000-0000-0000-0000-000000000001', 'vende-cupon@prueba.mx', 'Marta Ruiz', 'cliente'),
    ('f3200000-0000-0000-0000-000000000002', 'negocio-cupon@prueba.mx', 'Dueño', 'negocio'),
    ('f3200000-0000-0000-0000-000000000003', 'admin-cupon@prueba.mx', 'Admin', 'cliente'),
    ('f3200000-0000-0000-0000-000000000004', 'otro-cupon@prueba.mx', 'Otro', 'cliente'),
    ('f3200000-0000-0000-0000-000000000005', 'negocio2-cupon@prueba.mx', 'Dueña', 'negocio')
  ) as v (id, correo, nombre, rol);

update public.perfiles set rol = 'admin' where id = 'f3200000-0000-0000-0000-000000000003';
update public.perfiles set rol_confirmado = true, correo_verificado_en = now()
 where id::text like 'f3200000-%';

insert into public.marcas (id, perfil_id, nombre_comercial, categoria_id)
select v.id::uuid, v.perfil::uuid, v.nombre, c.id
  from (values
    ('f3210000-0000-0000-0000-000000000002', 'f3200000-0000-0000-0000-000000000002', 'Cacao del Cupón'),
    ('f3210000-0000-0000-0000-000000000005', 'f3200000-0000-0000-0000-000000000005', 'Cacao Tardío')
  ) as v (id, perfil, nombre)
  cross join public.categorias c where c.slug = 'chocolateria';

set local role authenticated;
select pg_temp.como('f3200000-0000-0000-0000-000000000003');
select public.asignar_embajador('f3200000-0000-0000-0000-000000000001') as codigo_fijo \gset
select public.asignar_embajador('f3200000-0000-0000-0000-000000000004');

-- ---------------------------------------------------------------- crear
select pg_temp.como('f3200000-0000-0000-0000-000000000001');

insert into public.cupones_de_vendedor (codigo, porcentaje) values ('marta30', 30);
select pg_temp.debe_ser('el codigo se guarda en mayusculas',
  exists (select 1 from public.cupones_de_vendedor where codigo = 'MARTA30' and activo));

select pg_temp.debe_fallar('mas de 50% no entra',
  $q$ insert into public.cupones_de_vendedor (codigo, porcentaje) values ('MARTA60', 60) $q$);
select pg_temp.debe_fallar('cero por ciento no entra',
  $q$ insert into public.cupones_de_vendedor (codigo, porcentaje) values ('MARTA0', 0) $q$);
select pg_temp.debe_fallar('un codigo repetido no entra (sin importar guiones ni mayusculas)',
  $q$ insert into public.cupones_de_vendedor (codigo, porcentaje) values ('marta-30', 10) $q$);
select pg_temp.debe_fallar('no choca con el codigo fijo de un vendedor',
  format($q$ insert into public.cupones_de_vendedor (codigo, porcentaje) values (%L, 10) $q$, :'codigo_fijo'));
select pg_temp.debe_fallar('un codigo con espacios o simbolos no entra',
  $q$ insert into public.cupones_de_vendedor (codigo, porcentaje) values ('MI CUPON!', 10) $q$);
select pg_temp.debe_fallar('no se crea a nombre de otro vendedor',
  $q$ insert into public.cupones_de_vendedor (embajador_id, codigo, porcentaje)
      values ('f3200000-0000-0000-0000-000000000004', 'AJENO10', 10) $q$);

insert into public.cupones_de_vendedor (codigo, porcentaje) values ('MARTA50', 50), ('MARTA10', 10);
select pg_temp.debe_fallar('un cuarto cupon activo no entra',
  $q$ insert into public.cupones_de_vendedor (codigo, porcentaje) values ('MARTA20', 20) $q$);
select pg_temp.debe_fallar('un cupon no se edita',
  $q$ update public.cupones_de_vendedor set porcentaje = 45 where codigo = 'MARTA30' $q$);

-- ---------------------------------------------------------------- el negocio lo pone
select pg_temp.como('f3200000-0000-0000-0000-000000000002');

select pg_temp.debe_ser('el codigo del cupon dice su porcentaje',
  (select porcentaje from public.codigo_de_asesor('marta 30')) = 30);
select pg_temp.debe_ser('el codigo fijo sigue en 15',
  (select porcentaje from public.codigo_de_asesor(:'codigo_fijo')) = 15);
select pg_temp.debe_ser('el negocio no ve los cupones',
  not exists (select 1 from public.cupones_de_vendedor));
select pg_temp.debe_ser('poner el cupon lo vincula con la vendedora',
  public.vincular_embajador('f3210000-0000-0000-0000-000000000002', 'MARTA30') = 'Marta Ruiz');
select pg_temp.debe_ser('el cobro lleva el 30% del cupon',
  (select descuento from public.codigo_de_embajador_de('f3210000-0000-0000-0000-000000000002')) = 30);

-- ---------------------------------------------------------------- desactivar
select pg_temp.como('f3200000-0000-0000-0000-000000000001');
update public.cupones_de_vendedor set activo = false where codigo = 'MARTA30';

select pg_temp.debe_ser('desactivado deja lugar para otro',
  (select count(*) from public.cupones_de_vendedor where activo) = 2);
insert into public.cupones_de_vendedor (codigo, porcentaje) values ('MARTA20', 20);
select pg_temp.debe_fallar('volver a encender uno pasaria de tres',
  $q$ update public.cupones_de_vendedor set activo = true where codigo = 'MARTA30' $q$);
select pg_temp.debe_ser('la vendedora ve cuantos negocios lo pusieron',
  (select negocios from public.mis_cupones_de_vendedor() where codigo = 'MARTA30') = 1);
select pg_temp.debe_ser('y en su tablero, con cual y cuanto',
  (select cupon = 'MARTA30' and descuento = 30 from public.mis_referidos() limit 1));

select pg_temp.como('f3200000-0000-0000-0000-000000000005');
select pg_temp.debe_ser('desactivado ya no lo reconoce nadie',
  not exists (select 1 from public.codigo_de_asesor('MARTA30')));
select pg_temp.debe_ser('ni lo vincula',
  public.vincular_embajador('f3210000-0000-0000-0000-000000000005', 'MARTA30') is null);

select pg_temp.como('f3200000-0000-0000-0000-000000000002');
select pg_temp.debe_ser('quien ya lo puso conserva su 30%',
  (select descuento from public.codigo_de_embajador_de('f3210000-0000-0000-0000-000000000002')) = 30);

-- ---------------------------------------------------------------- pausada
select pg_temp.como('f3200000-0000-0000-0000-000000000003');
update public.embajadores set estado = 'pausado' where perfil_id = 'f3200000-0000-0000-0000-000000000001';
select pg_temp.como('f3200000-0000-0000-0000-000000000005');
select pg_temp.debe_ser('con la vendedora en pausa sus cupones no sirven',
  not exists (select 1 from public.codigo_de_asesor('MARTA50')));

reset role;
select pg_temp.debe_ser('no hay politica para borrar cupones',
  not exists (select 1 from pg_policies
               where tablename = 'cupones_de_vendedor' and cmd in ('DELETE', 'ALL')));

rollback;
