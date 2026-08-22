\set ON_ERROR_STOP on
set client_min_messages to notice;

-- Depende de los datos que deja 01-reglas-negocio.sql:
--   sucursal 5555 publicada (Tier 3), de la marca 4444, dueno el perfil 2222
--   perfil 1111 (cliente), perfil 3333 (cliente)
--
-- Se prueban las dos reglas nuevas: un comentario por publicacion (que el
-- negocio puede ocultar pero no borrar ni reescribir) y el foro, donde abrir
-- un tema cuesta monedas y apoyar mueve una de verdad.

-- Un cliente propio, para no depender de los que crean otros archivos.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  email_change_token_current)
values
  ('0a0a0a0a-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'cliente3@prueba.mx', 'x', now(),
   '{}', '{"nombre":"Eva Cliente","rol":"cliente"}', now(), now(),
   '', '', '', '', '');

\echo '=== Comentarios en eventos y noticias ==='

begin;
  set local role postgres;
  insert into public.eventos (id, sucursal_id, titulo, contenido, fecha_evento)
  values ('e5e5e5e5-0000-4000-8000-000000000001',
          '55555555-5555-5555-5555-555555555555',
          'Cata para comentar', 'x', now() + interval '10 days');

  set local role authenticated;
  set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

  do $$
  begin
    insert into public.comentarios_publicacion (id, usuario_id, evento_id, texto)
    values ('c1c1c1c1-0000-4000-8000-000000000001',
            '11111111-1111-1111-1111-111111111111',
            'e5e5e5e5-0000-4000-8000-000000000001', 'Ahi estare.');
    raise notice 'OK     el cliente comento el evento';
  exception when others then
    raise notice 'FALLA  el cliente no pudo comentar: %', sqlerrm;
  end $$;

  do $$
  begin
    insert into public.comentarios_publicacion (usuario_id, evento_id, texto)
    values ('11111111-1111-1111-1111-111111111111',
            'e5e5e5e5-0000-4000-8000-000000000001', 'Otro mas.');
    raise notice 'FALLA  dejo dos comentarios en la misma publicacion';
  exception when others then
    raise notice 'OK     bloqueado (uno por publicacion): %', sqlerrm;
  end $$;

  do $$
  declare sello timestamptz;
  begin
    update public.comentarios_publicacion set texto = 'Mejor lo corrijo.'
     where id = 'c1c1c1c1-0000-4000-8000-000000000001';

    select fecha_edicion into sello from public.comentarios_publicacion
     where id = 'c1c1c1c1-0000-4000-8000-000000000001';

    if sello is null then
      raise notice 'FALLA  edito pero no se sello la fecha de edicion';
    else
      raise notice 'OK     el autor edito el suyo y quedo marcado como editado';
    end if;
  exception when others then
    raise notice 'FALLA  el autor no pudo editar: %', sqlerrm;
  end $$;
rollback;

\echo '--- lo que puede y no puede hacer el negocio ---'
begin;
  set local role postgres;
  insert into public.eventos (id, sucursal_id, titulo, contenido, fecha_evento)
  values ('e5e5e5e5-0000-4000-8000-000000000002',
          '55555555-5555-5555-5555-555555555555',
          'Cata para moderar', 'x', now() + interval '10 days');

  insert into public.comentarios_publicacion (id, usuario_id, evento_id, texto)
  values ('c1c1c1c1-0000-4000-8000-000000000002',
          '11111111-1111-1111-1111-111111111111',
          'e5e5e5e5-0000-4000-8000-000000000002', 'Comentario del cliente.');

  set local role authenticated;
  set local request.jwt.claims to '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

  do $$
  begin
    update public.comentarios_publicacion set texto = 'Lo cambio a mi gusto.'
     where id = 'c1c1c1c1-0000-4000-8000-000000000002';
    raise notice 'FALLA  el negocio reescribio un comentario ajeno';
  exception when others then
    raise notice 'OK     bloqueado: %', sqlerrm;
  end $$;

  do $$
  begin
    update public.comentarios_publicacion set oculto = true
     where id = 'c1c1c1c1-0000-4000-8000-000000000002';
    raise notice 'OK     el negocio pudo ocultarlo';
  exception when others then
    raise notice 'FALLA  el negocio no pudo ocultar: %', sqlerrm;
  end $$;

  do $$
  declare quedan integer;
  begin
    delete from public.comentarios_publicacion
     where id = 'c1c1c1c1-0000-4000-8000-000000000002';
    select count(*) into quedan from public.comentarios_publicacion
     where id = 'c1c1c1c1-0000-4000-8000-000000000002';
    if quedan = 1 then
      raise notice 'OK     RLS no dejo al negocio borrarlo: oculta, no borra';
    else
      raise notice 'FALLA  el negocio borro un comentario ajeno';
    end if;
  end $$;
