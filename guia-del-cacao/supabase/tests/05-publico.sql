\set ON_ERROR_STOP on
set client_min_messages to notice;

-- Depende de los datos de 01-reglas-negocio.sql:
--   sucursal 5555 publicada (Tier 3), sucursal 8888 en borrador
--   perfil 1111 cliente, perfil 2222 negocio dueno de ambas

\echo '=== Carrusel de fotos ==='
do $$
declare vacio boolean;
begin
  begin
    update public.sucursales
       set galeria = array['1','2','3','4','5','6','7','8','9']
     where id = '55555555-5555-5555-5555-555555555555';
    raise notice 'FALLA  acepto 9 fotos';
  exception when check_violation then
    raise notice 'OK     bloqueado: el carrusel no acepta mas de 8 fotos';
  end;

  update public.sucursales
     set galeria = array['1','2','3','4','5','6','7','8']
   where id = '55555555-5555-5555-5555-555555555555';
  raise notice 'OK     acepta 8 fotos';

  select galeria = '{}' into vacio from public.sucursales
   where id = '88888888-8888-8888-8888-888888888888';
  if vacio then
    raise notice 'OK     la galeria nace vacia';
  else
    raise notice 'FALLA  la galeria no nace vacia';
  end if;
end $$;

\echo '=== Resenas ==='

\echo '--- un cliente resenia una sucursal publicada ---'
begin;
  set local role authenticated;
  set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
  do $$
  begin
    insert into public.resenas (usuario_id, sucursal_id, texto)
    values ('11111111-1111-1111-1111-111111111111',
            '55555555-5555-5555-5555-555555555555', 'Muy buen chocolate.');
    raise notice 'OK     el cliente pudo reseniar';
  exception when others then
    raise notice 'FALLA  el cliente no pudo reseniar: %', sqlerrm;
  end $$;
rollback;

\echo '--- el mismo cliente intenta reseniar un borrador ---'
begin;
  set local role authenticated;
  set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
  do $$
  begin
    insert into public.resenas (usuario_id, sucursal_id, texto)
    values ('11111111-1111-1111-1111-111111111111',
            '88888888-8888-8888-8888-888888888888', 'No deberia poder.');
    raise notice 'FALLA  resenio un micrositio sin publicar';
  exception when others then
    raise notice 'OK     bloqueado: %', sqlerrm;
  end $$;
rollback;

\echo '--- un negocio intenta reseniar (spec §5.5: solo clientes) ---'
begin;
  set local role authenticated;
  set local request.jwt.claims to '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
  do $$
  begin
    insert into public.resenas (usuario_id, sucursal_id, texto)
    values ('22222222-2222-2222-2222-222222222222',
            '55555555-5555-5555-5555-555555555555', 'Me resenio yo mismo.');
    raise notice 'FALLA  un negocio dejo una resenia';
  exception when others then
    raise notice 'OK     bloqueado: %', sqlerrm;
  end $$;
rollback;

\echo '--- la marca responde, pero no reescribe la resenia ajena ---'
begin;
  set local role postgres;
  insert into public.resenas (id, usuario_id, sucursal_id, texto)
  values ('99999999-9999-9999-9999-999999999999',
          '11111111-1111-1111-1111-111111111111',
          '55555555-5555-5555-5555-555555555555', 'Texto original del cliente.');

  set local role authenticated;
  set local request.jwt.claims to '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

  do $$
  begin
    update public.resenas set respuesta_marca = 'Gracias por tu visita.'
     where id = '99999999-9999-9999-9999-999999999999';
    raise notice 'OK     la marca pudo responder';
  exception when others then
    raise notice 'FALLA  la marca no pudo responder: %', sqlerrm;
  end $$;

  do $$
  begin
    update public.resenas set texto = 'Texto cambiado por la marca.'
     where id = '99999999-9999-9999-9999-999999999999';
    raise notice 'FALLA  la marca reescribio la resenia';
  exception when others then
    raise notice 'OK     bloqueado: %', sqlerrm;
  end $$;
rollback;

\echo '--- el visitante anonimo ve resenas de lo publicado, no de borradores ---'
begin;
  set local role postgres;
  insert into public.resenas (usuario_id, sucursal_id, texto)
  values ('11111111-1111-1111-1111-111111111111',
          '55555555-5555-5555-5555-555555555555', 'Publica.');
  insert into public.resenas (usuario_id, sucursal_id, texto)
  values ('11111111-1111-1111-1111-111111111111',
          '88888888-8888-8888-8888-888888888888', 'De un borrador.');

  set local role anon;
  do $$
  declare cuantas integer;
  begin
    select count(*) into cuantas from public.resenas;
    if cuantas = 1 then
      raise notice 'OK     anon ve solo la resenia del micrositio publicado';
    else
      raise notice 'FALLA  anon ve % resenas y deberia ver 1', cuantas;
    end if;
  end $$;
rollback;
