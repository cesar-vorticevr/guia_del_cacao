-- Cuentas compartidas, fase 4: una cuenta para todo.
--
-- Ya no se elige «cliente o negocio» al registrarse. Toda cuenta reseña, gira
-- ruletas, guarda favoritos y pide (eso ya lo dejaba la 000063 a los dos
-- roles), y además puede tener o administrar negocios.
--
-- El rol `negocio` se queda, pero cambia de significado: ya no es algo que se
-- elige, es **«administra al menos un negocio»**, y se pone solo cuando la
-- cuenta entra a `administradores_marca` —al crear su negocio o cuando se lo
-- comparten—. Así los cincuenta lugares de la aplicación que preguntan
-- `rol === "negocio"` para abrir el panel siguen funcionando sin tocarlos.
-- No se quita al dejar de administrar: el panel sin negocios ya lleva a crear
-- uno, y quitarlo en caliente cerraría pantallas a media sesión.
--
-- Las cuentas que entran con Google ya no pasan por «elegir rol»: nacen como
-- `cliente` confirmado, igual que las demás.

-- ---------------------------------------------------------------------------
-- 1. El rol de negocio llega solo
-- ---------------------------------------------------------------------------

-- `proteger_rol` no deja a nadie cambiarse el rol. Este cambio lo hace la base
-- por su cuenta y lo anuncia con `guia.rol_por_marca`; se agrega esa salida al
-- principio sin tocar lo demás.
do $$
declare
  v_def text := pg_get_functiondef('public.proteger_rol()'::regprocedure);
begin
  execute replace(v_def,
    '  if new.rol is not distinct from old.rol then',
    E'  if coalesce(current_setting(''guia.rol_por_marca'', true), '''') = ''si'' then\n    return new;\n  end if;\n\n  if new.rol is not distinct from old.rol then');
end;
$$;

create or replace function public.dar_rol_de_negocio()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('guia.rol_por_marca', 'si', true);
  update public.perfiles
     set rol = 'negocio', rol_confirmado = true
   where id = new.perfil_id
     and rol <> 'admin'
     and (rol <> 'negocio' or not rol_confirmado);
  perform set_config('guia.rol_por_marca', '', true);
  return new;
end;
$$;

drop trigger if exists al_administrar_dar_rol on public.administradores_marca;
create trigger al_administrar_dar_rol
  after insert on public.administradores_marca
  for each row execute function public.dar_rol_de_negocio();

-- Quien ya administra algo y todavía no tiene el rol (no debería haber nadie,
-- pero las semillas viejas no siempre lo cuidaron).
update public.perfiles p
   set rol = 'negocio', rol_confirmado = true
 where p.rol = 'cliente'
   and exists (select 1 from public.administradores_marca a where a.perfil_id = p.id);

-- ---------------------------------------------------------------------------
-- 2. Nadie elige rol al registrarse
-- ---------------------------------------------------------------------------

-- Google mandaba al alta sin rol y la cuenta esperaba en /elegir-rol. Ahora
-- nace confirmada; el rol que viaje en la metadata se sigue respetando (el
-- formulario «registra tu negocio» manda `negocio`).
do $$
declare
  v_def text := pg_get_functiondef('public.manejar_nuevo_usuario()'::regprocedure);
begin
  execute replace(v_def, E'    rol_valido,\n', E'    true,\n');
end;
$$;

update public.perfiles set rol_confirmado = true where not rol_confirmado;
