\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages to notice;

-- El buzon (migracion 000069).
--
-- A un negocio, a la administracion y a un asesor se les escribe en frio; a
-- un cliente solo se le contesta. Cada quien ve solo sus conversaciones; el
-- administrador las lee para moderar pero no habla en las ajenas. Nada se
-- edita ni se borra. Los reportes no van contra lo propio, y el aviso de
-- mensaje nuevo solo llega a quien lo pidio, uno por conversacion.
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
-- 1 clienta, 2 negocio, 3 administrador, 4 otro cliente (el tercero).
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('f2800000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'clienta-buzon@prueba.mx', 'x', now(),
   '{}', '{"nombre":"Lucía","rol":"cliente"}', now(), now()),
  ('f2800000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'negocio-buzon@prueba.mx', 'x', now(),
   '{}', '{"nombre":"Dueño","rol":"negocio"}', now(), now()),
  ('f2800000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'admin-buzon@prueba.mx', 'x', now(),
   '{}', '{"nombre":"Admin","rol":"cliente"}', now(), now()),
  ('f2800000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'tercero-buzon@prueba.mx', 'x', now(),
   '{}', '{"nombre":"Tercero","rol":"cliente"}', now(), now());

update public.perfiles set rol = 'admin' where id = 'f2800000-0000-0000-0000-000000000003';
update public.perfiles set rol_confirmado = true where id::text like 'f2800000-%';

insert into public.marcas (id, perfil_id, nombre_comercial, categoria_id)
select 'f2810000-0000-0000-0000-000000000002', 'f2800000-0000-0000-0000-000000000002',
       'Cacao del Buzón', c.id
  from public.categorias c where c.slug = 'chocolateria';

set local role authenticated;

-- ---------------------------------------------------------------- a quien se le escribe
select pg_temp.como('f2800000-0000-0000-0000-000000000001');

select pg_temp.debe_fallar('un cliente no le escribe en frio a otro cliente',
  $q$ select public.abrir_conversacion('f2800000-0000-0000-0000-000000000004') $q$);
select pg_temp.debe_fallar('nadie se escribe a si mismo',
  $q$ select public.abrir_conversacion('f2800000-0000-0000-0000-000000000001') $q$);
select pg_temp.debe_fallar('no se crea una conversacion a mano',
  $q$ insert into public.conversaciones (iniciada_por, para)
      values ('f2800000-0000-0000-0000-000000000001', 'f2800000-0000-0000-0000-000000000002') $q$);

select public.abrir_conversacion_con_marca('f2810000-0000-0000-0000-000000000002') as con_negocio \gset
select pg_temp.debe_ser('escribirle otra vez al negocio retoma la misma',
  public.abrir_conversacion('f2800000-0000-0000-0000-000000000002') = :'con_negocio');
select public.abrir_conversacion('f2800000-0000-0000-0000-000000000003') as con_admin \gset
select pg_temp.debe_ser('a la administracion se le escribe', :'con_admin' is not null);

select pg_temp.debe_ser('el buscador encuentra a la administracion sin escribir nada',
  exists (select 1 from public.buscar_destinatarios('') where tipo = 'guia'));
select pg_temp.debe_ser('el buscador no encuentra a otros clientes',
  not exists (select 1 from public.buscar_destinatarios('Tercero') where tipo = 'persona'));

insert into public.mensajes (conversacion_id, texto)
values (:'con_negocio', '  ¿Tienen barra de 70%?  ');

select pg_temp.debe_fallar('no se escribe a nombre de otro',
  format($q$ insert into public.mensajes (conversacion_id, autor_id, texto)
      values (%L, 'f2800000-0000-0000-0000-000000000002', 'Sí, claro') $q$, :'con_negocio'));
select pg_temp.debe_fallar('un mensaje vacio no entra',
  format($q$ insert into public.mensajes (conversacion_id, texto) values (%L, '   ') $q$, :'con_negocio'));
select pg_temp.debe_fallar('no se reporta el propio mensaje',
  format($q$ insert into public.reportes_conversacion (conversacion_id, mensaje_id, motivo)
      select %L, id, 'spam' from public.mensajes where conversacion_id = %L $q$,
      :'con_negocio', :'con_negocio'));
select pg_temp.debe_fallar('no se reporta una conversacion donde solo hablo uno mismo',
  format($q$ insert into public.reportes_conversacion (conversacion_id, motivo)
      values (%L, 'acoso') $q$, :'con_negocio'));

-- ---------------------------------------------------------------- nada se edita ni se borra
select pg_temp.debe_fallar('un mensaje no se edita',
  format($q$ update public.mensajes set texto = 'otra cosa' where conversacion_id = %L $q$, :'con_negocio'));
