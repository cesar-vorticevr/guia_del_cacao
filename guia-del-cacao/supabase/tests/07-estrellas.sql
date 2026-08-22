\set ON_ERROR_STOP on
set client_min_messages to notice;

-- Depende de los datos que deja 01-reglas-negocio.sql:
--   sucursal 5555 publicada, sucursal 8888 en borrador
--   perfil 1111 (cliente), perfil 2222 (negocio, dueno de ambas)
--
-- Aqui se prueban las dos reglas de spec §5.5 tal como quedaron en la
-- migracion 000011: la calificacion es de una sola vez y el comentario es de
-- una vez al dia. Casi todas las pruebas son negativas —lo que NO se debe
-- poder hacer—, que es donde han salido los errores.

-- Segundo cliente, para poder promediar dos calificaciones distintas.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  email_change_token_current)
values
  ('ffffffff-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'cliente2@prueba.mx', 'x', now(),
   '{}', '{"nombre":"Dora Cliente","rol":"cliente"}', now(), now(),
   '', '', '', '', '');

\echo '=== Calificaciones: de 1 a 5 estrellas, una sola vez ==='

begin;
  set local role authenticated;
  set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

  do $$
  begin
    insert into public.calificaciones (usuario_id, sucursal_id, estrellas)
    values ('11111111-1111-1111-1111-111111111111',
            '55555555-5555-5555-5555-555555555555', 4);
    raise notice 'OK     el cliente pudo calificar';
  exception when others then
    raise notice 'FALLA  el cliente no pudo calificar: %', sqlerrm;
  end $$;

  do $$
  begin
    insert into public.calificaciones (usuario_id, sucursal_id, estrellas)
    values ('11111111-1111-1111-1111-111111111111',
            '55555555-5555-5555-5555-555555555555', 1);
    raise notice 'FALLA  califico dos veces el mismo negocio';
  exception when others then
    raise notice 'OK     bloqueado (una sola vez): %', sqlerrm;
  end $$;

  -- Sin politica de UPDATE, RLS no lanza error: simplemente no toca ninguna
  -- fila. Por eso se revisa FOUND y no solo la excepcion.
  do $$
  begin
    update public.calificaciones set estrellas = 1
     where usuario_id = '11111111-1111-1111-1111-111111111111'
       and sucursal_id = '55555555-5555-5555-5555-555555555555';
    if found then
      raise notice 'FALLA  pudo cambiar su calificacion despues de darla';
    else
      raise notice 'OK     bloqueado: la calificacion no se puede cambiar';
    end if;
  exception when others then
    raise notice 'OK     bloqueado: %', sqlerrm;
  end $$;
rollback;

\echo '--- fuera del rango 1 a 5 ---'
begin;
  set local role authenticated;
  set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

  do $$
  begin
    insert into public.calificaciones (usuario_id, sucursal_id, estrellas)
    values ('11111111-1111-1111-1111-111111111111',
            '55555555-5555-5555-5555-555555555555', 6);
    raise notice 'FALLA  acepto 6 estrellas';
  exception when check_violation then
    raise notice 'OK     bloqueado: el maximo son 5 estrellas';
  end $$;

  do $$
  begin
    insert into public.calificaciones (usuario_id, sucursal_id, estrellas)
    values ('11111111-1111-1111-1111-111111111111',
            '55555555-5555-5555-5555-555555555555', 0);
    raise notice 'FALLA  acepto 0 estrellas';
  exception when check_violation then
    raise notice 'OK     bloqueado: el minimo es 1 estrella';
  end $$;
rollback;

\echo '--- un negocio intenta calificar (spec §5.5: solo clientes) ---'
begin;
  set local role authenticated;
  set local request.jwt.claims to '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
  do $$
  begin
    insert into public.calificaciones (usuario_id, sucursal_id, estrellas)
    values ('22222222-2222-2222-2222-222222222222',
            '55555555-5555-5555-5555-555555555555', 5);
    raise notice 'FALLA  un negocio se califico a si mismo';
  exception when others then
    raise notice 'OK     bloqueado: %', sqlerrm;
  end $$;
rollback;

\echo '--- calificar un micrositio sin publicar ---'
begin;
  set local role authenticated;
  set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
  do $$
  begin
    insert into public.calificaciones (usuario_id, sucursal_id, estrellas)
    values ('11111111-1111-1111-1111-111111111111',
            '88888888-8888-8888-8888-888888888888', 5);
    raise notice 'FALLA  califico un micrositio en borrador';
  exception when others then
    raise notice 'OK     bloqueado: %', sqlerrm;
  end $$;
rollback;

\echo '=== El promedio ==='

begin;
  set local role postgres;
  delete from public.calificaciones
   where sucursal_id = '55555555-5555-5555-5555-555555555555';

  insert into public.calificaciones (usuario_id, sucursal_id, estrellas) values
    ('11111111-1111-1111-1111-111111111111',
     '55555555-5555-5555-5555-555555555555', 4),
    ('ffffffff-0000-0000-0000-000000000006',
     '55555555-5555-5555-5555-555555555555', 3);

  do $$
  declare p numeric; t integer;
  begin
    select promedio, total into p, t
      from public.calificaciones_sucursal
     where sucursal_id = '55555555-5555-5555-5555-555555555555';

    if p = 3.5 and t = 2 then
      raise notice 'OK     4 y 3 estrellas promedian % con % calificaciones', p, t;
    else
      raise notice 'FALLA  el promedio salio % con % calificaciones', p, t;
    end if;
  end $$;

  -- La vista corre con los permisos de quien la consulta, asi que un visitante
  -- sin cuenta debe ver el promedio de lo publicado.
  set local role anon;
  do $$
  declare cuantas integer;
  begin
    select count(*) into cuantas from public.calificaciones_sucursal
     where sucursal_id = '55555555-5555-5555-5555-555555555555';
    if cuantas = 1 then
      raise notice 'OK     anon ve el promedio de un micrositio publicado';
    else
      raise notice 'FALLA  anon no ve el promedio y el micrositio saldria sin estrellas';
    end if;
  end $$;
