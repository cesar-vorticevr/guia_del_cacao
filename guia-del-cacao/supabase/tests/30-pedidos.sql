\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages to notice;

-- Pedidos con pago por transferencia (migracion 000071).
--
-- Vende solo una sucursal publicada con plan pagado y datos de pago: la prueba
-- Gratis no. El cliente no ve la CLABE hasta que el negocio confirma, y el
-- pagado lo marca el negocio. Cada paso deja su mensaje en el chat. Nada se
-- escribe a mano en las tablas.
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
-- 1 clienta, 2 negocio Pro pagado, 3 negocio en Gratis, 4 otro cliente.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('f3000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'clienta-pedidos@prueba.mx', 'x', now(),
   '{}', '{"nombre":"Lucía","rol":"cliente"}', now(), now()),
  ('f3000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'pro-pedidos@prueba.mx', 'x', now(),
   '{}', '{"nombre":"Dueña","rol":"negocio"}', now(), now()),
  ('f3000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'gratis-pedidos@prueba.mx', 'x', now(),
   '{}', '{"nombre":"Dueño","rol":"negocio"}', now(), now()),
  ('f3000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'tercero-pedidos@prueba.mx', 'x', now(),
   '{}', '{"nombre":"Tercero","rol":"cliente"}', now(), now());

update public.perfiles set rol_confirmado = true, correo_verificado_en = now() where id::text like 'f3000000-%';

insert into public.marcas (id, perfil_id, nombre_comercial, categoria_id)
select v.id::uuid, v.perfil::uuid, v.nombre, c.id
  from public.categorias c,
       (values ('f3010000-0000-0000-0000-000000000002', 'f3000000-0000-0000-0000-000000000002', 'Cacao que vende'),
               ('f3010000-0000-0000-0000-000000000003', 'f3000000-0000-0000-0000-000000000003', 'Cacao a prueba')) as v (id, perfil, nombre)
 where c.slug = 'chocolateria';

insert into public.productos_servicios (id, marca_id, nombre, precio)
values ('f3020000-0000-0000-0000-000000000001', 'f3010000-0000-0000-0000-000000000002', 'Barra 70%', 90),
       ('f3020000-0000-0000-0000-000000000002', 'f3010000-0000-0000-0000-000000000002', 'Trufas', null),
       ('f3020000-0000-0000-0000-000000000003', 'f3010000-0000-0000-0000-000000000002', 'Fuera de catálogo', 10),
       ('f3020000-0000-0000-0000-000000000004', 'f3010000-0000-0000-0000-000000000003', 'Barra', 80);

insert into public.sucursales (id, marca_id, nombre_sucursal, slug, entidad, estado, acerca_de, logo, tier_id)
values ('f3030000-0000-0000-0000-000000000002', 'f3010000-0000-0000-0000-000000000002',
        'Centro', 'pedidos-pro', 'Tabasco', 'publicado', 'Cacao', 'logo.png', 3),
       ('f3030000-0000-0000-0000-000000000003', 'f3010000-0000-0000-0000-000000000003',
        'Centro', 'pedidos-gratis', 'Tabasco', 'publicado', 'Cacao', 'logo.png', 1);

insert into public.productos_sucursal (sucursal_id, producto_id)
values ('f3030000-0000-0000-0000-000000000002', 'f3020000-0000-0000-0000-000000000001'),
       ('f3030000-0000-0000-0000-000000000002', 'f3020000-0000-0000-0000-000000000002'),
       ('f3030000-0000-0000-0000-000000000003', 'f3020000-0000-0000-0000-000000000004');

insert into public.suscripciones (sucursal_id, tier_id, monto_mensual, estado, fecha_proximo_cobro, fecha_fin_trial)
values ('f3030000-0000-0000-0000-000000000002', 3, 499, 'activo', now() + interval '30 days', null),
       ('f3030000-0000-0000-0000-000000000003', 1, 0, 'trial', now() + interval '15 days', now() + interval '15 days');

set local role authenticated;

-- ---------------------------------------------------------------- datos de pago
select pg_temp.como('f3000000-0000-0000-0000-000000000002');

select pg_temp.debe_ser('sin datos de pago no vende',
  public.por_que_no_vende('f3030000-0000-0000-0000-000000000002') like 'Falta anotar%');
select pg_temp.debe_fallar('una CLABE con el digito de control mal no entra',
  $q$ insert into public.datos_de_pago (marca_id, banco, titular, clabe)
      values ('f3010000-0000-0000-0000-000000000002', 'BBVA', 'Cacao que vende SA', '012180001234567890') $q$);
select pg_temp.debe_fallar('no se anotan datos de pago de otra marca',
  $q$ insert into public.datos_de_pago (marca_id, banco, titular, clabe)
      values ('f3010000-0000-0000-0000-000000000003', 'BBVA', 'Otro', '002010077777777771') $q$);