select pg_temp.debe_fallar('un mensaje no se borra',
  format($q$ delete from public.mensajes where conversacion_id = %L $q$, :'con_negocio'));
select pg_temp.debe_fallar('una conversacion no se borra',
  format($q$ delete from public.conversaciones where id = %L $q$, :'con_negocio'));
select pg_temp.debe_fallar('una lectura no se escribe a mano',
  format($q$ insert into public.lecturas_conversacion (conversacion_id, usuario_id, leida_en)
      values (%L, 'f2800000-0000-0000-0000-000000000001', now() + interval '1 year') $q$, :'con_negocio'));

select pg_temp.debe_ser('el texto se guarda sin espacios de sobra',
  (select texto from public.mensajes where conversacion_id = :'con_negocio') = '¿Tienen barra de 70%?');

-- ---------------------------------------------------------------- el negocio contesta
select pg_temp.como('f2800000-0000-0000-0000-000000000002');

select pg_temp.debe_ser('el negocio ve un mensaje sin leer', public.mensajes_sin_leer() = 1);
select pg_temp.debe_ser('sin avisos: no los pidio',
  not exists (select 1 from public.notificaciones where tipo = 'mensaje'));
select pg_temp.debe_ser('en su buzon la clienta sale con su nombre',
  (select otro_nombre from public.mis_conversaciones()) = 'Lucía');

select pg_temp.debe_ser('contestarle a la clienta retoma la conversacion',
  public.abrir_conversacion('f2800000-0000-0000-0000-000000000001') = :'con_negocio');
insert into public.mensajes (conversacion_id, texto) values (:'con_negocio', 'Sí, y de 85%.');
select pg_temp.debe_ser('escribir deja leida la conversacion', public.mensajes_sin_leer() = 0);

-- Enciende el aviso: lo escribe el trigger de aqui en adelante.
update public.perfiles set avisar_mensajes = true where id = 'f2800000-0000-0000-0000-000000000002';

-- ---------------------------------------------------------------- la clienta, otra vez
select pg_temp.como('f2800000-0000-0000-0000-000000000001');

select pg_temp.debe_ser('la clienta ve al negocio por su marca',
  (select otro_nombre from public.mis_conversaciones() where id = :'con_negocio') = 'Cacao del Buzón');
select pg_temp.debe_ser('y la respuesta sin leer',
  (select sin_leer from public.mis_conversaciones() where id = :'con_negocio') = 1);

insert into public.mensajes (conversacion_id, texto) values (:'con_negocio', 'Voy el sábado');
insert into public.mensajes (conversacion_id, texto) values (:'con_negocio', '¿Abren temprano?');

insert into public.reportes_conversacion (conversacion_id, mensaje_id, motivo, detalle)
select :'con_negocio', id, 'spam', 'Me manda promociones'
  from public.mensajes where conversacion_id = :'con_negocio' and texto = 'Sí, y de 85%.';
select pg_temp.debe_fallar('no se reporta dos veces lo mismo mientras esta pendiente',
  format($q$ insert into public.reportes_conversacion (conversacion_id, mensaje_id, motivo)
      select %L, id, 'otro' from public.mensajes where conversacion_id = %L and texto = 'Sí, y de 85%%.' $q$,
      :'con_negocio', :'con_negocio'));
-- Se intenta mandar ya atendido: el trigger lo deja pendiente.
insert into public.reportes_conversacion (conversacion_id, motivo, atendido_en)
values (:'con_negocio', 'acoso', now());
select pg_temp.debe_ser('un reporte nace pendiente aunque lo manden atendido',
  (select count(*) from public.reportes_conversacion where atendido_en is null) = 2);
select pg_temp.debe_fallar('la clienta no ve la cola del administrador',
  $q$ select * from public.conversaciones_reportadas() $q$);

-- ---------------------------------------------------------------- el aviso
select pg_temp.como('f2800000-0000-0000-0000-000000000002');

select pg_temp.debe_ser('dos mensajes seguidos dejan un solo aviso',
  (select count(*) from public.notificaciones where tipo = 'mensaje' and not leida) = 1);
select pg_temp.debe_ser('el aviso lleva a la conversacion y dice quien',
  (select enlace = '/buzon/' || :'con_negocio' and titulo = 'Lucía te escribió'
     from public.notificaciones where tipo = 'mensaje'));
select pg_temp.debe_ser('el negocio no sabe que lo reportaron',
  not exists (select 1 from public.reportes_conversacion));

