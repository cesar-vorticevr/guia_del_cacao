-- El cobro pasa a ser por sucursal, y cada una estrena quince dias de prueba.
--
-- Hasta aqui habia **una suscripcion por marca** que cubria a todas sus
-- sucursales, con un tope de cuantas permitia el plan. La spec v2 lo invierte:
-- "El cobro es por sucursal. Una marca con 3 sucursales paga 3 suscripciones
-- independientes, cada una con su propio tier" (§5.1). Una marca puede tener a
-- la vez una sucursal publicada y pagando, otra en prueba y otra en borrador.

alter table public.suscripciones
  add column if not exists fecha_fin_trial timestamptz;

comment on column public.suscripciones.fecha_fin_trial is
  'Cuando termina la prueba. Se pone al aprobar la sucursal y no al elegir el plan: el conteo no puede correr mientras el negocio espera la revision del administrador (spec v2 §3.3, paso 6).';

-- ---------------------------------------------------------------------------
-- Una suscripcion viva por sucursal, no por marca
-- ---------------------------------------------------------------------------
drop index if exists public.suscripcion_activa_por_marca;

create unique index if not exists suscripcion_viva_por_sucursal
  on public.suscripciones (sucursal_id)
  where estado in ('trial', 'activo', 'pausado_por_pago');

comment on index public.suscripcion_viva_por_sucursal is
  'Una sola suscripcion abierta por sucursal. `pausado_por_pago` cuenta como abierta: es la misma suscripcion esperando tarjeta, y dejar crear otra encima duplicaria el cobro al reactivar.';

-- ---------------------------------------------------------------------------
-- El plan lo tiene la sucursal
-- ---------------------------------------------------------------------------
--
-- `trial` y `activo` dan exactamente las mismas funciones: durante la prueba el
-- micrositio sale en el directorio con todo lo de su tier encendido. Lo unico
-- que las separa es si ya se cobro. `pausado_por_pago` no da ninguna: es la
-- sucursal fuera del directorio esperando tarjeta.
create or replace function public.plan_de_sucursal(p_sucursal uuid)
returns smallint
language sql
stable
security definer
set search_path = ''
as $$
  select s.tier_id
    from public.suscripciones s
   where s.sucursal_id = p_sucursal
     and s.estado in ('trial', 'activo')
   limit 1;
$$;

comment on function public.plan_de_sucursal(uuid) is
  'El plan vigente de una sucursal, o null si no tiene suscripcion abierta. Durante el trial devuelve el tier elegido: la prueba da las mismas funciones que el plan pagado, que es lo que la hace una prueba.';

