-- Guía del Cacao — eleccion de rol al entrar con Google
--
-- El spec §3.1 pide que, la primera vez que alguien entra con Google, se le
-- pregunte si es Cliente o Negocio: "Google solo resuelve identidad, no el rol".
--
-- El problema: el perfil se crea en el mismo instante en que Supabase inserta
-- el usuario, y para entonces todavia no sabemos el rol. Y `proteger_rol` no
-- deja que nadie se cambie el rol a si mismo.
--
-- Solucion: el perfil nace "sin confirmar" cuando el rol no venia en el
-- registro. Mientras siga sin confirmar, su dueno puede elegir una vez entre
-- cliente y negocio; despues queda cerrado como cualquier otro. Nunca se puede
-- elegir 'admin' por esta via.

alter table public.perfiles
  add column rol_confirmado boolean not null default true;

comment on column public.perfiles.rol_confirmado is
  'false solo mientras un usuario recien llegado por Google no ha elegido si es cliente o negocio.';

-- El registro por correo si trae el rol, asi que nace confirmado. El de Google
-- no lo trae: nace como cliente y sin confirmar.
create or replace function public.manejar_nuevo_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  rol_pedido text := new.raw_user_meta_data ->> 'rol';
  -- Ojo con el coalesce: cuando no viene rol (el caso de Google), rol_pedido es
  -- NULL y `NULL in (...)` da NULL, no false. Sin esto, rol_confirmado quedaria
  -- nulo y el alta reventaria contra el not null.
  rol_valido boolean := coalesce(rol_pedido in ('cliente', 'negocio'), false);
begin
  insert into public.perfiles (id, rol, rol_confirmado, nombre, correo, foto_perfil)
  values (
    new.id,
    (case when rol_valido then rol_pedido else 'cliente' end)::public.rol_usuario,
    rol_valido,
    coalesce(
      new.raw_user_meta_data ->> 'nombre',
      new.raw_user_meta_data ->> 'full_name',
      split_part(coalesce(new.email, 'sin-nombre@guiadelcacao.mx'), '@', 1)
    ),
    coalesce(new.email, ''),
    new.raw_user_meta_data ->> 'avatar_url'
  );

  return new;
end;
$fn$;

-- Se sustituye proteger_rol para abrir esa unica ventana.
create or replace function public.proteger_rol()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  quien uuid := (select auth.uid());
  rol_de_quien public.rol_usuario;
begin
  if new.rol is not distinct from old.rol then
    return new;
  end if;

  -- auth.uid() nulo = migraciones, semillas y service_role: no se bloquean.
  if quien is null then
    return new;
  end if;

  select p.rol into rol_de_quien from public.perfiles p where p.id = quien;

  if rol_de_quien = 'admin' then
    return new;
  end if;

  -- La ventana de una sola vez: yo mismo, todavia sin confirmar, y solo hacia
  -- cliente o negocio.
  if quien = old.id
     and not old.rol_confirmado
     and new.rol in ('cliente', 'negocio')
  then
    new.rol_confirmado := true;
    return new;
  end if;

  raise exception 'Solo un administrador puede cambiar el rol de un perfil';
end;
$fn$;
