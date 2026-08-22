\set ON_ERROR_STOP on
set client_min_messages to notice;

-- Depende de los datos que deja 01-reglas-negocio.sql:
--   sucursal 8888 en borrador, de la marca 4444, cuyo dueno es el perfil 2222
--   perfil 1111 (cliente), perfil 3333 (cliente, pidio admin y se le degrado)
--
-- Desde la migracion 000012 publicar lo autoriza la suscripcion activa. Estas
-- pruebas son sobre todo negativas: lo que sigue sin poderse hacer aunque ya no
-- haya revision de por medio.

\echo '=== Publicar: lo abre el pago, no una aprobacion ==='

\echo '--- el dueno intenta publicar sin haber pagado ---'
begin;
  set local role authenticated;
  set local request.jwt.claims to '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
  do $$
  begin
    update public.sucursales set estado = 'publicado'
     where id = '88888888-8888-8888-8888-888888888888';
    raise notice 'FALLA  publico sin suscripcion';
  exception when others then
    raise notice 'OK     bloqueado: %', sqlerrm;
  end $$;
rollback;

\echo '--- el mismo dueno, ya con suscripcion activa ---'
begin;
  set local role postgres;
  insert into public.suscripciones (sucursal_id, tier_id, monto_mensual, fecha_proximo_cobro)
  values ('88888888-8888-8888-8888-888888888888', 1, 99.00, now() + interval '1 month');

  set local role authenticated;
  set local request.jwt.claims to '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
  do $$
  declare sello timestamptz;
  begin
    update public.sucursales set estado = 'publicado'
     where id = '88888888-8888-8888-8888-888888888888';

    select fecha_publicacion into sello from public.sucursales
     where id = '88888888-8888-8888-8888-888888888888';

    if sello is null then
      raise notice 'FALLA  publico pero no se sello la fecha de publicacion';
    else
      raise notice 'OK     publico solo, sin que nadie lo aprobara';
    end if;
  exception when others then
    raise notice 'FALLA  no pudo publicar pagando: %', sqlerrm;
  end $$;
rollback;

\echo '--- con la suscripcion vencida no alcanza ---'
begin;
  set local role postgres;
  insert into public.suscripciones (sucursal_id, tier_id, monto_mensual, fecha_proximo_cobro, estado)
  values ('88888888-8888-8888-8888-888888888888', 1, 99.00, now(), 'vencido');

  set local role authenticated;
  set local request.jwt.claims to '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
  do $$
  begin
    update public.sucursales set estado = 'publicado'
     where id = '88888888-8888-8888-8888-888888888888';
    raise notice 'FALLA  publico con la suscripcion vencida';
  exception when others then
    raise notice 'OK     bloqueado: %', sqlerrm;
  end $$;
rollback;

\echo '--- pagar no levanta una pausa de moderacion ---'
begin;
  set local role postgres;
  insert into public.suscripciones (sucursal_id, tier_id, monto_mensual, fecha_proximo_cobro)
  values ('88888888-8888-8888-8888-888888888888', 1, 99.00, now() + interval '1 month');

  update public.sucursales
     set estado = 'pausado', pausado_por_admin = true, fecha_publicacion = now()
   where id = '88888888-8888-8888-8888-888888888888';

  set local role authenticated;
  set local request.jwt.claims to '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
  do $$
  begin
    update public.sucursales set estado = 'publicado'
     where id = '88888888-8888-8888-8888-888888888888';
    raise notice 'FALLA  deshizo una pausa de moderacion pagando';
  exception when others then
    raise notice 'OK     bloqueado: %', sqlerrm;
  end $$;
rollback;

\echo '--- pero la pausa que se puso el propio negocio, si ---'
begin;
  set local role postgres;
  insert into public.suscripciones (sucursal_id, tier_id, monto_mensual, fecha_proximo_cobro)
  values ('88888888-8888-8888-8888-888888888888', 1, 99.00, now() + interval '1 month');

  -- La pausa la pone el propio negocio, no postgres: el trigger marca
  -- pausado_por_admin segun quien la puso, y como postgres pasa por
  -- administrador, pausar desde aqui la volveria una pausa de moderacion y la
  -- prueba estaria midiendo otra cosa.
  set local role authenticated;
  set local request.jwt.claims to '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

  update public.sucursales set estado = 'publicado'
   where id = '88888888-8888-8888-8888-888888888888';

  update public.sucursales set estado = 'pausado'
   where id = '88888888-8888-8888-8888-888888888888';

  set local role authenticated;
  set local request.jwt.claims to '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
  do $$
  begin
    update public.sucursales set estado = 'publicado'
     where id = '88888888-8888-8888-8888-888888888888';
    raise notice 'OK     el negocio reactivo su propia pausa';
  exception when others then
    raise notice 'FALLA  no pudo levantar su propia pausa: %', sqlerrm;
  end $$;
