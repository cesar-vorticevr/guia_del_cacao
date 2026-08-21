\set ON_ERROR_STOP on
set client_min_messages to notice;

-- Depende de los datos que deja 01-reglas-negocio.sql:
--   perfil 2222 (negocio) es dueno de la sucursal 5555
--   perfil 1111 (cliente) no es dueno de nada

\echo '=== Storage: quien puede escribir en la carpeta de un micrositio ==='

-- La ruta es `{sucursal_id}/{archivo}`: la primera carpeta es la llave.
begin;
  set local role authenticated;
  set local request.jwt.claims to '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
  do $$
  begin
    insert into storage.objects (bucket_id, name, owner)
    values ('micrositios', '55555555-5555-5555-5555-555555555555/logo.png',
            '22222222-2222-2222-2222-222222222222');
    raise notice 'OK     el dueno sube a su propia carpeta';
  exception when others then
    raise notice 'FALLA  el dueno no pudo subir: %', sqlerrm;
  end $$;
rollback;

\echo '--- un cliente cualquiera intenta subir a esa carpeta ---'
begin;
  set local role authenticated;
  set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
  do $$
  begin
    insert into storage.objects (bucket_id, name, owner)
    values ('micrositios', '55555555-5555-5555-5555-555555555555/logo.png',
            '11111111-1111-1111-1111-111111111111');
    raise notice 'FALLA  un ajeno escribio en la carpeta del negocio';
  exception when others then
    raise notice 'OK     bloqueado: %', sqlerrm;
  end $$;
rollback;

\echo '--- carpeta inventada: debe negar, no reventar por conversion ---'
begin;
  set local role authenticated;
  set local request.jwt.claims to '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
  do $$
  begin
    insert into storage.objects (bucket_id, name, owner)
    values ('micrositios', 'no-es-un-uuid/logo.png',
            '22222222-2222-2222-2222-222222222222');
    raise notice 'FALLA  acepto una carpeta que no es suya';
  exception
    when invalid_text_representation then
      raise notice 'FALLA  revento al convertir el nombre de carpeta a uuid';
    when others then
      raise notice 'OK     bloqueado: %', sqlerrm;
  end $$;
rollback;

\echo '--- el visitante anonimo si puede leer las imagenes ---'
begin;
  set local role postgres;
  insert into storage.objects (bucket_id, name, owner)
  values ('micrositios', '55555555-5555-5555-5555-555555555555/publica.png',
          '22222222-2222-2222-2222-222222222222');

  set local role anon;
  do $$
  declare cuantas integer;
  begin
    select count(*) into cuantas from storage.objects
     where bucket_id = 'micrositios';
    if cuantas >= 1 then
      raise notice 'OK     anon lee las imagenes del bucket publico';
    else
      raise notice 'FALLA  anon no ve las imagenes y el directorio saldria sin fotos';
    end if;
  end $$;
rollback;
