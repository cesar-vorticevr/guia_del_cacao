\set ON_ERROR_STOP on

\echo '=== ANON (visitante sin cuenta) ==='
begin;
  set local role anon;
  select 'sucursales (hay 1 publicada + 1 borrador)' as prueba, count(*) from public.sucursales;
  select 'perfiles ajenos' as prueba, count(*) from public.perfiles;
  select 'suscripciones' as prueba, count(*) from public.suscripciones;
  select 'rangos de usuarios' as prueba, count(*) from public.rangos_usuario;
  select 'solicitudes de puntos' as prueba, count(*) from public.solicitudes_puntos;
  select 'eventos de sucursal publicada' as prueba, count(*) from public.eventos;
  select 'nombres publicos (vista)' as prueba, count(*) from public.perfiles_publicos;
commit;

\echo '=== CLIENTE (Ana) ==='
begin;
  set local role authenticated;
  set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
  select 'su propio perfil (debe ser 1)' as prueba, count(*) from public.perfiles;
  select 'su propio rango (debe ser 1)' as prueba, count(*) from public.rangos_usuario;
  select 'sus solicitudes (debe ser 2)' as prueba, count(*) from public.solicitudes_puntos;
  select 'suscripciones ajenas (debe ser 0)' as prueba, count(*) from public.suscripciones;
  select 'sucursales (solo la publicada = 1)' as prueba, count(*) from public.sucursales;
commit;

\echo '=== NEGOCIO (Beto, dueno de la marca) ==='
begin;
  set local role authenticated;
  set local request.jwt.claims to '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
  select 'sus sucursales incl. borrador (debe ser 2)' as prueba, count(*) from public.sucursales;
  select 'solicitudes que debe resolver (debe ser 2)' as prueba, count(*) from public.solicitudes_puntos;
  select 'rangos de sus clientes (debe ser 0)' as prueba, count(*) from public.rangos_usuario;
commit;

\echo '=== NEGOCIO intenta auto-publicarse (debe fallar) ==='
begin;
  set local role authenticated;
  set local request.jwt.claims to '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
  do $$
  begin
    update public.sucursales set estado = 'publicado'
     where id = '88888888-8888-8888-8888-888888888888';
    raise notice 'FALLA  se auto-publico y no debia';
  exception when others then
    raise notice 'OK     bloqueado: %', sqlerrm;
  end $$;
rollback;

\echo '=== CLIENTE intenta aprobarse puntos (debe fallar) ==='
begin;
  set local role authenticated;
  set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
  do $$
  declare filas integer;
  begin
    update public.solicitudes_puntos
       set estado = 'aprobada', puntos_otorgados = 3, fecha_resolucion = now()
     where id = '77777777-7777-7777-7777-777777777777';
    get diagnostics filas = row_count;
    if filas = 0 then
      raise notice 'OK     RLS no dejo pasar el UPDATE (0 filas afectadas)';
    else
      raise notice 'FALLA  el cliente se aprobo sus propios puntos';
    end if;
  exception when others then
    raise notice 'OK     bloqueado: %', sqlerrm;
  end $$;
rollback;

\echo '=== COLADO intenta hacerse admin (debe fallar) ==='
begin;
  set local role authenticated;
  set local request.jwt.claims to '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
  do $$
  begin
    update public.perfiles set rol = 'admin'
     where id = '33333333-3333-3333-3333-333333333333';
    raise notice 'FALLA  se auto-promovio a admin';
  exception when others then
    raise notice 'OK     bloqueado: %', sqlerrm;
  end $$;
rollback;
