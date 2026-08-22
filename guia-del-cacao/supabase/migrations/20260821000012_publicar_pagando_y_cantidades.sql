-- Guía del Cacao — publicar es cosa del pago, y las solicitudes llevan cantidad
--
-- Dos cambios que vienen del mismo lado, el de quien vende:
--
--   1. Publicar ya no espera aprobacion. Quien paga, sale. La revision previa
--      era un cuello de botella para un directorio que quiere llenarse de
--      negocios; la moderacion sigue existiendo, pero como reaccion (pausar) y
--      no como permiso de entrada.
--
--   2. El cliente ya no solo dice QUE compro, sino CUANTO de cada cosa. Con una
--      casilla suelta, dos kilos de cacao y un chocolate se veian igual, y la
--      marca decidia las monedas a ciegas.

-- ---------------------------------------------------------------------------
-- Cuanto compro de cada cosa
-- ---------------------------------------------------------------------------

-- Con default 1 para no romper las filas que ya existen: una casilla marcada
-- del modelo anterior significaba exactamente "uno".
alter table public.solicitud_productos
  add column cantidad smallint not null default 1
  check (cantidad between 1 and 99);

comment on column public.solicitud_productos.cantidad is
  'Cuantas piezas de ese producto. El tope de 99 es para que un dedo torpe no mande 1000 y la marca tenga que interpretarlo.';

-- ---------------------------------------------------------------------------
-- Publicar: lo autoriza la suscripcion, no un administrador
-- ---------------------------------------------------------------------------

-- Se reescribe entera la funcion de la migracion 000010, conservando lo de la
-- pausa: quien pauso decide quien reactiva, y eso no cambia. Lo que cambia es
-- que la puerta de entrada al directorio la abre el pago.
create or replace function public.proteger_estado_sucursal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  es_admin boolean := (select auth.uid()) is null
    or coalesce(
      (select p.rol from public.perfiles p where p.id = (select auth.uid())),
      'cliente'
    ) = 'admin';
  tiene_suscripcion boolean;
begin
  if new.estado is not distinct from old.estado then
    return new;
  end if;

  -- Rechazar sigue siendo decision del administrador (spec §3.3). Ya no es el
  -- paso normal de nadie, pero tiene que seguir existiendo: es como se saca del
  -- directorio a un negocio que no debia estar.
  if new.estado = 'rechazado' and not es_admin then
    raise exception 'Solo un administrador puede rechazar una sucursal';
  end if;

  if new.estado = 'publicado' and not es_admin then
    -- Una pausa de moderacion solo la levanta quien la puso. Si esto faltara,
    -- bastaria con pagar otro mes para deshacer la decision del administrador.
    if old.estado = 'pausado' and old.pausado_por_admin then
      raise exception 'Este micrositio esta pausado por moderacion: solo un administrador puede reactivarlo';
    end if;

    -- Y lo demas lo decide el pago. Que la sucursal sea suya no se comprueba
    -- aqui: de eso ya se encarga la politica sucursales_edita_propia, que es
    -- la unica via por la que un UPDATE llega hasta este trigger.
    select exists (
      select 1
        from public.suscripciones s
       where s.sucursal_id = new.id
         and s.estado = 'activo'
    ) into tiene_suscripcion;

    if not tiene_suscripcion then
      raise exception 'Para publicar hace falta una suscripcion activa';
    end if;
  end if;

  -- Queda constancia de quien pauso, que es lo que decide quien puede levantar
  -- la pausa despues.
  if new.estado = 'pausado' then
    new.pausado_por_admin := es_admin;
  elsif old.estado = 'pausado' then
    new.pausado_por_admin := false;
  end if;

  if new.estado = 'publicado' and old.estado <> 'publicado' then
    new.fecha_publicacion := coalesce(new.fecha_publicacion, now());
  end if;

  return new;
end;
$fn$;

-- El estado 'pendiente_aprobacion' se queda en el enum: puede haber filas
-- viejas esperando, y quitarlo de un enum obliga a recrear el tipo. Ya no lo
-- escribe nadie; el administrador puede sacarlas de ahi publicandolas o
-- rechazandolas.
comment on type public.estado_sucursal is
  'pendiente_aprobacion quedo en desuso desde la migracion 000012: publicar lo autoriza la suscripcion activa, no una revision.';
