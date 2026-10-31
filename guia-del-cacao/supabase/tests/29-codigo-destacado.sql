\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages to notice;

-- El codigo destacado del vendedor (migracion 000070).
--
-- Cada vendedor tiene dos codigos. El de descuento da 15% en el primer pago;
-- el destacado no da descuento y deja al negocio tres meses en «Destacados».
-- Con los dos gana su comision. Un negocio pone uno u otro, nunca los dos.
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
  if coalesce(valor, false) then
    raise notice 'OK     %', etiqueta;
  else
    raise notice 'FALLA  %', etiqueta;
  end if;
end $$;

-- ---------------------------------------------------------------- datos
-- 1 vendedora, 2 negocio con el destacado, 3 administrador, 4 negocio con el de descuento.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('e7000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'lucia-top@prueba.mx', 'x', now(),
   '{}', '{"nombre":"Lucía Pérez","rol":"cliente"}', now(), now()),
  ('e7000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'destacado@prueba.mx', 'x', now(),
   '{}', '{"nombre":"Destacado","rol":"negocio"}', now(), now()),
  ('e7000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'admin-top@prueba.mx', 'x', now(),
   '{}', '{"nombre":"Admin","rol":"cliente"}', now(), now()),
  ('e7000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'descuento@prueba.mx', 'x', now(),
   '{}', '{"nombre":"Descuento","rol":"negocio"}', now(), now());

update public.perfiles set rol = 'admin' where id = 'e7000000-0000-0000-0000-000000000003';
update public.perfiles set correo_verificado_en = now() where id::text like 'e7000000-%';

insert into public.marcas (id, perfil_id, nombre_comercial, categoria_id)
select v.id, v.perfil, v.nombre, c.id
  from (values
    ('e7100000-0000-0000-0000-000000000002'::uuid, 'e7000000-0000-0000-0000-000000000002'::uuid, 'Cacao Destacado'),
    ('e7100000-0000-0000-0000-000000000004'::uuid, 'e7000000-0000-0000-0000-000000000004'::uuid, 'Cacao con Descuento')
  ) as v (id, perfil, nombre)
  cross join public.categorias c where c.slug = 'chocolateria';

insert into public.productos_servicios (marca_id, nombre)
values ('e7100000-0000-0000-0000-000000000002', 'Barra'),
       ('e7100000-0000-0000-0000-000000000004', 'Barra');

insert into public.sucursales (id, marca_id, nombre_sucursal, slug, entidad, estado, acerca_de, logo, tier_id)
values ('e7200000-0000-0000-0000-000000000002', 'e7100000-0000-0000-0000-000000000002',
        'Centro', 'cacao-destacado', 'Tabasco', 'publicado', 'Cacao', 'logo.png', 1),
       ('e7200000-0000-0000-0000-000000000004', 'e7100000-0000-0000-0000-000000000004',
        'Centro', 'cacao-descuento', 'Tabasco', 'publicado', 'Cacao', 'logo.png', 1);

-- ---------------------------------------------------------------- el alta da los dos codigos
set local role authenticated;
set local request.jwt.claims to '{"sub":"e7000000-0000-0000-0000-000000000003","role":"authenticated"}';

select public.asignar_embajador('e7000000-0000-0000-0000-000000000001') as codigo \gset
select codigo_destacado as destacado from public.embajadores
 where perfil_id = 'e7000000-0000-0000-0000-000000000001' \gset

select pg_temp.debe_ser('el de descuento sigue siendo NOMBRE-XXXX: ' || :'codigo', :'codigo' like 'LUCIA-____');
select pg_temp.debe_ser('el destacado es TOP-NOMBRE-XXX: ' || :'destacado', :'destacado' like 'TOP-LUCIA-___');
select pg_temp.debe_ser('volver a asignar conserva el destacado',
  (public.asignar_embajador('e7000000-0000-0000-0000-000000000001') is not null)
  and (select codigo_destacado from public.embajadores
        where perfil_id = 'e7000000-0000-0000-0000-000000000001') = :'destacado');

-- ---------------------------------------------------------------- la vendedora no lo cambia
set local request.jwt.claims to '{"sub":"e7000000-0000-0000-0000-000000000001","role":"authenticated"}';

select pg_temp.debe_fallar('la vendedora no se cambia el codigo destacado',
  $q$ update public.embajadores set codigo_destacado = 'TOP-LO-QUE-YO-QUIERA'
       where perfil_id = 'e7000000-0000-0000-0000-000000000001' $q$);

