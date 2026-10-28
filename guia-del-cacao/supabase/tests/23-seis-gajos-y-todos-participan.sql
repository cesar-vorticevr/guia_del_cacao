\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages to notice;

-- Seis gajos con suerte (000062) y todos participan (000063).
--
-- La rueda siempre tiene seis gajos y sus chances suman 100; la suerte cuenta
-- como giro pero no deja codigo. Un negocio gira, reseña, califica y guarda
-- favoritos de OTROS negocios, nunca de lo suyo.
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

-- 1 negocio con ruleta, 2 otro negocio que visita.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('f2300000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'seis-uno@prueba.mx', 'x', now(),
   '{}', '{"nombre":"Uno","rol":"negocio"}', now(), now()),
  ('f2300000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'seis-dos@prueba.mx', 'x', now(),
   '{}', '{"nombre":"Dos","rol":"negocio"}', now(), now());

update public.perfiles set correo_verificado_en = now(), rol_confirmado = true
 where id::text like 'f2300000-%';

insert into public.marcas (id, perfil_id, nombre_comercial, categoria_id)
select v.id::uuid, v.perfil::uuid, v.nombre, c.id
  from (values
    ('f2400000-0000-0000-0000-0000000000b1', 'f2300000-0000-0000-0000-0000000000b1', 'Uno Cacao'),
    ('f2400000-0000-0000-0000-0000000000b2', 'f2300000-0000-0000-0000-0000000000b2', 'Dos Cacao')
  ) as v (id, perfil, nombre)
  cross join (select id from public.categorias where slug = 'chocolateria') c;

insert into public.productos_servicios (marca_id, nombre)
values ('f2400000-0000-0000-0000-0000000000b1', 'Barra'), ('f2400000-0000-0000-0000-0000000000b2', 'Barra');

insert into public.sucursales (id, marca_id, nombre_sucursal, slug, entidad, estado, acerca_de, logo, tier_id)
values
  ('f2500000-0000-0000-0000-0000000000b1', 'f2400000-0000-0000-0000-0000000000b1',
   'Centro', 'seis-uno', 'Tabasco', 'publicado', 'Cacao', 'logo.png', 3),
  ('f2500000-0000-0000-0000-0000000000b2', 'f2400000-0000-0000-0000-0000000000b2',
   'Centro', 'seis-dos', 'Tabasco', 'publicado', 'Cacao', 'logo.png', 3);

insert into public.suscripciones (sucursal_id, tier_id, monto_mensual, estado, fecha_proximo_cobro)
values ('f2500000-0000-0000-0000-0000000000b1', 3, 0, 'activo', now() + interval '1 month'),
       ('f2500000-0000-0000-0000-0000000000b2', 3, 0, 'activo', now() + interval '1 month');

-- Dos premios y una suerte puesta a mano; los tres gajos vacios, con suerte.
insert into public.ruletas (sucursal_id, frecuencia, relleno)
values ('f2500000-0000-0000-0000-0000000000b1', 'ilimitada', 'suerte');
insert into public.premios_ruleta (sucursal_id, orden, texto, probabilidad, es_premio) values
  ('f2500000-0000-0000-0000-0000000000b1', 1, 'Trufa', 20, true),
  ('f2500000-0000-0000-0000-0000000000b1', 2, 'Barra', 10, true),
  ('f2500000-0000-0000-0000-0000000000b1', 3, 'Suerte para la próxima', 10, false);

select pg_temp.debe_ser('seis gajos que suman 100',
  (select count(*) = 6 and round(sum(probabilidad)) = 100
     from public.gajos_de_ruleta('f2500000-0000-0000-0000-0000000000b1')));
select pg_temp.debe_ser('los vacios son suerte con el resto: 60% entre tres',
  (select count(*) = 3 and bool_and(not es_premio) and bool_and(probabilidad = 20)
     from public.gajos_de_ruleta('f2500000-0000-0000-0000-0000000000b1') where gajo > 3));

update public.ruletas set relleno = 'repetir' where sucursal_id = 'f2500000-0000-0000-0000-0000000000b1';
select pg_temp.debe_ser('repetir reparte el chance de cada premio entre sus copias',
  (select count(*) = 2 and sum(probabilidad) = 20
     from public.gajos_de_ruleta('f2500000-0000-0000-0000-0000000000b1') where texto = 'Trufa'));