rollback;

\echo '--- el promedio de un borrador no se asoma al publico ---'
begin;
  set local role postgres;
  insert into public.calificaciones (usuario_id, sucursal_id, estrellas)
  values ('11111111-1111-1111-1111-111111111111',
          '88888888-8888-8888-8888-888888888888', 5);

  set local role anon;
  do $$
  declare cuantas integer;
  begin
    select count(*) into cuantas from public.calificaciones_sucursal
     where sucursal_id = '88888888-8888-8888-8888-888888888888';
    if cuantas = 0 then
      raise notice 'OK     el promedio de un borrador no es publico';
    else
      raise notice 'FALLA  se asomo el promedio de un micrositio sin publicar';
    end if;
  end $$;
rollback;

\echo '=== Comentarios: uno al dia por negocio ==='

begin;
  set local role postgres;
  delete from public.resenas
   where usuario_id = '11111111-1111-1111-1111-111111111111'
     and sucursal_id = '55555555-5555-5555-5555-555555555555';

  set local role authenticated;
  set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

  do $$
  begin
    insert into public.resenas (usuario_id, sucursal_id, texto)
    values ('11111111-1111-1111-1111-111111111111',
            '55555555-5555-5555-5555-555555555555', 'La primera de hoy.');
    raise notice 'OK     dejo su comentario del dia';
  exception when others then
    raise notice 'FALLA  no pudo dejar el primer comentario: %', sqlerrm;
  end $$;

  do $$
  begin
    insert into public.resenas (usuario_id, sucursal_id, texto)
    values ('11111111-1111-1111-1111-111111111111',
            '55555555-5555-5555-5555-555555555555', 'La segunda del mismo dia.');
    raise notice 'FALLA  dejo dos comentarios el mismo dia';
  exception when others then
    raise notice 'OK     bloqueado: %', sqlerrm;
  end $$;

  -- Editar lo de hoy no cuenta como dejar otro: el trigger es solo de insert.
  do $$
  begin
    update public.resenas set texto = 'Corregi mi comentario.'
     where usuario_id = '11111111-1111-1111-1111-111111111111'
       and sucursal_id = '55555555-5555-5555-5555-555555555555';
    raise notice 'OK     pudo corregir el comentario de hoy';
  exception when others then
    raise notice 'FALLA  no pudo corregir su propio comentario: %', sqlerrm;
  end $$;

  -- Y el tope es por dia, no para siempre: el de ayer si entra.
  set local role postgres;
  do $$
  begin
    insert into public.resenas (usuario_id, sucursal_id, texto, fecha)
    values ('11111111-1111-1111-1111-111111111111',
            '55555555-5555-5555-5555-555555555555', 'El de ayer.',
            now() - interval '1 day');
    raise notice 'OK     el comentario de otro dia si entra';
  exception when others then
    raise notice 'FALLA  bloqueo un comentario de otro dia: %', sqlerrm;
  end $$;
rollback;

\echo '--- el tope es por negocio, no por persona ---'
begin;
  set local role postgres;
  delete from public.resenas
   where usuario_id = '11111111-1111-1111-1111-111111111111';
  update public.sucursales set estado = 'publicado'
   where id = '88888888-8888-8888-8888-888888888888';

  set local role authenticated;
  set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
  insert into public.resenas (usuario_id, sucursal_id, texto)
  values ('11111111-1111-1111-1111-111111111111',
          '55555555-5555-5555-5555-555555555555', 'En este negocio.');

  do $$
  begin
    insert into public.resenas (usuario_id, sucursal_id, texto)
    values ('11111111-1111-1111-1111-111111111111',
            '88888888-8888-8888-8888-888888888888', 'Y en este otro, el mismo dia.');
    raise notice 'OK     el mismo dia puede comentar en otro negocio';
  exception when others then
    raise notice 'FALLA  el tope diario se comio otro negocio: %', sqlerrm;
  end $$;
rollback;

\echo '=== Storage: la foto de la resena ==='

\echo '--- la ruta es {usuario_id}/{archivo} ---'
begin;
  set local role authenticated;
  set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
  do $$
  begin
    insert into storage.objects (bucket_id, name, owner)
    values ('resenas', '11111111-1111-1111-1111-111111111111/foto.jpg',
            '11111111-1111-1111-1111-111111111111');
    raise notice 'OK     el cliente sube a su propia carpeta';
  exception when others then
    raise notice 'FALLA  el cliente no pudo subir su foto: %', sqlerrm;
  end $$;

  do $$
  begin
    insert into storage.objects (bucket_id, name, owner)
    values ('resenas', 'ffffffff-0000-0000-0000-000000000006/foto.jpg',
            '11111111-1111-1111-1111-111111111111');
    raise notice 'FALLA  escribio en la carpeta de otra persona';
  exception when others then
    raise notice 'OK     bloqueado: %', sqlerrm;
  end $$;
rollback;

\echo '--- un negocio no sube fotos de resena ---'
begin;
  set local role authenticated;
  set local request.jwt.claims to '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
  do $$
  begin
    insert into storage.objects (bucket_id, name, owner)
    values ('resenas', '22222222-2222-2222-2222-222222222222/foto.jpg',
            '22222222-2222-2222-2222-222222222222');
    raise notice 'FALLA  un negocio subio una foto de resena';
  exception when others then
    raise notice 'OK     bloqueado: %', sqlerrm;
  end $$;
rollback;
