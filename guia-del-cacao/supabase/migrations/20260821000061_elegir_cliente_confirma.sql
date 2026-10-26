-- Elegir «Soy cliente» confirma el rol.
--
-- Quien llega por Google nace con rol `cliente` y `rol_confirmado = false`, y
-- en /elegir-rol decide. Elegir «negocio» funcionaba: el rol cambia y
-- `proteger_rol` lo confirma. Elegir «cliente» no: el rol no cambia —ya era
-- cliente—, el trigger salia en su primera linea sin tocar nada, la cuenta se
-- quedaba sin confirmar y /cuenta la devolvia a /elegir-rol. Quien queria ser
-- cliente no podia terminar de registrarse.
--
-- De paso se cierra lo que esa primera linea dejaba abierto: con el rol igual,
-- cualquiera podia escribir su propio `rol_confirmado`. Volverlo a `false`
-- reabria la ventana de una sola vez y permitia pasarse de cliente a negocio
-- (o al reves) despues de haber elegido.
--
-- Ahora, con el rol igual, `rol_confirmado` solo cambia si:
--   - lo hace una migracion, una semilla, la llave de servicio o un admin; o
--   - es la propia persona confirmando, de `false` a `true`, el rol que ya
--     tiene (cliente o negocio): eso es elegir.

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
  if quien is not null then
    select p.rol into rol_de_quien from public.perfiles p where p.id = quien;
  end if;

  if new.rol is not distinct from old.rol then
    if new.rol_confirmado is not distinct from old.rol_confirmado then
      return new;
    end if;

    if quien is null or rol_de_quien = 'admin' then
      return new;
    end if;

    -- Elegir el rol que ya se tiene: de sin confirmar a confirmado, una vez.
    if quien = old.id
       and not old.rol_confirmado
       and new.rol_confirmado
       and new.rol in ('cliente', 'negocio')
    then
      return new;
    end if;

    raise exception 'Tu rol ya quedó definido y no se puede cambiar.';
  end if;

  -- auth.uid() nulo = migraciones, semillas y service_role.
  if quien is null then
    new.rol_confirmado := true;
    return new;
  end if;

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