rollback;

\echo '--- un comentario oculto lo sigue viendo quien lo escribio ---'
begin;
  set local role postgres;
  insert into public.eventos (id, sucursal_id, titulo, contenido, fecha_evento)
  values ('e5e5e5e5-0000-4000-8000-000000000003',
          '55555555-5555-5555-5555-555555555555',
          'Cata con oculto', 'x', now() + interval '10 days');

  insert into public.comentarios_publicacion (usuario_id, evento_id, texto, oculto)
  values ('11111111-1111-1111-1111-111111111111',
          'e5e5e5e5-0000-4000-8000-000000000003', 'Escondido.', true);

  set local role authenticated;
  set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
  do $$
  declare cuantos integer;
  begin
    select count(*) into cuantos from public.comentarios_publicacion
     where evento_id = 'e5e5e5e5-0000-4000-8000-000000000003';
    if cuantos = 1 then
      raise notice 'OK     el autor sigue viendo su comentario oculto';
    else
      raise notice 'FALLA  el autor perdio de vista su propio comentario';
    end if;
  end $$;

  set local role authenticated;
  set local request.jwt.claims to '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
  do $$
  declare cuantos integer;
  begin
    select count(*) into cuantos from public.comentarios_publicacion
     where evento_id = 'e5e5e5e5-0000-4000-8000-000000000003';
    if cuantos = 0 then
      raise notice 'OK     para los demas el comentario oculto no existe';
    else
      raise notice 'FALLA  un tercero vio un comentario oculto';
    end if;
  end $$;
rollback;

\echo '--- el autor no puede desocultarse solo ---'
begin;
  set local role postgres;
  insert into public.eventos (id, sucursal_id, titulo, contenido, fecha_evento)
  values ('e5e5e5e5-0000-4000-8000-000000000004',
          '55555555-5555-5555-5555-555555555555',
          'Cata cuatro', 'x', now() + interval '10 days');

  insert into public.comentarios_publicacion (id, usuario_id, evento_id, texto, oculto)
  values ('c1c1c1c1-0000-4000-8000-000000000004',
          '11111111-1111-1111-1111-111111111111',
          'e5e5e5e5-0000-4000-8000-000000000004', 'Escondido.', true);

  set local role authenticated;
  set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
  do $$
  begin
    update public.comentarios_publicacion set oculto = false
     where id = 'c1c1c1c1-0000-4000-8000-000000000004';
    raise notice 'FALLA  el autor se desoculto solo';
  exception when others then
    raise notice 'OK     bloqueado: %', sqlerrm;
  end $$;
rollback;

\echo '--- un negocio no comenta publicaciones (spec: solo clientes) ---'
begin;
  set local role postgres;
  insert into public.eventos (id, sucursal_id, titulo, contenido, fecha_evento)
  values ('e5e5e5e5-0000-4000-8000-000000000005',
          '55555555-5555-5555-5555-555555555555',
          'Cata cinco', 'x', now() + interval '10 days');

  set local role authenticated;
  set local request.jwt.claims to '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
  do $$
  begin
    insert into public.comentarios_publicacion (usuario_id, evento_id, texto)
    values ('22222222-2222-2222-2222-222222222222',
            'e5e5e5e5-0000-4000-8000-000000000005', 'Me comento solo.');
    raise notice 'FALLA  un negocio comento una publicacion';
  exception when others then
    raise notice 'OK     bloqueado: %', sqlerrm;
  end $$;
rollback;

\echo '=== Foro: abrir un tema cuesta monedas ==='

\echo '--- con menos de 50 monedas no se puede ---'
begin;
  set local role postgres;
  delete from public.rangos_usuario where usuario_id = '11111111-1111-1111-1111-111111111111';
  insert into public.rangos_usuario (usuario_id, anio, puntos_acumulados, rango_actual)
  values ('11111111-1111-1111-1111-111111111111',
          extract(year from (now() at time zone 'America/Mexico_City'))::smallint,
          30, public.calcular_rango(30));

  set local role authenticated;
  set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
  do $$
  begin
    insert into public.temas_foro (autor_id, titulo, contenido)
    values ('11111111-1111-1111-1111-111111111111', 'Mi primer tema',
            'Contenido suficientemente largo para pasar el check.');
    raise notice 'FALLA  abrio un tema con 30 monedas';
  exception when others then
    raise notice 'OK     bloqueado: %', sqlerrm;
  end $$;
