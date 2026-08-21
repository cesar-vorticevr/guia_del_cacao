-- Guía del Cacao — un rol asignado a mano queda confirmado
--
-- Se descubrió al dar de alta la primera cuenta de administrador. Como el rol
-- admin no es autoregistrable (spec §2), la cuenta nace por el registro normal
-- —y por lo tanto "sin confirmar"— y despues alguien la promueve por SQL.
--
-- El problema: promoverla no tocaba rol_confirmado, asi que el administrador
-- entraba y caia en /elegir-rol, la pantalla que sirve para que un recien
-- llegado de Google decida. Ahi habria podido degradarse a cliente el solo.
--
-- La regla correcta: "sin confirmar" solo describe a quien todavia no ha
-- elegido. En cuanto alguien con autoridad —un admin, una migracion o el
-- service_role— asigna el rol, esa duda ya no existe.

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

  -- auth.uid() nulo = migraciones, semillas y service_role.
  if quien is null then
    new.rol_confirmado := true;
    return new;
  end if;

  select p.rol into rol_de_quien from public.perfiles p where p.id = quien;

  if rol_de_quien = 'admin' then
    new.rol_confirmado := true;
    return new;
  end if;

  -- La ventana de una sola vez para quien llego por Google: yo mismo, todavia
  -- sin confirmar, y solo hacia cliente o negocio.
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

-- Nadie con rol admin puede quedar "sin confirmar": si lo estuviera, la app lo
-- mandaria a elegir rol y podria degradarse solo.
update public.perfiles
   set rol_confirmado = true
 where rol = 'admin'
   and not rol_confirmado;
