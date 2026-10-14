-- El enlace de confirmar la cuenta tambien verifica el correo.
--
-- En produccion GoTrue pide confirmar el correo al registrarse. Quien lo hace
-- ya probo que el correo es suyo, pero `marcar_correo_verificado` solo
-- aceptaba sesiones abiertas con un enlace magico o un codigo, y al negocio se
-- le volvia a pedir «confirma tu correo» antes de su primera sucursal: dos
-- verificaciones del mismo correo, una detras de otra.
--
-- Ahora acepta tambien los metodos con que GoTrue anota los otros enlaces que
-- llegan al correo: confirmar la cuenta (`email/signup`), recuperar la
-- contrasena (`recovery`), una invitacion y un cambio de correo. Los cuatro
-- prueban lo mismo: quien abrio el enlace lee ese buzon. Google y la contrasena
-- siguen sin contar.
--
-- `/auth/callback` la llama al volver de cualquier enlace; si la sesion no
-- vino del correo, la rechaza y no pasa nada.

create or replace function public.marcar_correo_verificado()
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  por_correo boolean;
begin
  if (select auth.uid()) is null then
    raise exception 'Hace falta una sesion';
  end if;

  select exists (
    select 1
      from jsonb_array_elements(
             coalesce((select auth.jwt()) -> 'amr', '[]'::jsonb)
           ) as entrada
     where entrada ->> 'method' in ('magiclink', 'otp', 'email', 'email/signup', 'recovery', 'invite', 'email_change')
  ) into por_correo;

  if not por_correo then
    raise exception 'Esta sesion no se abrio con el enlace que se envio al correo';
  end if;

  -- La bandera es como el trigger de abajo sabe que este UPDATE viene de aqui.
  -- `security definer` no basta: `auth.uid()` sigue devolviendo al usuario,
  -- asi que sin esto el propio trigger bloquearia el unico cambio legitimo.
  -- Vive solo dentro de esta transaccion (el `true` de set_config).
  perform set_config('app.verificando_correo', '1', true);

  update public.perfiles
     set correo_verificado_en = coalesce(correo_verificado_en, now())
   where id = (select auth.uid());

  perform set_config('app.verificando_correo', '', true);
end;
$fn$;