rollback;

\echo '--- rechazar sigue siendo cosa del administrador ---'
begin;
  set local role postgres;
  insert into public.suscripciones (sucursal_id, tier_id, monto_mensual, fecha_proximo_cobro)
  values ('88888888-8888-8888-8888-888888888888', 1, 99.00, now() + interval '1 month');

  set local role authenticated;
  set local request.jwt.claims to '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
  do $$
  begin
    update public.sucursales set estado = 'rechazado'
     where id = '88888888-8888-8888-8888-888888888888';
    raise notice 'FALLA  un negocio se rechazo solo';
  exception when others then
    raise notice 'OK     bloqueado: %', sqlerrm;
  end $$;
rollback;

\echo '--- un ajeno no publica la sucursal de otro, ni pagada ---'
begin;
  set local role postgres;
  insert into public.suscripciones (sucursal_id, tier_id, monto_mensual, fecha_proximo_cobro)
  values ('88888888-8888-8888-8888-888888888888', 1, 99.00, now() + interval '1 month');

  set local role authenticated;
  set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
  do $$
  declare estado_final public.estado_sucursal;
  begin
    update public.sucursales set estado = 'publicado'
     where id = '88888888-8888-8888-8888-888888888888';

    -- RLS no lanza error: simplemente no deja tocar la fila. Por eso se
    -- comprueba el estado y no solo que no hubo excepcion.
    set local role postgres;
    select estado into estado_final from public.sucursales
     where id = '88888888-8888-8888-8888-888888888888';

    if estado_final = 'publicado' then
      raise notice 'FALLA  un cliente publico la sucursal de otro';
    else
      raise notice 'OK     RLS no dejo publicar una sucursal ajena';
    end if;
  exception when others then
    raise notice 'OK     bloqueado: %', sqlerrm;
  end $$;
rollback;

\echo '=== Cantidades en la solicitud de monedas ==='

begin;
  set local role postgres;

  insert into public.productos_servicios (id, sucursal_id, nombre, precio)
  values ('a1a1a1a1-0000-0000-0000-000000000001',
          '55555555-5555-5555-5555-555555555555', 'Barra 70%', 80.00);

  delete from public.solicitudes_puntos
   where usuario_id = '11111111-1111-1111-1111-111111111111'
     and sucursal_id = '55555555-5555-5555-5555-555555555555';

  insert into public.solicitudes_puntos (id, usuario_id, sucursal_id)
  values ('b2b2b2b2-0000-0000-0000-000000000002',
          '11111111-1111-1111-1111-111111111111',
          '55555555-5555-5555-5555-555555555555');

  do $$
  begin
    insert into public.solicitud_productos (solicitud_id, producto_id, cantidad)
    values ('b2b2b2b2-0000-0000-0000-000000000002',
            'a1a1a1a1-0000-0000-0000-000000000001', 3);
    raise notice 'OK     guarda cuantas piezas compro';
  exception when others then
    raise notice 'FALLA  no guardo la cantidad: %', sqlerrm;
  end $$;

  do $$
  declare cuantas smallint;
  begin
    select cantidad into cuantas from public.solicitud_productos
     where solicitud_id = 'b2b2b2b2-0000-0000-0000-000000000002';
    if cuantas = 3 then
      raise notice 'OK     la cantidad guardada es 3';
    else
      raise notice 'FALLA  la cantidad guardada es %', cuantas;
    end if;
  end $$;

  do $$
  begin
    update public.solicitud_productos set cantidad = 0
     where solicitud_id = 'b2b2b2b2-0000-0000-0000-000000000002';
    raise notice 'FALLA  acepto cantidad 0';
  exception when check_violation then
    raise notice 'OK     bloqueado: la cantidad minima es 1';
  end $$;

  do $$
  begin
    update public.solicitud_productos set cantidad = 100
     where solicitud_id = 'b2b2b2b2-0000-0000-0000-000000000002';
    raise notice 'FALLA  acepto cantidad 100';
  exception when check_violation then
    raise notice 'OK     bloqueado: la cantidad maxima es 99';
  end $$;
rollback;
