-- Planes Gratis, Basico y Pro, y la promocion de apertura del Festival.
--
-- Decidido el 13 de octubre de 2026. Los tres planes se recorren un lugar:
--
--   Antes     Ahora    Mensual   Anual (-20%)
--   Basico    Gratis   $0        —            30 dias
--   Plus      Basico   $199      $1,910
--   Premier   Pro      $299      $2,870
--
-- Los ids no cambian (1, 2, 3) ni lo que trae cada uno: solo nombre y precio.
--
-- **Gratis dura treinta dias.** Es una prueba a $0: al vencer, quien no paso a
-- Basico o Pro sale del directorio (`vencer_pruebas`, todavia sin programar).
-- Si su convenio da el plan gratis hasta una fecha mas lejana, manda la fecha.
--
-- **La promocion de apertura** es un convenio con `plan_id` y `cubre_hasta`:
-- quien paga un mes de ese plan mientras el codigo esta vigente, con el
-- descuento del convenio, lo tiene pagado hasta `cubre_hasta`. El codigo lo da
-- el administrador; la idea es Pro al 50%, pagado antes del 30 de octubre, que
-- cubre noviembre y diciembre. Desde enero se cobra el precio normal: en estos
-- convenios el descuento es del primer pago, no de por vida.
--
-- Esta migracion reemplaza a la de «todo gratis en 2026», que no llego a
-- aplicarse.

-- ---------------------------------------------------------------------------
-- Los planes
-- ---------------------------------------------------------------------------

update public.tiers set nombre = 'Gratis', precio_mensual = 0   where id = 1;
update public.tiers set nombre = 'Básico', precio_mensual = 199 where id = 2;
update public.tiers set nombre = 'Pro',    precio_mensual = 299 where id = 3;

-- Cuanto dura el plan Gratis. `lib/precios.ts` lo repite (`DIAS_GRATIS`).
create or replace function public.dias_gratis()
returns integer
language sql
immutable
set search_path = ''
as $$
  select 30;
$$;

-- ---------------------------------------------------------------------------
-- La promocion: un convenio que paga por adelantado
-- ---------------------------------------------------------------------------

alter table public.convenios
  add column if not exists plan_id smallint references public.tiers (id),
  add column if not exists cubre_hasta date;

alter table public.convenios drop constraint if exists convenios_promocion_completa;
alter table public.convenios add constraint convenios_promocion_completa
  check ((plan_id is null) = (cubre_hasta is null));

comment on table public.convenios is
  'Codigos de convenio: plan Gratis hasta una fecha, descuento en los planes de pago, o una promocion que paga un plan por adelantado. Ver migraciones 000051 y 000053.';
comment on column public.convenios.basico_gratis_hasta is
  'Ultimo dia del plan Gratis (el mas barato) para quien entra con este codigo, si es mas lejos que los 30 dias de siempre. Se llama asi porque ese plan se llamaba Basico.';
comment on column public.convenios.descuento is
  'Porcentaje sobre los planes de pago mientras se siga pagando. En una promocion (plan_id), solo sobre el primer pago. No se suma al del pago anual.';
comment on column public.convenios.plan_id is
  'Promocion: el plan que se paga por adelantado. Va junto con cubre_hasta.';
comment on column public.convenios.cubre_hasta is
  'Promocion: ultimo dia que cubre el primer pago. El siguiente cobro es al dia siguiente, al precio normal.';

alter table public.suscripciones
  add column if not exists pago_de_apertura numeric(10,2);

comment on column public.suscripciones.pago_de_apertura is
  'Lo que se pago al abrirla por una promocion (convenios.plan_id). Null si no hubo.';

-- Lo que ofrece un codigo vigente. Cambia de forma: hay que soltarla primero.
drop function if exists public.revisar_convenio(text);