rollback;

\echo '--- con 50 alcanza para uno, no para dos ---'
begin;
  set local role postgres;
  delete from public.rangos_usuario where usuario_id = '11111111-1111-1111-1111-111111111111';
  insert into public.rangos_usuario (usuario_id, anio, puntos_acumulados, rango_actual)
  values ('11111111-1111-1111-1111-111111111111',
          extract(year from (now() at time zone 'America/Mexico_City'))::smallint,
          50, public.calcular_rango(50));

  set local role authenticated;
  set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

  do $$
  begin
    insert into public.temas_foro (autor_id, titulo, contenido)
    values ('11111111-1111-1111-1111-111111111111', 'Rutas de cacao en Comalcalco',
            'Contenido suficientemente largo para pasar el check.');
    raise notice 'OK     con 50 monedas abrio su tema';
  exception when others then
    raise notice 'FALLA  no pudo abrir el tema con 50 monedas: %', sqlerrm;
  end $$;

  do $$
  begin
    insert into public.temas_foro (autor_id, titulo, contenido)
    values ('11111111-1111-1111-1111-111111111111', 'Un segundo tema',
            'Contenido suficientemente largo para pasar el check.');
    raise notice 'FALLA  abrio dos temas con 50 monedas';
  exception when others then
    raise notice 'OK     bloqueado: %', sqlerrm;
  end $$;
rollback;

\echo '--- con 100 alcanza para tres, no para cuatro ---'
begin;
  set local role postgres;
  delete from public.rangos_usuario where usuario_id = '11111111-1111-1111-1111-111111111111';
  insert into public.rangos_usuario (usuario_id, anio, puntos_acumulados, rango_actual)
  values ('11111111-1111-1111-1111-111111111111',
          extract(year from (now() at time zone 'America/Mexico_City'))::smallint,
          100, public.calcular_rango(100));

  set local role authenticated;
  set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

  do $$
  declare i integer;
  begin
    for i in 1..3 loop
      insert into public.temas_foro (autor_id, titulo, contenido)
      values ('11111111-1111-1111-1111-111111111111', 'Tema numero ' || i,
              'Contenido suficientemente largo para pasar el check.');
    end loop;
    raise notice 'OK     con 100 monedas abrio sus 3 temas';
  exception when others then
    raise notice 'FALLA  no pudo abrir los 3 temas: %', sqlerrm;
  end $$;

  do $$
  begin
    insert into public.temas_foro (autor_id, titulo, contenido)
    values ('11111111-1111-1111-1111-111111111111', 'Tema numero 4',
            'Contenido suficientemente largo para pasar el check.');
    raise notice 'FALLA  abrio un cuarto tema';
  exception when others then
    raise notice 'OK     bloqueado: %', sqlerrm;
  end $$;
rollback;

\echo '=== Foro: comentar, hasta 5 por tema ==='
begin;
  set local role postgres;
  delete from public.rangos_usuario where usuario_id = '11111111-1111-1111-1111-111111111111';
  insert into public.rangos_usuario (usuario_id, anio, puntos_acumulados, rango_actual)
  values ('11111111-1111-1111-1111-111111111111',
          extract(year from (now() at time zone 'America/Mexico_City'))::smallint,
          50, public.calcular_rango(50));

  insert into public.temas_foro (id, autor_id, titulo, contenido)
  values ('7e7e7e7e-0000-4000-8000-000000000001',
          '11111111-1111-1111-1111-111111111111', 'Tema para comentar',
          'Contenido suficientemente largo para pasar el check.');

  set local role authenticated;
  set local request.jwt.claims to '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

  do $$
  declare i integer;
  begin
    for i in 1..5 loop
      insert into public.comentarios_foro (tema_id, usuario_id, texto)
      values ('7e7e7e7e-0000-4000-8000-000000000001',
              '33333333-3333-3333-3333-333333333333', 'Comentario ' || i);
    end loop;
    raise notice 'OK     dejo sus 5 comentarios en el tema';
  exception when others then
    raise notice 'FALLA  no pudo dejar 5 comentarios: %', sqlerrm;
  end $$;

  do $$
  begin
    insert into public.comentarios_foro (tema_id, usuario_id, texto)
    values ('7e7e7e7e-0000-4000-8000-000000000001',
            '33333333-3333-3333-3333-333333333333', 'El sexto.');
    raise notice 'FALLA  dejo un sexto comentario';
  exception when others then
    raise notice 'OK     bloqueado: %', sqlerrm;
  end $$;

  do $$
  declare cuantos bigint;
  begin
    select comentarios into cuantos from public.temas_foro_resumen
     where tema_id = '7e7e7e7e-0000-4000-8000-000000000001';
    if cuantos = 5 then
      raise notice 'OK     el resumen cuenta los 5 comentarios';
    else
      raise notice 'FALLA  el resumen conto %', cuantos;
    end if;
  end $$;