insert into public.datos_de_pago (marca_id, banco, titular, clabe, instrucciones)
values ('f3010000-0000-0000-0000-000000000002', 'Banamex', 'Cacao que vende SA',
        '002 010 07777777777 1', 'Pon tu número de pedido en el concepto.');

select pg_temp.debe_ser('la CLABE se guarda sin espacios',
  (select clabe from public.datos_de_pago) = '002010077777777771');
select pg_temp.debe_ser('con plan pagado y datos de pago, vende',
  public.sucursal_vende('f3030000-0000-0000-0000-000000000002'));

select pg_temp.como('f3000000-0000-0000-0000-000000000003');
insert into public.datos_de_pago (marca_id, banco, titular, clabe)
values ('f3010000-0000-0000-0000-000000000003', 'Banamex', 'A prueba', '002010077777777771');
select pg_temp.debe_ser('el Gratis no vende aunque tenga datos de pago',
  public.por_que_no_vende('f3030000-0000-0000-0000-000000000003') like '%Gratis%');

-- ---------------------------------------------------------------- la clienta pide
select pg_temp.como('f3000000-0000-0000-0000-000000000001');

select pg_temp.debe_ser('la clienta no lee la CLABE de un negocio',
  not exists (select 1 from public.datos_de_pago));
select pg_temp.debe_fallar('al Gratis no se le pide',
  $q$ select public.hacer_pedido('f3030000-0000-0000-0000-000000000003',
      '[{"producto_id":"f3020000-0000-0000-0000-000000000004","cantidad":1}]', 'recoger') $q$);
select pg_temp.debe_fallar('no se pide un producto que la sucursal no maneja',
  $q$ select public.hacer_pedido('f3030000-0000-0000-0000-000000000002',
      '[{"producto_id":"f3020000-0000-0000-0000-000000000003","cantidad":1}]', 'recoger') $q$);
select pg_temp.debe_fallar('un pedido vacio no entra',
  $q$ select public.hacer_pedido('f3030000-0000-0000-0000-000000000002', '[]', 'recoger') $q$);
select pg_temp.debe_fallar('cero piezas no entra',
  $q$ select public.hacer_pedido('f3030000-0000-0000-0000-000000000002',
      '[{"producto_id":"f3020000-0000-0000-0000-000000000001","cantidad":0}]', 'recoger') $q$);
select pg_temp.debe_fallar('un envio sin direccion no entra',
  $q$ select public.hacer_pedido('f3030000-0000-0000-0000-000000000002',
      '[{"producto_id":"f3020000-0000-0000-0000-000000000001","cantidad":1}]', 'envio') $q$);
select pg_temp.debe_fallar('no se escribe un pedido a mano',
  $q$ insert into public.pedidos (comprador_id, marca_id, sucursal_id, conversacion_id, entrega)
      select 'f3000000-0000-0000-0000-000000000001', 'f3010000-0000-0000-0000-000000000002',
             'f3030000-0000-0000-0000-000000000002', id, 'recoger' from public.conversaciones limit 1 $q$);

select public.hacer_pedido('f3030000-0000-0000-0000-000000000002',
  '[{"producto_id":"f3020000-0000-0000-0000-000000000001","cantidad":2},
    {"producto_id":"f3020000-0000-0000-0000-000000000001","cantidad":1},
    {"producto_id":"f3020000-0000-0000-0000-000000000002","cantidad":1}]',
  'envio', 'Calle Reforma 123, Villahermosa', 'Sin nuez') as pedido \gset

select pg_temp.debe_ser('un producto repetido se junta en un renglon',
  (select cantidad from public.pedido_productos where nombre = 'Barra 70%') = 3);
select pg_temp.debe_ser('el subtotal suma lo que tiene precio',
  (select subtotal from public.pedidos where id = :'pedido') = 270);
select pg_temp.debe_ser('el pedido deja su mensaje en el chat',
  exists (select 1 from public.mensajes m join public.pedidos p on p.conversacion_id = m.conversacion_id
           where p.id = :'pedido' and m.texto like 'Pedido #%Barra 70%Sin nuez%'));
select pg_temp.debe_ser('nuevo, la clienta todavia no ve a donde pagar',
  (select pago from public.mis_pedidos('compras') where id = :'pedido') is null);
select pg_temp.debe_fallar('la clienta no se confirma su pedido',
  format($q$ select public.cambiar_estado_pedido(%L, 'confirmado') $q$, :'pedido'));
select pg_temp.debe_fallar('no avisa pago de un pedido sin confirmar',
  format($q$ select public.avisar_pago_de_pedido(%L) $q$, :'pedido'));
select pg_temp.debe_fallar('un pedido no se edita a mano',
  format($q$ update public.pedidos set estado = 'pagado' where id = %L $q$, :'pedido'));

