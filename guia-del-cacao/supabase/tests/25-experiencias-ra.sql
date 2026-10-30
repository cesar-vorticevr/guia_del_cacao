\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages to notice;

-- Experiencias de realidad aumentada y la ruleta de cacao (000066).
--
-- Gratis arma experiencias pero no las publica; Pro publica tres; la cuarta
-- pide una experiencia extra pagada, que solo suma la llave de servicio. El
-- visor solo enseña lo publicado con plan. Gratis guarda su ruleta. En una
-- ruleta sin limite, un premio vigente sin canjear no deja ganar otro.
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

-- 1 negocio Pro, 2 negocio con el Gratis ya vencido, 3 clienta. Desde la 000068
-- el Gratis trae todo durante sus quince dias (prueba 27); vencido, nada.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('f2900000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ra-pro@prueba.mx', 'x', now(),
   '{}', '{"nombre":"Pro","rol":"negocio"}', now(), now()),
  ('f2900000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ra-gratis@prueba.mx', 'x', now(),
   '{}', '{"nombre":"Gratis","rol":"negocio"}', now(), now()),
  ('f2900000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ra-clienta@prueba.mx', 'x', now(),
   '{}', '{"nombre":"Clienta","rol":"cliente"}', now(), now());

update public.perfiles set correo_verificado_en = now(), rol_confirmado = true
 where id::text like 'f2900000-%';

insert into public.marcas (id, perfil_id, nombre_comercial, categoria_id)
select v.id::uuid, v.perfil::uuid, v.nombre, c.id
  from (values
    ('f2910000-0000-0000-0000-0000000000a1', 'f2900000-0000-0000-0000-0000000000a1', 'Cacao Pro'),
    ('f2910000-0000-0000-0000-0000000000a2', 'f2900000-0000-0000-0000-0000000000a2', 'Cacao Gratis')
  ) as v (id, perfil, nombre)
  cross join (select id from public.categorias where slug = 'chocolateria') c;

insert into public.productos_servicios (marca_id, nombre)
values ('f2910000-0000-0000-0000-0000000000a1', 'Barra'), ('f2910000-0000-0000-0000-0000000000a2', 'Barra');

insert into public.sucursales (id, marca_id, nombre_sucursal, slug, entidad, estado, acerca_de, logo, tier_id)
values
  ('f2920000-0000-0000-0000-0000000000a1', 'f2910000-0000-0000-0000-0000000000a1',
   'Centro', 'ra-pro', 'Tabasco', 'publicado', 'Cacao', 'logo.png', 3),
  ('f2920000-0000-0000-0000-0000000000a2', 'f2910000-0000-0000-0000-0000000000a2',
   'Centro', 'ra-gratis', 'Tabasco', 'pausado', 'Cacao', 'logo.png', 1);

insert into public.suscripciones (sucursal_id, tier_id, monto_mensual, estado, fecha_proximo_cobro, fecha_fin_trial)
values ('f2920000-0000-0000-0000-0000000000a1', 3, 0, 'activo', now() + interval '1 month', null),
       ('f2920000-0000-0000-0000-0000000000a2', 1, 0, 'trial', now() + interval '1 month', now() + interval '10 days');

-- Al abrirla, la base la deja en prueba; se vence a mano, como `vencer_pruebas()`.
update public.suscripciones set estado = 'pausado_por_pago', fecha_fin_trial = now() - interval '1 day'
 where sucursal_id = 'f2920000-0000-0000-0000-0000000000a2';

-- ---------------------------------------------------------------- Gratis
set local role authenticated;
set local request.jwt.claims to '{"sub":"f2900000-0000-0000-0000-0000000000a2","role":"authenticated"}';

insert into public.experiencias (marca_id, codigo, titulo, imagen, objetivo, elementos)
values ('f2910000-0000-0000-0000-0000000000a2', 'gratis01', 'Mi tarjeta', 'a/b/imagen.jpg', 'a/b/objetivo.mind',
        '[{"id":"t1","type":"text","text":"Hola"}]');

select pg_temp.debe_ser('gratis arma y guarda su experiencia',
  (select count(*) from public.experiencias where codigo = 'gratis01') = 1);

select pg_temp.debe_ser('gratis no tiene cupo', public.cupo_de_experiencias('f2910000-0000-0000-0000-0000000000a2') = 0);

select pg_temp.debe_fallar('gratis no publica',
  $q$ update public.experiencias set estado = 'publicada' where codigo = 'gratis01' $q$);

select pg_temp.debe_fallar('nadie se regala experiencias extra',
  $q$ update public.marcas set experiencias_extra = 5 where id = 'f2910000-0000-0000-0000-0000000000a2' $q$);

select pg_temp.debe_fallar('ni las suma con la funcion de pago',
  $q$ select public.sumar_experiencia_extra('f2910000-0000-0000-0000-0000000000a2', 'x', 0) $q$);

-- La ruleta se guarda aunque sea Gratis; en publico no sale.
insert into public.ruletas (sucursal_id, frecuencia) values ('f2920000-0000-0000-0000-0000000000a2', 'diaria');
insert into public.premios_ruleta (sucursal_id, orden, texto, probabilidad, es_premio)
values ('f2920000-0000-0000-0000-0000000000a2', 1, 'Trufa', 100, true);

select pg_temp.debe_ser('gratis guarda su ruleta encendida',
  (select activa from public.ruletas where sucursal_id = 'f2920000-0000-0000-0000-0000000000a2'));