rollback;

\echo '=== Foro: la moneda de apoyo se mueve de verdad ==='
begin;
  set local role postgres;
  delete from public.rangos_usuario
   where usuario_id in ('11111111-1111-1111-1111-111111111111',
                        '33333333-3333-3333-3333-333333333333');

  insert into public.rangos_usuario (usuario_id, anio, puntos_acumulados, rango_actual) values
    ('11111111-1111-1111-1111-111111111111',
     extract(year from (now() at time zone 'America/Mexico_City'))::smallint, 50,
     public.calcular_rango(50)),
    ('33333333-3333-3333-3333-333333333333',
     extract(year from (now() at time zone 'America/Mexico_City'))::smallint, 20,
     public.calcular_rango(20));

  insert into public.temas_foro (id, autor_id, titulo, contenido)
  values ('7e7e7e7e-0000-4000-8000-000000000002',
          '11111111-1111-1111-1111-111111111111', 'Tema para apoyar',
          'Contenido suficientemente largo para pasar el check.');

  set local role authenticated;
  set local request.jwt.claims to '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

  do $$
  declare autor integer; donante integer;
  begin
    insert into public.apoyos_tema (tema_id, usuario_id)
    values ('7e7e7e7e-0000-4000-8000-000000000002',
            '33333333-3333-3333-3333-333333333333');

    select public.monedas_de('11111111-1111-1111-1111-111111111111') into autor;
    select public.monedas_de('33333333-3333-3333-3333-333333333333') into donante;

    if autor = 51 and donante = 19 then
      raise notice 'OK     la moneda paso del que apoya (%) al autor (%)', donante, autor;
    else
      raise notice 'FALLA  autor quedo con % y donante con %', autor, donante;
    end if;
  exception when others then
    raise notice 'FALLA  no se pudo apoyar: %', sqlerrm;
  end $$;

  do $$
  begin
    insert into public.apoyos_tema (tema_id, usuario_id)
    values ('7e7e7e7e-0000-4000-8000-000000000002',
            '33333333-3333-3333-3333-333333333333');
    raise notice 'FALLA  apoyo dos veces el mismo tema';
  exception when others then
    raise notice 'OK     bloqueado (una moneda por persona y tema): %', sqlerrm;
  end $$;

  set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
  do $$
  begin
    insert into public.apoyos_tema (tema_id, usuario_id)
    values ('7e7e7e7e-0000-4000-8000-000000000002',
            '11111111-1111-1111-1111-111111111111');
    raise notice 'FALLA  se apoyo su propio tema';
  exception when others then
    raise notice 'OK     bloqueado: %', sqlerrm;
  end $$;
rollback;

\echo '--- sin monedas no se puede apoyar ---'
begin;
  set local role postgres;
  delete from public.rangos_usuario
   where usuario_id in ('11111111-1111-1111-1111-111111111111',
                        '0a0a0a0a-0000-0000-0000-00000000000a');

  insert into public.rangos_usuario (usuario_id, anio, puntos_acumulados, rango_actual)
  values ('11111111-1111-1111-1111-111111111111',
          extract(year from (now() at time zone 'America/Mexico_City'))::smallint, 50,
          public.calcular_rango(50));

  insert into public.temas_foro (id, autor_id, titulo, contenido)
  values ('7e7e7e7e-0000-4000-8000-000000000003',
          '11111111-1111-1111-1111-111111111111', 'Tema sin apoyo posible',
          'Contenido suficientemente largo para pasar el check.');

  set local role authenticated;
  set local request.jwt.claims to '{"sub":"0a0a0a0a-0000-0000-0000-00000000000a","role":"authenticated"}';
  do $$
  begin
    insert into public.apoyos_tema (tema_id, usuario_id)
    values ('7e7e7e7e-0000-4000-8000-000000000003',
            '0a0a0a0a-0000-0000-0000-00000000000a');
    raise notice 'FALLA  apoyo sin tener monedas';
  exception when others then
    raise notice 'OK     bloqueado: %', sqlerrm;
  end $$;
rollback;
