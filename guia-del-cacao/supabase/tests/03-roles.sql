\set ON_ERROR_STOP on
set client_min_messages to notice;

-- Alta por correo: el rol viene en la metadata.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'porcorreo@prueba.mx', 'x', now(),
  '{}', '{"nombre":"Alta por correo","rol":"negocio"}', now(), now());

-- Alta por Google: identidad sin rol.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('bbbbbbbb-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'porgoogle@prueba.mx', 'x', now(),
  '{}', '{"full_name":"Alta por Google","avatar_url":"https://x/y.jpg"}', now(), now());

\echo '--- como nace cada perfil ---'
select nombre, rol, rol_confirmado from public.perfiles order by nombre;

\echo '--- el de Google elige negocio: debe permitirse UNA vez ---'
begin;
  set local role authenticated;
  set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}';
  do $$
  begin
    update public.perfiles set rol = 'negocio'
     where id = 'bbbbbbbb-0000-0000-0000-000000000002';
    raise notice 'OK     eligio negocio';
  exception when others then
    raise notice 'FALLA  no lo dejo elegir: %', sqlerrm;
  end $$;
commit;

select nombre, rol, rol_confirmado from public.perfiles
 where id = 'bbbbbbbb-0000-0000-0000-000000000002';

\echo '--- intenta cambiar otra vez: debe bloquearse ---'
begin;
  set local role authenticated;
  set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}';
  do $$
  begin
    update public.perfiles set rol = 'cliente'
     where id = 'bbbbbbbb-0000-0000-0000-000000000002';
    raise notice 'FALLA  cambio de rol dos veces';
  exception when others then
    raise notice 'OK     bloqueado: %', sqlerrm;
  end $$;
rollback;

\echo '--- alta por correo intenta cambiarse de rol: debe bloquearse ---'
begin;
  set local role authenticated;
  set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';
  do $$
  begin
    update public.perfiles set rol = 'cliente'
     where id = 'aaaaaaaa-0000-0000-0000-000000000001';
    raise notice 'FALLA  cambio su rol confirmado';
  exception when others then
    raise notice 'OK     bloqueado: %', sqlerrm;
  end $$;
rollback;

\echo '--- alguien nuevo de Google intenta colarse como admin ---'
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('cccccccc-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'colado@prueba.mx', 'x', now(),
  '{}', '{"full_name":"Colado"}', now(), now());

begin;
  set local role authenticated;
  set local request.jwt.claims to '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}';
  do $$
  begin
    update public.perfiles set rol = 'admin'
     where id = 'cccccccc-0000-0000-0000-000000000003';
    raise notice 'FALLA  se hizo admin por la ventana de Google';
  exception when others then
    raise notice 'OK     bloqueado: %', sqlerrm;
  end $$;
rollback;

\echo '--- y no puede cambiarle el rol a otra persona ---'
begin;
  set local role authenticated;
  set local request.jwt.claims to '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}';
  do $$
  declare filas integer;
  begin
    update public.perfiles set rol = 'cliente'
     where id = 'aaaaaaaa-0000-0000-0000-000000000001';
    get diagnostics filas = row_count;
    if filas = 0 then
      raise notice 'OK     RLS no lo dejo tocar el perfil ajeno';
    else
      raise notice 'FALLA  modifico un perfil ajeno';
    end if;
  exception when others then
    raise notice 'OK     bloqueado: %', sqlerrm;
  end $$;
rollback;
