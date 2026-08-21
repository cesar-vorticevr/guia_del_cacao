-- Guía del Cacao — datos de demostración para desarrollo local
--
-- Corre solo con `supabase db reset` / `supabase start`, nunca en produccion.
-- Existe para que reiniciar la base no obligue a volver a crear cuentas a mano.
--
--   cliente@guiadelcacao.mx  / cacao12345   -> /cuenta
--   negocio@guiadelcacao.mx  / cacao12345   -> /negocio/panel
--   admin@guiadelcacao.mx    / cacao12345   -> /admin
--
-- Las contrasenas se cifran con el mismo bcrypt que usa Supabase Auth, asi que
-- sirven para entrar de verdad por la pantalla de login.

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  -- GoTrue lee estas columnas como texto, no como texto nulable: dejarlas en
  -- NULL hace que el login falle con "Database error querying schema".
  confirmation_token, recovery_token, email_change, email_change_token_new,
  email_change_token_current
)
values
  (
    'e0000000-0000-4000-a000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'cliente@guiadelcacao.mx',
    extensions.crypt('cacao12345', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"nombre":"Cliente Demo","rol":"cliente"}',
    now(), now(),
    '', '', '', '', ''
  ),
  (
    'e0000000-0000-4000-a000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'negocio@guiadelcacao.mx',
    extensions.crypt('cacao12345', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"nombre":"Negocio Demo","rol":"negocio"}',
    now(), now(),
    '', '', '', '', ''
  ),
  (
    'e0000000-0000-4000-a000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'admin@guiadelcacao.mx',
    extensions.crypt('cacao12345', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"nombre":"Administrador"}',
    now(), now(),
    '', '', '', '', ''
  );

-- GoTrue espera una identidad por proveedor; sin esto el login por correo
-- puede no encontrar la cuenta.
insert into auth.identities (id, user_id, provider_id, provider, identity_data, created_at, updated_at)
select
  u.id, u.id, u.id::text, 'email',
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  now(), now()
from auth.users u
where u.email like '%@guiadelcacao.mx';

-- El rol admin no es autoregistrable (spec §2): el trigger lo degrada a
-- cliente y aqui se asigna a mano, que es la unica via valida.
update public.perfiles
   set rol = 'admin'
 where correo = 'admin@guiadelcacao.mx';

-- Marca del negocio de demostracion, para que su panel no salga vacio.
insert into public.marcas (perfil_id, nombre_comercial, categoria_id)
select p.id, 'Chocolatería La Mazorca', c.id
  from public.perfiles p, public.categorias c
 where p.correo = 'negocio@guiadelcacao.mx'
   and c.slug = 'chocolateria';
