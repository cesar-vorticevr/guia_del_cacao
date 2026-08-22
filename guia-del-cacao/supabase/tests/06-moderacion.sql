\set ON_ERROR_STOP on
set client_min_messages to notice;

-- Depende de 01-reglas-negocio.sql:
--   sucursal 5555 publicada, dueno perfil 2222
--   sucursal 8888 en borrador, nunca aprobada

\echo '=== Pausa: quien la pone decide quien la levanta ==='

-- Hace falta un administrador de verdad para esta prueba.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('eeeeeeee-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'moderador@prueba.mx', 'x', now(),
  '{}', '{"full_name":"Moderador"}', now(), now());

update public.perfiles set rol = 'admin'
 where id = 'eeeeeeee-0000-0000-0000-000000000005';

\echo '--- el administrador pausa por moderacion ---'
begin;
  set local role authenticated;
  set local request.jwt.claims to '{"sub":"eeeeeeee-0000-0000-0000-000000000005","role":"authenticated"}';
  do $$
  declare marcada boolean;
  begin
    update public.sucursales set estado = 'pausado'
     where id = '55555555-5555-5555-5555-555555555555';
    select pausado_por_admin into marcada from public.sucursales
     where id = '55555555-5555-5555-5555-555555555555';
    if marcada then
      raise notice 'OK     la pausa quedo marcada como moderacion';
    else
      raise notice 'FALLA  la pausa del admin no quedo marcada';
    end if;
  end $$;

  \echo '--- el dueno intenta levantarla ---'
  set local request.jwt.claims to '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
  do $$
  begin
    update public.sucursales set estado = 'publicado'
     where id = '55555555-5555-5555-5555-555555555555';
    raise notice 'FALLA  el dueno levanto una pausa de moderacion';
  exception when others then
    raise notice 'OK     bloqueado: %', sqlerrm;
  end $$;
rollback;

\echo '--- el dueno pausa lo suyo y lo reactiva sin permiso de nadie ---'
begin;
  -- Desde la migracion 000012 volver al directorio exige suscripcion activa,
  -- asi que un micrositio publicado tiene que tener una. En la vida real la
  -- tiene siempre: es lo que lo publico en primer lugar.
  set local role postgres;
  insert into public.suscripciones (sucursal_id, tier_id, monto_mensual, fecha_proximo_cobro)
  values ('55555555-5555-5555-5555-555555555555', 3, 499.00, now() + interval '1 month');

  set local role authenticated;
  set local request.jwt.claims to '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
  do $$
  declare marcada boolean; final public.estado_sucursal;
  begin
    update public.sucursales set estado = 'pausado'
     where id = '55555555-5555-5555-5555-555555555555';
    select pausado_por_admin into marcada from public.sucursales
     where id = '55555555-5555-5555-5555-555555555555';
    if marcada then
      raise notice 'FALLA  la pausa propia quedo marcada como moderacion';
    else
      raise notice 'OK     la pausa propia no se marca como moderacion';
    end if;

    update public.sucursales set estado = 'publicado'
     where id = '55555555-5555-5555-5555-555555555555';
    select estado into final from public.sucursales
     where id = '55555555-5555-5555-5555-555555555555';
    raise notice 'OK     el dueno reactivo lo suyo (estado=%)', final;
  exception when others then
    raise notice 'FALLA  no pudo con su propia pausa: %', sqlerrm;
  end $$;
rollback;

\echo '--- un borrador que nunca se aprobo no se puede publicar solo ---'
begin;
  set local role authenticated;
  set local request.jwt.claims to '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
  do $$
  begin
    update public.sucursales set estado = 'pausado'
     where id = '88888888-8888-8888-8888-888888888888';
    update public.sucursales set estado = 'publicado'
     where id = '88888888-8888-8888-8888-888888888888';
    raise notice 'FALLA  publico un micrositio que nunca fue aprobado';
  exception when others then
    raise notice 'OK     bloqueado: %', sqlerrm;
  end $$;
rollback;

\echo '=== Moderacion de contenido ==='
begin;
  set local role authenticated;
  set local request.jwt.claims to '{"sub":"eeeeeeee-0000-0000-0000-000000000005","role":"authenticated"}';
  do $$
  declare quedan integer;
  begin
    delete from public.eventos;
    get diagnostics quedan = row_count;
    raise notice 'OK     el administrador pudo borrar contenido (% renglones)', quedan;
  exception when others then
    raise notice 'FALLA  el administrador no pudo moderar: %', sqlerrm;
  end $$;
rollback;

\echo '--- un cliente cualquiera no puede borrar contenido ajeno ---'
begin;
  set local role authenticated;
  set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
  do $$
  declare borrados integer;
  begin
    delete from public.eventos;
    get diagnostics borrados = row_count;
    if borrados = 0 then
      raise notice 'OK     RLS no dejo borrar nada';
    else
      raise notice 'FALLA  un cliente borro % eventos', borrados;
    end if;
  end $$;
rollback;
