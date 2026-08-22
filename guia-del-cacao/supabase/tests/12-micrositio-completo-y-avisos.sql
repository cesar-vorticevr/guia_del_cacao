\set ON_ERROR_STOP on
set client_min_messages to notice;

-- Depende de 01-reglas-negocio.sql: sucursal 8888 en borrador, de la marca
-- 4444 (dueno el perfil 2222); perfil 1111 es cliente.

\echo '=== Publicar exige micrositio completo ==='
begin;
  set local role postgres;
  insert into public.suscripciones (sucursal_id, tier_id, monto_mensual, fecha_proximo_cobro)
  values ('88888888-8888-8888-8888-888888888888', 1, 199.00, now() + interval '1 month');

  set local role authenticated;
  set local request.jwt.claims to '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
  do $$
  begin
    update public.sucursales set estado = 'publicado'
     where id = '88888888-8888-8888-8888-888888888888';
    raise notice 'FALLA  publico un micrositio vacio';
  exception when others then
    raise notice 'OK     bloqueado: %', sqlerrm;
  end $$;

  set local role postgres;
  update public.sucursales
     set acerca_de = 'Cacao de la Chontalpa.', logo = '8888/logo.png'
   where id = '88888888-8888-8888-8888-888888888888';

  set local role authenticated;
  set local request.jwt.claims to '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
  do $$
  begin
    update public.sucursales set estado = 'publicado'
     where id = '88888888-8888-8888-8888-888888888888';
    raise notice 'FALLA  publico sin un solo producto';
  exception when others then
    raise notice 'OK     bloqueado: %', sqlerrm;
  end $$;

  set local role postgres;
  insert into public.productos_servicios (sucursal_id, nombre)
  values ('88888888-8888-8888-8888-888888888888', 'Barra 70%');

  set local role authenticated;
  set local request.jwt.claims to '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
  do $$
  begin
    update public.sucursales set estado = 'publicado'
     where id = '88888888-8888-8888-8888-888888888888';
    raise notice 'OK     con todo completo si publico';
  exception when others then
    raise notice 'FALLA  no publico estando completo: %', sqlerrm;
  end $$;
rollback;

\echo '=== Avisos al negocio ==='
begin;
  set local role postgres;
  delete from public.resenas
   where usuario_id = '11111111-1111-1111-1111-111111111111'
     and sucursal_id = '55555555-5555-5555-5555-555555555555';
  delete from public.notificaciones where perfil_id = '22222222-2222-2222-2222-222222222222';

  set local role authenticated;
  set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
  insert into public.resenas (usuario_id, sucursal_id, texto)
  values ('11111111-1111-1111-1111-111111111111',
          '55555555-5555-5555-5555-555555555555', 'Quedamos encantados.');

  set local request.jwt.claims to '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
  do $$
  declare cuantos integer; que text;
  begin
    select count(*), max(titulo) into cuantos, que
      from public.notificaciones where tipo = 'resena';
    if cuantos = 1 then
      raise notice 'OK     al negocio le llego el aviso: %', que;
    else
      raise notice 'FALLA  llegaron % avisos', cuantos;
    end if;
  end $$;

  set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
  do $$
  declare cuantos integer;
  begin
    select count(*) into cuantos from public.notificaciones;
    if cuantos = 0 then
      raise notice 'OK     el aviso es solo de quien lo recibe';
    else
      raise notice 'FALLA  otra persona vio el aviso ajeno';
    end if;
  end $$;

  set local request.jwt.claims to '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
  do $$
  begin
    update public.notificaciones set titulo = 'Lo que yo quiera' where tipo = 'resena';
    raise notice 'FALLA  reescribio el texto de un aviso';
  exception when others then
    raise notice 'OK     bloqueado: %', sqlerrm;
  end $$;

  do $$
  begin
    update public.notificaciones set leida = true where tipo = 'resena';
    raise notice 'OK     lo pudo marcar como leido';
  exception when others then
    raise notice 'FALLA  no pudo marcarlo leido: %', sqlerrm;
  end $$;
rollback;