-- Publicar contenido pasa a mirar el plan de la propia sucursal. El nombre de
-- la funcion se queda -lo usan las politicas de eventos y noticias- pero ya no
-- pregunta por la marca.
create or replace function public.marca_publica_contenido(p_sucursal uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(t.puede_publicar_contenido, false)
    from public.tiers t
   where t.id = public.plan_de_sucursal(p_sucursal);
$$;

comment on function public.marca_publica_contenido(uuid) is
  'Si esa sucursal puede publicar eventos y noticias. Desde la spec v2 mira su propia suscripcion, no la de su marca: dos sucursales de la misma marca pueden estar en planes distintos.';

-- Una sucursal nueva ya no hereda plan de nadie: nace en borrador, sin tier, y
-- elige el suyo al publicar. Era lo que hacia falta para que la segunda
-- sucursal estrene su propia prueba en vez de entrar cubierta por la primera.
drop trigger if exists al_crear_sucursal_0_plan on public.sucursales;

drop function if exists public.heredar_plan_de_marca();

-- ---------------------------------------------------------------------------
-- Publicar exige plan propio
-- ---------------------------------------------------------------------------
create or replace function public.proteger_estado_sucursal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  es_admin boolean := (select auth.uid()) is null
    or coalesce(
      (select p.rol from public.perfiles p where p.id = (select auth.uid())),
      'cliente'
    ) = 'admin';
begin
  if new.estado is not distinct from old.estado then
    return new;
  end if;

  if new.estado = 'rechazado' and not es_admin then
    raise exception 'Solo un administrador puede rechazar una sucursal';
  end if;

  if new.estado = 'publicado' and not es_admin then
    -- Una pausa de moderacion solo la levanta quien la puso.
    if old.estado = 'pausado' and old.pausado_por_admin then
      raise exception 'Este micrositio esta pausado por moderacion: solo un administrador puede reactivarlo';
    end if;

    -- Y lo demas lo decide el plan de esta sucursal, no el de su marca.
    if public.plan_de_sucursal(new.id) is null then
      raise exception 'Para publicar hace falta elegir un plan';
    end if;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- El reloj de la prueba arranca al aprobar
-- ---------------------------------------------------------------------------
--
-- "El conteo de los 15 dias inicia en el momento de la aprobacion, no en el
-- momento en que el negocio eligio el tier (para no penalizar tiempos de
-- revision del Administrador)" (spec v2 §3.3, paso 6).
--
-- Solo la primera vez. Si la sucursal se pausa por moderacion y se reactiva, o
-- cambia de plan durante la prueba, la fecha ya esta puesta y no se mueve:
-- reponerla en cada aprobacion regalaria quince dias nuevos cada vez.
create or replace function public.arrancar_prueba_al_aprobar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.estado = 'publicado' and old.estado is distinct from 'publicado' then
    update public.suscripciones
       set fecha_fin_trial = now() + interval '15 days'
     where sucursal_id = new.id
       and estado = 'trial'
       and fecha_fin_trial is null;
  end if;

  return new;
end;
$$;

comment on function public.arrancar_prueba_al_aprobar() is
  'Pone la fecha de fin de prueba cuando el administrador aprueba, y solo si estaba vacia. Ver spec v2 §3.3 paso 6.';

drop trigger if exists al_aprobar_arrancar_prueba on public.sucursales;

create trigger al_aprobar_arrancar_prueba
  after update on public.sucursales
  for each row execute function public.arrancar_prueba_al_aprobar();

-- ---------------------------------------------------------------------------
-- Lo que ya existia
-- ---------------------------------------------------------------------------
--
-- Las suscripciones que habia son por marca y cubrian a todas sus sucursales a
-- la vez. Repartirlas seria dejar a una con plan y a las demas sin nada: una
-- marca con tres micrositios publicados perderia dos esta misma noche, sin
-- haber hecho nada.
--
-- Asi que a cada sucursal **publicada** se le abre su propia suscripcion, con
-- el tier que ya tenia puesto. Nadie gana ni pierde funciones al migrar; lo que
-- cambia es de donde cuelga el cobro. Van como `activo` y no como `trial`
-- porque estos micrositios llevan tiempo publicados: estrenarles una prueba
-- seria regalar quince dias a quien ya estaba pagando.
insert into public.suscripciones (sucursal_id, tier_id, monto_mensual, estado, fecha_proximo_cobro)
select s.id,
       s.tier_id,
       t.precio_mensual,
       'activo',
       now() + interval '1 month'
  from public.sucursales s
  join public.tiers t on t.id = s.tier_id
 where s.estado = 'publicado'
   and not exists (
     select 1 from public.suscripciones x
      where x.sucursal_id = s.id
        and x.estado in ('trial', 'activo', 'pausado_por_pago')
   );

-- Las de marca se cierran: ya no cubren nada. Se marcan canceladas en vez de
-- borrarse, que son el registro de lo que se cobro.
update public.suscripciones
   set estado = 'cancelado'
 where sucursal_id is null
   and marca_id is not null
   and estado = 'activo';

-- `plan_de_marca` se queda sin usarse, pero no se borra: `tope_de_sucursales`
-- todavia la llama y esa funcion sigue en pie por compatibilidad hasta que el
-- panel deje de consultarla.
comment on function public.plan_de_marca(uuid) is
  'Obsoleta desde la spec v2: el plan es de la sucursal, no de la marca. Usar `plan_de_sucursal`.';
