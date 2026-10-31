\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages to notice;

-- Adjuntos en el buzon (migracion 000072).
--
-- Suben y leen solo las dos partes de la conversacion. Tipo y tamano salen
-- del archivo guardado, no del mensaje: imagen 5 MB, PDF 10 MB, video 20 MB.
-- Un archivo va en un solo mensaje y lo manda quien lo subio.
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

-- 1 clienta, 2 negocio, 3 alguien de fuera.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('f3100000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'clienta-adjuntos@prueba.mx', 'x', now(),
   '{}', '{"nombre":"Lucía","rol":"cliente"}', now(), now()),
  ('f3100000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'negocio-adjuntos@prueba.mx', 'x', now(),
   '{}', '{"nombre":"Dueña","rol":"negocio"}', now(), now()),
  ('f3100000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'fuera-adjuntos@prueba.mx', 'x', now(),
   '{}', '{"nombre":"Fuera","rol":"cliente"}', now(), now());

update public.perfiles set rol_confirmado = true where id::text like 'f3100000-%';

set local role authenticated;
select pg_temp.como('f3100000-0000-0000-0000-000000000001');
select public.abrir_conversacion('f3100000-0000-0000-0000-000000000002') as conv \gset

-- ---------------------------------------------------------------- subir
-- Subir es insertar en storage.objects con la sesion: lo que hace la API.
insert into storage.objects (bucket_id, name, owner_id, metadata)
values ('buzon', :'conv' || '/foto.jpg', 'f3100000-0000-0000-0000-000000000001',
        '{"size": 300000, "mimetype": "image/jpeg"}'),
       ('buzon', :'conv' || '/enorme.jpg', 'f3100000-0000-0000-0000-000000000001',
        '{"size": 6000000, "mimetype": "image/jpeg"}'),
       ('buzon', :'conv' || '/ficha.pdf', 'f3100000-0000-0000-0000-000000000001',
        '{"size": 6000000, "mimetype": "application/pdf"}');

select pg_temp.debe_fallar('no se sube a una carpeta que no es una conversacion propia',
  $q$ insert into storage.objects (bucket_id, name, owner_id, metadata)
      values ('buzon', '00000000-0000-0000-0000-000000000000/x.jpg',
              'f3100000-0000-0000-0000-000000000001', '{"size":1,"mimetype":"image/jpeg"}') $q$);

-- ---------------------------------------------------------------- mandar
insert into public.mensajes (conversacion_id, texto, adjunto, adjunto_nombre, adjunto_tipo, adjunto_bytes)
values (:'conv', '', :'conv' || '/foto.jpg', 'barra.jpg', 'pdf', 1);

select pg_temp.debe_ser('con adjunto el texto puede ir vacio, y tipo y tamano salen del archivo',
  exists (select 1 from public.mensajes
           where adjunto = :'conv' || '/foto.jpg' and adjunto_tipo = 'imagen'
             and adjunto_bytes = 300000 and adjunto_nombre = 'barra.jpg'));

insert into public.mensajes (conversacion_id, texto, adjunto)
values (:'conv', 'La ficha', :'conv' || '/ficha.pdf');
select pg_temp.debe_ser('un PDF de 6 MB entra (tope 10)',
  exists (select 1 from public.mensajes where adjunto_tipo = 'pdf'));

select pg_temp.debe_fallar('una imagen de mas de 5 MB no entra',
  format($q$ insert into public.mensajes (conversacion_id, texto, adjunto)
      values (%L, '', %L) $q$, :'conv', :'conv' || '/enorme.jpg'));
select pg_temp.debe_fallar('el mismo archivo no va en dos mensajes',
  format($q$ insert into public.mensajes (conversacion_id, texto, adjunto)
      values (%L, 'otra vez', %L) $q$, :'conv', :'conv' || '/foto.jpg'));
select pg_temp.debe_fallar('un adjunto que no subio no entra',
  format($q$ insert into public.mensajes (conversacion_id, texto, adjunto)
      values (%L, '', %L) $q$, :'conv', :'conv' || '/no-existe.jpg'));
select pg_temp.debe_fallar('sin texto y sin adjunto no hay mensaje',
  format($q$ insert into public.mensajes (conversacion_id, texto) values (%L, '  ') $q$, :'conv'));

-- ---------------------------------------------------------------- la otra parte
select pg_temp.como('f3100000-0000-0000-0000-000000000002');
select pg_temp.debe_ser('el negocio ve los adjuntos de su conversacion',
  (select count(*) from storage.objects where bucket_id = 'buzon') = 3);

insert into storage.objects (bucket_id, name, owner_id, metadata)
values ('buzon', :'conv' || '/de-ella.mp4', 'f3100000-0000-0000-0000-000000000002',
        '{"size": 15000000, "mimetype": "video/mp4"}');
select pg_temp.como('f3100000-0000-0000-0000-000000000001');
select pg_temp.debe_fallar('no se manda un archivo que subio la otra parte',
  format($q$ insert into public.mensajes (conversacion_id, texto, adjunto)
      values (%L, '', %L) $q$, :'conv', :'conv' || '/de-ella.mp4'));

select pg_temp.como('f3100000-0000-0000-0000-000000000002');
insert into public.mensajes (conversacion_id, texto, adjunto)
values (:'conv', 'Así se ve', :'conv' || '/de-ella.mp4');
select pg_temp.debe_ser('un video de 15 MB entra (tope 20)',
  exists (select 1 from public.mensajes where adjunto_tipo = 'video'));

-- ---------------------------------------------------------------- de fuera
select pg_temp.como('f3100000-0000-0000-0000-000000000003');
select pg_temp.debe_ser('alguien de fuera no ve ningun adjunto',
  not exists (select 1 from storage.objects where bucket_id = 'buzon'));
select pg_temp.debe_fallar('alguien de fuera no sube a esa conversacion',
  format($q$ insert into storage.objects (bucket_id, name, owner_id, metadata)
      values ('buzon', %L, 'f3100000-0000-0000-0000-000000000003', '{"size":1,"mimetype":"image/jpeg"}') $q$,
      :'conv' || '/intruso.jpg'));

reset role;
select pg_temp.debe_ser('el bucket es privado',
  not (select public from storage.buckets where id = 'buzon'));
select pg_temp.debe_ser('en el bucket no hay politica para cambiar ni borrar',
  not exists (select 1 from pg_policies
               where schemaname = 'storage' and tablename = 'objects'
                 and policyname like 'buzon%' and cmd in ('UPDATE', 'DELETE', 'ALL')));

rollback;