update public.ruletas set relleno = 'suerte' where sucursal_id = 'f2500000-0000-0000-0000-0000000000b1';

-- ---------------------------------------------------------------- un negocio gira la de otro
-- Desde la 000066, «sin limite» no da otro premio mientras haya uno vigente
-- sin canjear: entre giro y giro se canjea lo ganado.
create temp table tiros (gajo smallint, premio text, es_premio boolean, codigo text, vence_en date);
grant insert, select on tiros to authenticated;
set local request.jwt.claims to '{"sub":"f2300000-0000-0000-0000-0000000000b2","role":"authenticated"}';

set local role authenticated; insert into tiros select * from public.girar_ruleta('f2500000-0000-0000-0000-0000000000b1'); reset role;
update public.giros set canjeado_en = now() where sucursal_id = 'f2500000-0000-0000-0000-0000000000b1';
set local role authenticated; insert into tiros select * from public.girar_ruleta('f2500000-0000-0000-0000-0000000000b1'); reset role;
update public.giros set canjeado_en = now() where sucursal_id = 'f2500000-0000-0000-0000-0000000000b1';
set local role authenticated; insert into tiros select * from public.girar_ruleta('f2500000-0000-0000-0000-0000000000b1'); reset role;
update public.giros set canjeado_en = now() where sucursal_id = 'f2500000-0000-0000-0000-0000000000b1';
set local role authenticated; insert into tiros select * from public.girar_ruleta('f2500000-0000-0000-0000-0000000000b1'); reset role;
update public.giros set canjeado_en = now() where sucursal_id = 'f2500000-0000-0000-0000-0000000000b1';
set local role authenticated; insert into tiros select * from public.girar_ruleta('f2500000-0000-0000-0000-0000000000b1'); reset role;
update public.giros set canjeado_en = now() where sucursal_id = 'f2500000-0000-0000-0000-0000000000b1';
set local role authenticated; insert into tiros select * from public.girar_ruleta('f2500000-0000-0000-0000-0000000000b1'); reset role;
update public.giros set canjeado_en = now() where sucursal_id = 'f2500000-0000-0000-0000-0000000000b1';
set local role authenticated; insert into tiros select * from public.girar_ruleta('f2500000-0000-0000-0000-0000000000b1'); reset role;
update public.giros set canjeado_en = now() where sucursal_id = 'f2500000-0000-0000-0000-0000000000b1';
set local role authenticated; insert into tiros select * from public.girar_ruleta('f2500000-0000-0000-0000-0000000000b1');

select pg_temp.debe_ser('un negocio gira la ruleta de otro',
  (select count(*) = 8 from tiros));
select pg_temp.debe_ser('la suerte no deja codigo; el premio si',
  (select bool_and((es_premio and codigo is not null) or (not es_premio and codigo is null)) from tiros));
select pg_temp.debe_ser('sus premios son solo los de verdad',
  (select count(*) from public.mis_premios()) = (select count(*) from tiros where es_premio));

-- Reseñar, calificar y guardar al otro negocio: si.
insert into public.calificaciones (usuario_id, sucursal_id, estrellas)
values ('f2300000-0000-0000-0000-0000000000b2', 'f2500000-0000-0000-0000-0000000000b1', 5);
insert into public.resenas (usuario_id, sucursal_id, texto)
values ('f2300000-0000-0000-0000-0000000000b2', 'f2500000-0000-0000-0000-0000000000b1', 'Muy rico');
insert into public.favoritos (usuario_id, sucursal_id)
values ('f2300000-0000-0000-0000-0000000000b2', 'f2500000-0000-0000-0000-0000000000b1');
select pg_temp.debe_ser('un negocio reseña, califica y guarda a otro', true);

-- A si mismo: no.
select pg_temp.debe_fallar('no se califica a si mismo',
  $q$ insert into public.calificaciones (usuario_id, sucursal_id, estrellas)
      values ('f2300000-0000-0000-0000-0000000000b2', 'f2500000-0000-0000-0000-0000000000b2', 5) $q$);
select pg_temp.debe_fallar('no se guarda a si mismo',
  $q$ insert into public.favoritos (usuario_id, sucursal_id)
      values ('f2300000-0000-0000-0000-0000000000b2', 'f2500000-0000-0000-0000-0000000000b2') $q$);

reset role;

rollback;
