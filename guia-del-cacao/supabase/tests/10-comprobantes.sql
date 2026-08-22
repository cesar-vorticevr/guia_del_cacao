\set ON_ERROR_STOP on
set client_min_messages to notice;

-- Depende de los datos que deja 01-reglas-negocio.sql:
--   sucursal 5555 publicada, de la marca 4444, dueno el perfil 2222
--   perfil 1111 (cliente), perfil 3333 (cliente)
--
-- El bucket `comprobantes` es el unico privado de la plataforma: un ticket de
-- compra puede traer datos de la persona. Lo que se prueba aqui es justamente
-- eso, que solo lo vean los dos lados del mostrador.

\echo '=== Cuanto vale una solicitud ==='
begin;
  set local role postgres;

  -- El indice solicitud_pendiente_unica no deja dos pendientes de la misma
  -- persona en el mismo negocio, y otros archivos dejan una viva.
  delete from public.solicitudes_puntos
   where usuario_id = '11111111-1111-1111-1111-111111111111'
     and sucursal_id = '55555555-5555-5555-5555-555555555555';

  delete from public.resenas
   where usuario_id = '11111111-1111-1111-1111-111111111111'
     and sucursal_id = '55555555-5555-5555-5555-555555555555';

  insert into public.solicitudes_puntos (id, usuario_id, sucursal_id)
  values ('50110000-0000-4000-8000-000000000001',
          '11111111-1111-1111-1111-111111111111',
          '55555555-5555-5555-5555-555555555555');

  do $$
  begin
    if public.monedas_sugeridas('50110000-0000-4000-8000-000000000001') = 1 then
      raise notice 'OK     sin resena, la solicitud vale una moneda';
    else
      raise notice 'FALLA  sin resena valio %',
        public.monedas_sugeridas('50110000-0000-4000-8000-000000000001');
    end if;
  end $$;

  insert into public.resenas (id, usuario_id, sucursal_id, texto)
  values ('4e110000-0000-4000-8000-000000000001',
          '11111111-1111-1111-1111-111111111111',
          '55555555-5555-5555-5555-555555555555', 'Muy bien todo.');

  update public.solicitudes_puntos
     set resena_id = '4e110000-0000-4000-8000-000000000001'
   where id = '50110000-0000-4000-8000-000000000001';

  do $$
  begin
    if public.monedas_sugeridas('50110000-0000-4000-8000-000000000001') = 2 then
      raise notice 'OK     con resena, la solicitud vale dos monedas';
    else
      raise notice 'FALLA  con resena valio %',
        public.monedas_sugeridas('50110000-0000-4000-8000-000000000001');
    end if;
  end $$;
rollback;

\echo '=== El bucket privado de comprobantes ==='

\echo '--- el cliente sube a su carpeta, hacia la sucursal a la que le compro ---'
begin;
  set local role authenticated;
  set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
  do $$
  begin
    insert into storage.objects (bucket_id, name, owner)
    values ('comprobantes',
            '11111111-1111-1111-1111-111111111111/55555555-5555-5555-5555-555555555555/ticket.jpg',
            '11111111-1111-1111-1111-111111111111');
    raise notice 'OK     el cliente pudo mandar su ticket';
  exception when others then
    raise notice 'FALLA  el cliente no pudo mandar su ticket: %', sqlerrm;
  end $$;

  do $$
  begin
    insert into storage.objects (bucket_id, name, owner)
    values ('comprobantes',
            '33333333-3333-3333-3333-333333333333/55555555-5555-5555-5555-555555555555/ajeno.jpg',
            '11111111-1111-1111-1111-111111111111');
    raise notice 'FALLA  escribio en la carpeta de otra persona';
  exception when others then
    raise notice 'OK     bloqueado: %', sqlerrm;
  end $$;
rollback;

\echo '--- quien puede verlo ---'
begin;
  set local role postgres;
  insert into storage.objects (bucket_id, name, owner)
  values ('comprobantes',
          '11111111-1111-1111-1111-111111111111/55555555-5555-5555-5555-555555555555/ticket.jpg',
          '11111111-1111-1111-1111-111111111111');

  set local role authenticated;
  set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
  do $$
  declare cuantos integer;
  begin
    select count(*) into cuantos from storage.objects where bucket_id = 'comprobantes';
    if cuantos = 1 then
      raise notice 'OK     quien lo subio ve su ticket';
    else
      raise notice 'FALLA  quien lo subio no ve su propio ticket';
    end if;
  end $$;

  set local request.jwt.claims to '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
  do $$
  declare cuantos integer;
  begin
    select count(*) into cuantos from storage.objects where bucket_id = 'comprobantes';
    if cuantos = 1 then
      raise notice 'OK     el negocio al que se lo mandaron lo ve';
    else
      raise notice 'FALLA  el negocio no ve el ticket que le mandaron';
    end if;
  end $$;

  set local request.jwt.claims to '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
  do $$
  declare cuantos integer;
  begin
    select count(*) into cuantos from storage.objects where bucket_id = 'comprobantes';
    if cuantos = 0 then
      raise notice 'OK     un tercero no ve el ticket de nadie';
    else
      raise notice 'FALLA  un tercero vio un ticket ajeno';
    end if;
  end $$;

  set local role anon;
  do $$
  declare cuantos integer;
  begin
    select count(*) into cuantos from storage.objects where bucket_id = 'comprobantes';
    if cuantos = 0 then
      raise notice 'OK     sin cuenta no se ve ningun ticket';
    else
      raise notice 'FALLA  un visitante anonimo vio un ticket';
    end if;
  end $$;
rollback;

\echo '--- carpeta inventada: debe negar, no reventar por conversion ---'
begin;
  set local role postgres;
  insert into storage.objects (bucket_id, name, owner)
  values ('comprobantes',
          '11111111-1111-1111-1111-111111111111/no-es-un-uuid/ticket.jpg',
          '11111111-1111-1111-1111-111111111111');

  set local role authenticated;
  set local request.jwt.claims to '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
  do $$
  declare cuantos integer;
  begin
    select count(*) into cuantos from storage.objects
     where bucket_id = 'comprobantes' and name like '%no-es-un-uuid%';
    if cuantos = 0 then
      raise notice 'OK     una carpeta inventada no le abre la puerta a nadie';
    else
      raise notice 'FALLA  la carpeta inventada dejo ver el archivo';
    end if;
  exception
    when invalid_text_representation then
      raise notice 'FALLA  revento al convertir el nombre de carpeta a uuid';
  end $$;
rollback;