create function public.revisar_convenio(p_codigo text)
returns table (
  id uuid,
  descripcion text,
  basico_gratis_hasta date,
  descuento smallint,
  plan_id smallint,
  cubre_hasta date
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_convenio public.convenios%rowtype;
  v_hoy date := (now() at time zone 'America/Mexico_City')::date;
begin
  select * into v_convenio
    from public.convenios c
   where c.codigo = public.normalizar_codigo(p_codigo);

  if not found then
    raise exception 'Ese código no existe. Revisa que esté bien escrito.';
  end if;

  if v_hoy < v_convenio.vigente_desde then
    raise exception 'Ese código todavía no está vigente. Sirve a partir del %.',
      to_char(v_convenio.vigente_desde, 'DD/MM/YYYY');
  end if;

  if v_hoy > v_convenio.vigente_hasta then
    raise exception 'Ese código ya venció: sirvió hasta el %.',
      to_char(v_convenio.vigente_hasta, 'DD/MM/YYYY');
  end if;

  return query
    select v_convenio.id, v_convenio.descripcion,
           v_convenio.basico_gratis_hasta, v_convenio.descuento,
           v_convenio.plan_id, v_convenio.cubre_hasta;
end;
$$;

revoke all on function public.revisar_convenio(text) from public, anon;
grant execute on function public.revisar_convenio(text) to authenticated;

drop function if exists public.convenio_de_sucursal(uuid);

create function public.convenio_de_sucursal(p_sucursal uuid)
returns table (
  codigo text,
  descripcion text,
  basico_gratis_hasta date,
  descuento smallint,
  plan_id smallint,
  cubre_hasta date
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (public.posee_sucursal(p_sucursal) or public.es_admin()) then
    raise exception 'Esa sucursal no es tuya.';
  end if;

  return query
    select c.codigo, c.descripcion, c.basico_gratis_hasta, c.descuento,
           c.plan_id, c.cubre_hasta
      from public.suscripciones s
      join public.convenios c on c.id = s.convenio_id
     where s.sucursal_id = p_sucursal
     order by s.fecha_inicio desc
     limit 1;
end;
$$;

revoke all on function public.convenio_de_sucursal(uuid) from public, anon;
grant execute on function public.convenio_de_sucursal(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- El precio
-- ---------------------------------------------------------------------------

create or replace function public.precio_de_suscripcion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gratis smallint;
  v_precio numeric;
  v_convenio public.convenios%rowtype;
  v_descuento numeric := 0;
  v_hoy date := (now() at time zone 'America/Mexico_City')::date;
  v_tope timestamptz;
begin
  select id into v_gratis from public.tiers order by precio_mensual limit 1;
  select precio_mensual into v_precio from public.tiers where id = new.tier_id;

  new.pago_de_apertura := null;

  if new.convenio_id is not null then
    -- Sirve si esta vigente hoy, o si la sucursal ya lo tenia: cambiar de plan
    -- en enero no le quita el descuento a quien entro por el Festival.
    if not (
      public.convenio_vigente(new.convenio_id)
      or exists (
        select 1 from public.suscripciones s
         where s.sucursal_id = new.sucursal_id and s.convenio_id = new.convenio_id
      )
    ) then
      raise exception 'Ese código de convenio no está vigente.';
    end if;

    select * into v_convenio from public.convenios where id = new.convenio_id;
  end if;

  -- Gratis: treinta dias a $0, o hasta la fecha del convenio si llega mas
  -- lejos. Cambiar a Gratis desde otra prueba no regala dias: se queda la
  -- fecha que ya traia, si es mas cercana.
  if new.tier_id = v_gratis then
    v_tope := now() + make_interval(days => public.dias_gratis());

    if v_convenio.basico_gratis_hasta is not null and v_hoy <= v_convenio.basico_gratis_hasta then
      v_tope := greatest(
        v_tope,
        ((v_convenio.basico_gratis_hasta + 1)::timestamp at time zone 'America/Mexico_City')
      );
    end if;

    new.monto_mensual := 0;
    new.monto_por_cobro := 0;
    new.estado := 'trial';
    new.fecha_fin_trial := least(coalesce(new.fecha_fin_trial, v_tope), v_tope);
    return new;
  end if;

  -- Promocion: el plan de la promocion, pagado (`activo`) mientras el codigo
  -- esta vigente. El primer pago lleva el descuento y cubre hasta
  -- `cubre_hasta`; lo que queda guardado es el precio normal, que es lo que se
  -- cobra despues. En prueba no hay promocion: lo que se regala es el pago.
  -- Y es una vez por sucursal: cambiar de plan despues no la repite.
  if v_convenio.plan_id is not null
     and new.tier_id = v_convenio.plan_id
     and new.estado = 'activo'
     and public.convenio_vigente(new.convenio_id)
     and v_hoy <= v_convenio.cubre_hasta
     and not exists (
       select 1 from public.suscripciones s
        where s.sucursal_id = new.sucursal_id
          and s.convenio_id = new.convenio_id
          and s.pago_de_apertura is not null
     ) then
    new.pago_de_apertura := round(v_precio * (1 - v_convenio.descuento / 100.0));
    new.fecha_fin_trial := null;
    new.fecha_proximo_cobro :=
      ((v_convenio.cubre_hasta + 1)::timestamp at time zone 'America/Mexico_City');
  elsif v_convenio.plan_id is null then
    -- Un convenio de siempre descuenta mientras se pague. El de una promocion
    -- solo descuenta su primer pago.
    v_descuento := coalesce(v_convenio.descuento, 0);
  end if;

  -- Una prueba de pago dura quince dias como mucho. Sin esto, quien tiene
  -- Gratis hasta noviembre se pasaba a Pro y lo tenia gratis igual.
  if new.estado = 'trial' then
    new.fecha_fin_trial := least(
      coalesce(new.fecha_fin_trial, now() + interval '15 days'),
      now() + interval '15 days'
    );
  end if;

  -- El anual descuenta 20%. Si el convenio ya da descuento, se queda el mayor:
  -- no se suman.
  if new.periodo = 'anual' then
    v_descuento := greatest(v_descuento, 20);
    new.monto_por_cobro := round(v_precio * 12 * (1 - v_descuento / 100));
    new.monto_mensual := round(new.monto_por_cobro / 12, 2);
  else
    new.monto_mensual := round(v_precio * (1 - v_descuento / 100));
    new.monto_por_cobro := new.monto_mensual;
  end if;

  return new;
end;
$$;

create or replace function public.proteger_precio_de_suscripcion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.es_admin() then
    return new;
  end if;

  if new.monto_mensual is distinct from old.monto_mensual
     or new.monto_por_cobro is distinct from old.monto_por_cobro
     or new.pago_de_apertura is distinct from old.pago_de_apertura
     or new.convenio_id is distinct from old.convenio_id
     or new.periodo is distinct from old.periodo
     or new.tier_id is distinct from old.tier_id then
    raise exception 'El plan y su precio no se cambian así: hay que contratar de nuevo.';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Lo que ya estaba abierto
-- ---------------------------------------------------------------------------
--
-- Quien estaba en el Basico de $99 queda en Gratis: $0 y treinta dias desde
-- hoy (o lo que ya tuviera, si era mas). `proteger_precio_de_suscripcion` no
-- deja tocar el monto y esta migracion no corre como administrador, asi que se
-- apaga mientras dura el arreglo.

alter table public.suscripciones disable trigger al_editar_proteger_precio;

update public.suscripciones
   set monto_mensual = 0,
       monto_por_cobro = 0,
       estado = 'trial',
       fecha_fin_trial = greatest(
         coalesce(fecha_fin_trial, now()),
         now() + make_interval(days => public.dias_gratis())
       )
 where tier_id = 1
   and estado in ('trial', 'activo', 'pausado_por_pago');

alter table public.suscripciones enable trigger al_editar_proteger_precio;
