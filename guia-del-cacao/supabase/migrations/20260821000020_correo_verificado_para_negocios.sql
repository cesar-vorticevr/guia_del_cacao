-- Confirmar el correo, pero solo cuando de verdad importa.
--
-- Exigirlo al registrarse es una friccion que sobra para un cliente: viene a
-- mirar el directorio y juntar monedas. A un negocio si le hace falta, porque va
-- a pagar una suscripcion y porque su correo es por donde se le avisa. El punto
-- donde deja de dar igual es el mismo en que empieza a costar dinero: su primera
-- sucursal.
--
-- Por eso GoTrue sigue con `enable_confirmations = false` —todos entran de
-- inmediato— y la exigencia vive aqui, en el insert de sucursales.

alter table public.perfiles
  add column if not exists correo_verificado_en timestamptz;

comment on column public.perfiles.correo_verificado_en is
  'Cuando el duenio abrio el enlace que se le mando a su correo. Null = sin verificar.';

-- Quien ya tiene sucursales no puede quedar bloqueado por una regla que no
-- existia cuando se dio de alta. Su correo se da por bueno: ya pago con el.
update public.perfiles p
   set correo_verificado_en = now()
 where p.correo_verificado_en is null
   and exists (
     select 1
       from public.sucursales s
       join public.marcas m on m.id = s.marca_id
      where m.perfil_id = p.id
   );

-- ---------------------------------------------------------------------------
-- Marcar el correo como verificado
-- ---------------------------------------------------------------------------

/*
  Solo puede hacerlo quien acaba de abrir el enlace que le llego por correo.

  Eso se comprueba en el `amr` del JWT, que es donde GoTrue apunta con que
  metodo se abrio la sesion: 'password' cuando se entro con contrasena, y
  'magiclink' u 'otp' cuando se entro por un enlace o un codigo enviado al
  correo. Sin esta comprobacion la funcion no probaria nada — cualquiera con
  sesion iniciada podria llamarla y marcarse verificado sin haber leido ningun
  correo.

  Va `security definer` porque la columna esta cerrada a la escritura directa
  (ver el trigger de abajo).
*/
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
     where entrada ->> 'method' in ('magiclink', 'otp', 'email')
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

revoke all on function public.marcar_correo_verificado() from public;
grant execute on function public.marcar_correo_verificado() to authenticated;

/*
  La columna no se toca por UPDATE normal.

  `perfiles_actualiza_propio` deja a cada quien editar su propio perfil, asi que
  sin este trigger bastaria un PATCH a /rest/v1/perfiles para darse por
  verificado. La unica via es la funcion de arriba, que si comprueba de donde
  viene la sesion.
*/
create or replace function public.proteger_correo_verificado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  if new.correo_verificado_en is distinct from old.correo_verificado_en
     and coalesce(current_setting('app.verificando_correo', true), '') <> '1'
     and (select auth.uid()) is not null
     and not public.es_admin() then
    raise exception 'El correo verificado no se cambia a mano';
  end if;

  return new;
end;
$fn$;

drop trigger if exists proteger_correo_verificado on public.perfiles;

create trigger proteger_correo_verificado
  before update on public.perfiles
  for each row execute function public.proteger_correo_verificado();

-- ---------------------------------------------------------------------------
-- Sin correo verificado no hay primera sucursal
-- ---------------------------------------------------------------------------

/** Si el duenio de esta marca ya confirmo su correo. */
create or replace function public.correo_verificado_de_marca(p_marca uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select coalesce(p.correo_verificado_en is not null, false)
    from public.marcas m
    join public.perfiles p on p.id = m.perfil_id
   where m.id = p_marca;
$fn$;

create or replace function public.exigir_correo_verificado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  -- El administrador da de alta por su cuenta y no pasa por este aro.
  if public.es_admin() then
    return new;
  end if;

  if not public.correo_verificado_de_marca(new.marca_id) then
    raise exception 'Confirma tu correo antes de crear tu primera sucursal';
  end if;

  return new;
end;
$fn$;

drop trigger if exists al_crear_sucursal_exigir_correo on public.sucursales;

create trigger al_crear_sucursal_exigir_correo
  before insert on public.sucursales
  for each row execute function public.exigir_correo_verificado();