-- ---------------------------------------------------------------- un tercero
select pg_temp.como('f3000000-0000-0000-0000-000000000004');
select pg_temp.debe_ser('otro cliente no ve el pedido ajeno',
  not exists (select 1 from public.pedidos) and not exists (select 1 from public.mis_pedidos()));
select pg_temp.debe_fallar('otro cliente no lo cancela',
  format($q$ select public.cambiar_estado_pedido(%L, 'cancelado') $q$, :'pedido'));

-- ---------------------------------------------------------------- el negocio
select pg_temp.como('f3000000-0000-0000-0000-000000000002');

select pg_temp.debe_ser('el negocio lo ve por atender', public.pedidos_por_atender() = 1);
select pg_temp.debe_ser('y sale con el nombre de la clienta',
  (select otro_nombre from public.mis_pedidos('ventas')) = 'Lucía');
select pg_temp.debe_fallar('con productos sin precio, confirmar pide el total',
  format($q$ select public.cambiar_estado_pedido(%L, 'confirmado') $q$, :'pedido'));
select pg_temp.debe_fallar('no se marca pagado sin confirmar',
  format($q$ select public.cambiar_estado_pedido(%L, 'pagado') $q$, :'pedido'));

select public.cambiar_estado_pedido(:'pedido', 'confirmado', 420);

select pg_temp.debe_ser('confirmado con su total',
  (select estado = 'confirmado' and total = 420 from public.pedidos where id = :'pedido'));
select pg_temp.debe_ser('al confirmar, la CLABE llega al chat',
  exists (select 1 from public.mensajes where texto like 'Confirmo el pedido%002010077777777771%'));

-- ---------------------------------------------------------------- la clienta paga
select pg_temp.como('f3000000-0000-0000-0000-000000000001');

select pg_temp.debe_ser('confirmado, la clienta ve a donde pagar',
  (select pago ->> 'clabe' from public.mis_pedidos('compras') where id = :'pedido') = '002010077777777771');
select pg_temp.debe_fallar('la clienta no se marca pagada',
  format($q$ select public.cambiar_estado_pedido(%L, 'pagado') $q$, :'pedido'));

select public.avisar_pago_de_pedido(:'pedido', 'MBAN0123');
select pg_temp.debe_ser('avisar el pago no lo marca pagado',
  (select estado = 'confirmado' and aviso_de_pago_en is not null from public.pedidos where id = :'pedido'));

select pg_temp.como('f3000000-0000-0000-0000-000000000002');
select public.cambiar_estado_pedido(:'pedido', 'pagado');

select pg_temp.como('f3000000-0000-0000-0000-000000000001');
select pg_temp.debe_fallar('pagado, la clienta ya no lo cancela',
  format($q$ select public.cambiar_estado_pedido(%L, 'cancelado') $q$, :'pedido'));

select pg_temp.como('f3000000-0000-0000-0000-000000000002');
select pg_temp.debe_fallar('el negocio no cancela sin motivo',
  format($q$ select public.cambiar_estado_pedido(%L, 'cancelado') $q$, :'pedido'));
select public.cambiar_estado_pedido(:'pedido', 'entregado');
select pg_temp.debe_ser('entregado', (select estado from public.pedidos where id = :'pedido') = 'entregado');
select pg_temp.debe_fallar('entregado ya no se cancela',
  format($q$ select public.cambiar_estado_pedido(%L, 'cancelado', null, 'ya no') $q$, :'pedido'));

-- ---------------------------------------------------------------- tres esperando
select pg_temp.como('f3000000-0000-0000-0000-000000000001');
select public.hacer_pedido('f3030000-0000-0000-0000-000000000002',
  '[{"producto_id":"f3020000-0000-0000-0000-000000000001","cantidad":1}]', 'recoger')
  from generate_series(1, 3);
select pg_temp.debe_fallar('con tres pedidos sin contestar no se apila un cuarto',
  $q$ select public.hacer_pedido('f3030000-0000-0000-0000-000000000002',
      '[{"producto_id":"f3020000-0000-0000-0000-000000000001","cantidad":1}]', 'recoger') $q$);
select pg_temp.debe_ser('todos los pedidos van en la misma conversacion',
  (select count(distinct conversacion_id) from public.pedidos) = 1);

-- ---------------------------------------------------------------- deja de vender solo
reset role;
update public.suscripciones set estado = 'pausado_por_pago'
 where sucursal_id = 'f3030000-0000-0000-0000-000000000002';
select pg_temp.debe_ser('sin plan pagado deja de vender',
  not public.sucursal_vende('f3030000-0000-0000-0000-000000000002'));

select pg_temp.debe_ser('ninguna tabla de pedidos apunta a perfiles',
  not exists (
    select 1 from pg_constraint
     where contype = 'f'
       and confrelid = 'public.perfiles'::regclass
       and conrelid in ('public.pedidos'::regclass, 'public.pedido_productos'::regclass,
                        'public.datos_de_pago'::regclass)
  ));

rollback;