select pg_temp.debe_ser('pero no sale entre las ruletas publicas',
  not ('f2920000-0000-0000-0000-0000000000a2'::uuid in (select * from public.sucursales_con_ruleta())));

reset role;

-- ---------------------------------------------------------------- Pro
set local role authenticated;
set local request.jwt.claims to '{"sub":"f2900000-0000-0000-0000-0000000000a1","role":"authenticated"}';

select pg_temp.debe_ser('pro tiene tres', public.cupo_de_experiencias('f2910000-0000-0000-0000-0000000000a1') = 3);

select pg_temp.debe_fallar('no se publica sin imagen',
  $q$ insert into public.experiencias (marca_id, codigo, estado, elementos)
      values ('f2910000-0000-0000-0000-0000000000a1', 'sinimagen', 'publicada', '[{"id":"a"}]') $q$);

insert into public.experiencias (marca_id, codigo, imagen, objetivo, elementos, estado)
select 'f2910000-0000-0000-0000-0000000000a1', 'propro0' || n, 'i.jpg', 'o.mind', '[{"id":"a","type":"text"}]', 'publicada'
  from generate_series(1, 3) n;

select pg_temp.debe_ser('publica tres', (select count(*) from public.experiencias
   where marca_id = 'f2910000-0000-0000-0000-0000000000a1' and estado = 'publicada') = 3);

select pg_temp.debe_fallar('la cuarta no cabe',
  $q$ insert into public.experiencias (marca_id, codigo, imagen, objetivo, elementos, estado)
      values ('f2910000-0000-0000-0000-0000000000a1', 'propro04', 'i.jpg', 'o.mind', '[{"id":"a"}]', 'publicada') $q$);

update public.experiencias set vistas = 999 where codigo = 'propro01';
select pg_temp.debe_ser('las vistas no se escriben a mano',
  (select vistas from public.experiencias where codigo = 'propro01') = 0);

reset role;

-- El pago suma una, una sola vez por referencia.
select pg_temp.debe_ser('el pago suma una', public.sumar_experiencia_extra('f2910000-0000-0000-0000-0000000000a1', 'cs_prueba_1', 499));
select pg_temp.debe_ser('el mismo aviso no suma dos veces',
  not public.sumar_experiencia_extra('f2910000-0000-0000-0000-0000000000a1', 'cs_prueba_1', 499));
select pg_temp.debe_ser('ahora son cuatro', public.cupo_de_experiencias('f2910000-0000-0000-0000-0000000000a1') = 4);

set local role authenticated;
set local request.jwt.claims to '{"sub":"f2900000-0000-0000-0000-0000000000a1","role":"authenticated"}';
insert into public.experiencias (marca_id, codigo, imagen, objetivo, elementos, estado)
values ('f2910000-0000-0000-0000-0000000000a1', 'propro04', 'i.jpg', 'o.mind', '[{"id":"a"}]', 'publicada');
select pg_temp.debe_ser('con la extra cabe la cuarta', true);
reset role;

-- ---------------------------------------------------------------- el visor
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select pg_temp.debe_ser('el visor enseña lo publicado',
  (select se_ve from public.experiencia_publica('propro01')));
select pg_temp.debe_ser('el visor no enseña el borrador de nadie',
  (select count(*) from public.experiencia_publica('gratis01')) = 0);
select public.contar_vista_de_experiencia('propro01');
reset role;
select pg_temp.debe_ser('la vista se cuenta', (select vistas from public.experiencias where codigo = 'propro01') = 1);

-- Bajar de plan oculta sin borrar.
update public.suscripciones set estado = 'pausado_por_pago' where sucursal_id = 'f2920000-0000-0000-0000-0000000000a1';
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select pg_temp.debe_ser('sin plan el visor ya no la enseña',
  (select count(*) from public.experiencia_publica('propro01')) = 0);
reset role;
select pg_temp.debe_ser('y sigue guardada',
  (select estado = 'publicada' from public.experiencias where codigo = 'propro01'));
update public.suscripciones set estado = 'activo' where sucursal_id = 'f2920000-0000-0000-0000-0000000000a1';

-- ---------------------------------------------------------------- ruleta de cacao
insert into public.ruletas (sucursal_id, frecuencia) values ('f2920000-0000-0000-0000-0000000000a1', 'ilimitada');
insert into public.premios_ruleta (sucursal_id, orden, texto, probabilidad, es_premio)
values ('f2920000-0000-0000-0000-0000000000a1', 1, 'Trufa', 100, true);

set local role authenticated;
set local request.jwt.claims to '{"sub":"f2900000-0000-0000-0000-0000000000a3","role":"authenticated"}';
select codigo as premio_vigente from public.girar_ruleta('f2920000-0000-0000-0000-0000000000a1') \gset
select pg_temp.debe_ser('sin limite, con premio vigente: ya no gira de verdad',
  (select not puede_girar from public.mi_giro_en('f2920000-0000-0000-0000-0000000000a1')));
select pg_temp.debe_fallar('y la base no le da otro',
  $q$ select * from public.girar_ruleta('f2920000-0000-0000-0000-0000000000a1') $q$);
reset role;

update public.giros set canjeado_en = now() where codigo = :'premio_vigente';
set local role authenticated;
set local request.jwt.claims to '{"sub":"f2900000-0000-0000-0000-0000000000a3","role":"authenticated"}';
select pg_temp.debe_ser('canjeado, vuelve a ganar',
  (select puede_girar from public.mi_giro_en('f2920000-0000-0000-0000-0000000000a1')));
reset role;

rollback;