select public.marcar_conversacion_leida(:'con_negocio');
select pg_temp.debe_ser('abrir la conversacion apaga el aviso y el contador',
  public.mensajes_sin_leer() = 0
  and not exists (select 1 from public.notificaciones where tipo = 'mensaje' and not leida));

-- ---------------------------------------------------------------- el tercero
select pg_temp.como('f2800000-0000-0000-0000-000000000004');

select pg_temp.debe_ser('un tercero no ve la conversacion ni sus mensajes',
  not exists (select 1 from public.conversaciones)
  and not exists (select 1 from public.mensajes)
  and not exists (select 1 from public.mis_conversaciones())
  and not exists (select 1 from public.participantes_de(:'con_negocio')));
select pg_temp.debe_fallar('un tercero no escribe en ella',
  format($q$ insert into public.mensajes (conversacion_id, texto) values (%L, 'Hola') $q$, :'con_negocio'));
select pg_temp.debe_fallar('un tercero no la reporta',
  format($q$ insert into public.reportes_conversacion (conversacion_id, motivo) values (%L, 'spam') $q$, :'con_negocio'));
select pg_temp.debe_fallar('un tercero no la marca leida a nombre de nadie',
  format($q$ insert into public.lecturas_conversacion (conversacion_id, usuario_id)
      values (%L, 'f2800000-0000-0000-0000-000000000004') $q$, :'con_negocio'));

-- ---------------------------------------------------------------- el administrador
select pg_temp.como('f2800000-0000-0000-0000-000000000003');

select pg_temp.debe_ser('el administrador lee la conversacion ajena para moderar',
  (select count(*) from public.mensajes where conversacion_id = :'con_negocio') = 4);
select pg_temp.debe_ser('pero su buzon solo trae las suyas',
  not exists (select 1 from public.mis_conversaciones() where id = :'con_negocio'));
select pg_temp.debe_fallar('el administrador no habla en una conversacion ajena',
  format($q$ insert into public.mensajes (conversacion_id, texto) values (%L, 'Soy admin') $q$, :'con_negocio'));
select pg_temp.debe_ser('ve las dos partes con su nombre',
  (select array_agg(nombre order by inicio desc) from public.participantes_de(:'con_negocio'))
    = array['Lucía', 'Cacao del Buzón']);
select pg_temp.debe_ser('el administrador encuentra a cualquiera',
  exists (select 1 from public.buscar_destinatarios('Tercero') where tipo = 'persona'));
select pg_temp.debe_ser('y le puede escribir a un cliente',
  public.abrir_conversacion('f2800000-0000-0000-0000-000000000004') is not null);

select pg_temp.debe_ser('la cola trae la conversacion con sus dos reportes',
  (select reportes = 2 and motivos = array['acoso', 'spam'] and detalles = array['Me manda promociones']
          and cardinality(mensajes_reportados) = 1 and quienes = array['Lucía']
     from public.conversaciones_reportadas() where conversacion_id = :'con_negocio'));

select public.atender_reportes_de_conversacion(:'con_negocio');
select pg_temp.debe_ser('atendidos salen de la cola pero no se borran',
  not exists (select 1 from public.conversaciones_reportadas() where conversacion_id = :'con_negocio')
  and (select count(*) from public.reportes_conversacion
        where conversacion_id = :'con_negocio' and atendido_en is not null) = 2);

-- ---------------------------------------------------------------- la clienta puede volver a reportar
select pg_temp.como('f2800000-0000-0000-0000-000000000001');
select pg_temp.debe_fallar('quien reporto no atiende reportes',
  format($q$ select public.atender_reportes_de_conversacion(%L) $q$, :'con_negocio'));
insert into public.reportes_conversacion (conversacion_id, motivo) values (:'con_negocio', 'acoso');
select pg_temp.debe_ser('ya atendido, se puede volver a reportar',
  (select count(*) from public.reportes_conversacion where atendido_en is null) = 1);

reset role;

\echo '--- sin llaves a perfiles (sin PGRST201 en la API) ---'
select pg_temp.debe_ser('ninguna tabla del buzon apunta a perfiles',
  not exists (
    select 1 from pg_constraint
     where contype = 'f'
       and confrelid = 'public.perfiles'::regclass
       and conrelid in ('public.conversaciones'::regclass, 'public.mensajes'::regclass,
                        'public.lecturas_conversacion'::regclass, 'public.reportes_conversacion'::regclass)
  ));
select pg_temp.debe_ser('ninguna tabla del buzon tiene politica de update o delete',
  not exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename in ('conversaciones', 'mensajes', 'lecturas_conversacion', 'reportes_conversacion')
       and cmd in ('UPDATE', 'DELETE', 'ALL')
  ));

rollback;
