\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages to notice;

-- Plan unico y Embajadores del Cacao (migracion 000059).
--
-- Un embajador no se aprueba solo ni se pone su codigo; nadie usa su propio
-- codigo; una marca tiene un solo embajador y solo antes de su primer pago;
-- la comision se anota una vez; cada quien ve solo lo suyo; y solo el
-- administrador registra que pago.
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
-- 1 embajadora (clienta), 2 negocio que llega con su codigo, 3 otro negocio,
-- 4 administrador, 5 otra clienta curiosa.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('e2000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'embajadora@prueba.mx', 'x', now(),
   '{}', '{"nombre":"Lucía Pérez","rol":"cliente"}', now(), now()),
  ('e2000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'referido@prueba.mx', 'x', now(),
   '{}', '{"nombre":"Referido","rol":"negocio"}', now(), now()),
  ('e2000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'otro-negocio@prueba.mx', 'x', now(),
   '{}', '{"nombre":"Otro","rol":"negocio"}', now(), now()),
  ('e2000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'admin-embajadores@prueba.mx', 'x', now(),
   '{}', '{"nombre":"Admin","rol":"cliente"}', now(), now()),
  ('e2000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'curiosa@prueba.mx', 'x', now(),
   '{}', '{"nombre":"Curiosa","rol":"cliente"}', now(), now());

update public.perfiles set rol = 'admin' where id = 'e2000000-0000-0000-0000-000000000004';
update public.perfiles set correo_verificado_en = now()
 where id::text like 'e2000000-%';

insert into public.marcas (id, perfil_id, nombre_comercial, categoria_id)
select v.id::uuid, v.perfil::uuid, v.nombre, c.id
  from (values
    ('e2100000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000001', 'Cacao de la Embajadora'),
    ('e2100000-0000-0000-0000-000000000002', 'e2000000-0000-0000-0000-000000000002', 'Cacao Referido'),
    ('e2100000-0000-0000-0000-000000000003', 'e2000000-0000-0000-0000-000000000003', 'Cacao que ya pagó')
  ) as v (id, perfil, nombre)
  cross join (select id from public.categorias where slug = 'chocolateria') c;

update public.marcas set stripe_customer_id = 'cus_ya_pago'
 where id = 'e2100000-0000-0000-0000-000000000003';

-- ---------------------------------------------------------------- el plan unico
select pg_temp.debe_ser('el Pro cuesta 499 y el Gratis dura 15 dias',
  (select precio_mensual from public.tiers where id = 3) = 499 and public.dias_gratis() = 15);
select pg_temp.debe_ser('el Basico ya no se ofrece',
  not (select se_ofrece from public.tiers where id = 2));

-- ---------------------------------------------------------------- pedir ser embajadora
set local role authenticated;
set local request.jwt.claims to '{"sub":"e2000000-0000-0000-0000-000000000001","role":"authenticated"}';

select pg_temp.debe_fallar('no se pide ya aprobada',
  $q$ insert into public.embajadores (perfil_id, estado) values ('e2000000-0000-0000-0000-000000000001', 'activo') $q$);
select pg_temp.debe_fallar('no se pide con codigo propio',
  $q$ insert into public.embajadores (perfil_id, codigo) values ('e2000000-0000-0000-0000-000000000001', 'MIO-1234') $q$);
select pg_temp.debe_fallar('no se pide a nombre de otra persona',
  $q$ insert into public.embajadores (perfil_id) values ('e2000000-0000-0000-0000-000000000005') $q$);

insert into public.embajadores (perfil_id, motivo)
values ('e2000000-0000-0000-0000-000000000001', 'Conozco a muchas chocolateras');

select pg_temp.debe_fallar('no se aprueba sola',
  $q$ update public.embajadores set estado = 'activo' where perfil_id = 'e2000000-0000-0000-0000-000000000001' $q$);
select pg_temp.debe_fallar('no decide su propio estado por la funcion',
  $q$ select public.decidir_embajador('e2000000-0000-0000-0000-000000000001', 'activo') $q$);
select pg_temp.debe_fallar('la CLABE lleva 18 digitos',
  $q$ update public.embajadores set clabe = '1234' where perfil_id = 'e2000000-0000-0000-0000-000000000001' $q$);

update public.embajadores set clabe = '012345678901234567', titular = 'Lucía Pérez', banco = 'BBVA'
 where perfil_id = 'e2000000-0000-0000-0000-000000000001';

reset role;

-- ---------------------------------------------------------------- el administrador aprueba
set local role authenticated;
set local request.jwt.claims to '{"sub":"e2000000-0000-0000-0000-000000000004","role":"authenticated"}';

select public.decidir_embajador('e2000000-0000-0000-0000-000000000001', 'activo') as codigo \gset

select pg_temp.debe_ser('el codigo nace del nombre: ' || :'codigo', :'codigo' like 'LUCIA-____');

reset role;

-- ---------------------------------------------------------------- nadie usa su propio codigo
set local role authenticated;
set local request.jwt.claims to '{"sub":"e2000000-0000-0000-0000-000000000002","role":"authenticated"}';