-- ---------------------------------------------------------------- el negocio pone el destacado
set local request.jwt.claims to '{"sub":"e7000000-0000-0000-0000-000000000002","role":"authenticated"}';

select pg_temp.debe_ser('el codigo destacado se reconoce como destacado',
  (select tipo from public.codigo_de_asesor(lower(:'destacado'))) = 'destacado');
select pg_temp.debe_ser('el de descuento se reconoce como descuento',
  (select tipo from public.codigo_de_asesor(:'codigo')) = 'descuento');
select pg_temp.debe_ser('un codigo inventado no es de nadie',
  not exists (select 1 from public.codigo_de_asesor('TOP-NADIE-123')));

select pg_temp.debe_ser('poner el destacado lo vincula con su vendedora',
  public.vincular_embajador('e7100000-0000-0000-0000-000000000002', :'destacado') = 'Lucía Pérez');
select pg_temp.debe_ser('ponerlo otra vez no cambia nada',
  public.vincular_embajador('e7100000-0000-0000-0000-000000000002', :'destacado') = 'Lucía Pérez');
select pg_temp.debe_fallar('no se pone ademas el de descuento de la misma vendedora',
  format($q$ select public.vincular_embajador('e7100000-0000-0000-0000-000000000002', %L) $q$, :'codigo'));

select pg_temp.debe_ser('el destacado no da descuento en el primer pago',
  not exists (select 1 from public.codigo_de_embajador_de('e7100000-0000-0000-0000-000000000002')));
select pg_temp.debe_ser('el negocio ve hasta cuando esta destacado, tres meses',
  public.destacada_hasta('e7100000-0000-0000-0000-000000000002')
    between now() + interval '3 months' - interval '1 minute' and now() + interval '3 months' + interval '1 minute');
select pg_temp.debe_ser('y otro negocio no lo ve',
  public.destacada_hasta('e7100000-0000-0000-0000-000000000004') is null);

-- ---------------------------------------------------------------- el otro negocio, el de descuento
set local request.jwt.claims to '{"sub":"e7000000-0000-0000-0000-000000000004","role":"authenticated"}';

select pg_temp.debe_ser('el de descuento se vincula como antes',
  public.vincular_embajador('e7100000-0000-0000-0000-000000000004', :'codigo') = 'Lucía Pérez');
select pg_temp.debe_ser('y si espera su descuento en el primer pago',
  exists (select 1 from public.codigo_de_embajador_de('e7100000-0000-0000-0000-000000000004')));

-- ---------------------------------------------------------------- la portada
reset role;
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';

select pg_temp.debe_ser('sin sesion se ve quien esta en Destacados',
  'e7200000-0000-0000-0000-000000000002'::uuid in (select sucursal_id from public.sucursales_destacadas()));
select pg_temp.debe_ser('el de descuento no sale en Destacados',
  not ('e7200000-0000-0000-0000-000000000004'::uuid in (select sucursal_id from public.sucursales_destacadas())));

reset role;

-- Pasados tres meses se apaga solo.
update public.referidos set vinculado_en = now() - interval '3 months' - interval '1 day'
 where marca_id = 'e7100000-0000-0000-0000-000000000002';
select pg_temp.debe_ser('a los tres meses sale de Destacados solo',
  not ('e7200000-0000-0000-0000-000000000002'::uuid in (select sucursal_id from public.sucursales_destacadas())));
update public.referidos set vinculado_en = now()
 where marca_id = 'e7100000-0000-0000-0000-000000000002';

-- En borrador no sale: Destacados es parte del directorio publico.
update public.sucursales set estado = 'borrador' where id = 'e7200000-0000-0000-0000-000000000002';
select pg_temp.debe_ser('en borrador no sale en Destacados',
  not ('e7200000-0000-0000-0000-000000000002'::uuid in (select sucursal_id from public.sucursales_destacadas())));

-- ---------------------------------------------------------------- la comision es la misma
select public.registrar_comision('e7100000-0000-0000-0000-000000000002', 499, 'sub_top', 'in_top_1') as comision \gset
select pg_temp.debe_ser('con el destacado la vendedora gana su 25%: ' || :'comision', :'comision'::numeric = 124.75);

set local role authenticated;
set local request.jwt.claims to '{"sub":"e7000000-0000-0000-0000-000000000001","role":"authenticated"}';

select pg_temp.debe_ser('la vendedora ve que codigo dio a cada negocio',
  (select array_agg(tipo order by marca) from public.mis_referidos()) = array['descuento', 'destacado']);

reset role;

rollback;