select pg_temp.debe_fallar('no se vincula la marca de otro',
  format($q$ select public.vincular_embajador('e2100000-0000-0000-0000-000000000003', %L) $q$, :'codigo'));

select pg_temp.debe_ser('un codigo que no es de embajador devuelve null',
  public.vincular_embajador('e2100000-0000-0000-0000-000000000002', 'NOEXISTE') is null);

select pg_temp.debe_ser('el codigo se escribe como sea (minusculas, sin guion)',
  public.vincular_embajador('e2100000-0000-0000-0000-000000000002', lower(replace(:'codigo', '-', ''))) = 'Lucía Pérez');

select pg_temp.debe_ser('ponerlo dos veces no falla',
  public.vincular_embajador('e2100000-0000-0000-0000-000000000002', :'codigo') = 'Lucía Pérez');

select pg_temp.debe_ser('el negocio ve su descuento pendiente',
  (select count(*) from public.codigo_de_embajador_de('e2100000-0000-0000-0000-000000000002')) = 1);

select pg_temp.debe_ser('el negocio no ve la tabla de referidos',
  (select count(*) from public.referidos) = 0);

select pg_temp.debe_fallar('el negocio no escribe referidos',
  $q$ insert into public.referidos (marca_id, embajador_id) values ('e2100000-0000-0000-0000-000000000002', 'e2000000-0000-0000-0000-000000000005') $q$);

select pg_temp.debe_fallar('el negocio no se anota la comision',
  $q$ select public.registrar_comision('e2100000-0000-0000-0000-000000000002', 1000, 'sub_x') $q$);

reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub":"e2000000-0000-0000-0000-000000000003","role":"authenticated"}';

select pg_temp.debe_fallar('una marca que ya pago no estrena descuento',
  format($q$ select public.vincular_embajador('e2100000-0000-0000-0000-000000000003', %L) $q$, :'codigo'));

reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub":"e2000000-0000-0000-0000-000000000001","role":"authenticated"}';

select pg_temp.debe_ser('la embajadora ve su referido, todavia sin comision',
  (select count(*) from public.referidos where comision is null) = 1);

reset role;

-- ---------------------------------------------------------------- Stripe confirma el pago
set local request.jwt.claims to '{"role":"service_role"}';

select public.registrar_comision('e2100000-0000-0000-0000-000000000002', 399.20, 'sub_referido') as comision \gset
select pg_temp.debe_ser('la comision es el 20% de lo pagado: ' || :'comision', :'comision'::numeric = 79.84);

select public.registrar_comision('e2100000-0000-0000-0000-000000000002', 399.20, 'sub_referido') as repetida \gset
select pg_temp.debe_ser('un aviso repetido no la anota dos veces', :'repetida'::numeric = 0);

select pg_temp.debe_ser('ya no queda descuento pendiente',
  (select count(*) from public.codigo_de_embajador_de('e2100000-0000-0000-0000-000000000002')) = 0);

reset role;

-- ---------------------------------------------------------------- cada quien ve lo suyo
set local role authenticated;
set local request.jwt.claims to '{"sub":"e2000000-0000-0000-0000-000000000005","role":"authenticated"}';

select pg_temp.debe_ser('la curiosa no ve embajadores, referidos ni pagos',
  (select count(*) from public.embajadores) = 0
  and (select count(*) from public.referidos) = 0
  and (select count(*) from public.pagos_a_embajadores) = 0);

select pg_temp.debe_fallar('la curiosa no registra pagos',
  $q$ select public.registrar_pago_a_embajador('e2000000-0000-0000-0000-000000000001', 'x') $q$);

select pg_temp.debe_fallar('la curiosa no edita la CLABE ajena',
  $q$ do $d$ begin
        update public.embajadores set clabe = '999999999999999999'
         where perfil_id = 'e2000000-0000-0000-0000-000000000001';
        if not found then raise exception 'no se toco nada'; end if;
      end $d$ $q$);

reset role;

-- ---------------------------------------------------------------- el administrador paga
set local role authenticated;
set local request.jwt.claims to '{"sub":"e2000000-0000-0000-0000-000000000004","role":"authenticated"}';

select public.registrar_pago_a_embajador('e2000000-0000-0000-0000-000000000001', 'SPEI 123') as pagado \gset
select pg_temp.debe_ser('se le paga lo acumulado: ' || :'pagado', :'pagado'::numeric = 79.84);

select pg_temp.debe_fallar('no se paga dos veces lo mismo',
  $q$ select public.registrar_pago_a_embajador('e2000000-0000-0000-0000-000000000001', 'otra vez') $q$);

reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub":"e2000000-0000-0000-0000-000000000001","role":"authenticated"}';

select pg_temp.debe_ser('la embajadora ve su pago y su comision cubierta',
  (select count(*) from public.pagos_a_embajadores) = 1
  and (select count(*) from public.referidos where pago_id is not null) = 1);

select pg_temp.debe_fallar('nadie usa su propio codigo',
  format($q$ select public.vincular_embajador('e2100000-0000-0000-0000-000000000001', %L) $q$, :'codigo'));

reset role;

rollback;
