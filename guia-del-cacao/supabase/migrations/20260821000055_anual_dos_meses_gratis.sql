-- El pago anual regala dos meses.
--
-- Decidido el 13 de octubre de 2026: el año cuesta diez mensualidades en vez
-- de doce menos 20%. Básico pasa de $1,910 a $1,990 al año y Pro de $2,870 a
-- $2,990; se lee mejor «2 meses gratis» que un porcentaje.
--
-- Solo cambia el bloque del anual de `precio_de_suscripcion` (000053); el
-- resto es igual. Las suscripciones anuales ya abiertas conservan su precio:
-- el monto se fija al abrir y no se recalcula.
--
-- `lib/precios.ts` repite la cuenta (`MESES_PAGADOS_AL_ANIO`). Si cambia,
-- cambia en los dos lados.

create or replace function public.meses_pagados_al_anio()
returns integer
language sql
immutable
set search_path = ''
as $$
  select 10;
$$;

comment on function public.meses_pagados_al_anio() is
  'Cuantas mensualidades cuesta el pago anual: doce menos los dos meses que regala. Ver migracion 000055.';

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
    -- Se va gastando: una por sucursal, hasta el tope del codigo.
    if v_convenio.usos_maximos is not null
       and public.usos_de_convenio(new.convenio_id) >= v_convenio.usos_maximos then
      raise exception 'Ese código ya se agotó.';
    end if;

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

  -- El anual regala dos meses: el año cuesta diez mensualidades. Si un
  -- convenio descuenta más que eso, se queda el más barato: no se suman.
  if new.periodo = 'anual' then
    new.monto_por_cobro := least(
      round(v_precio * public.meses_pagados_al_anio()),
      round(v_precio * 12 * (1 - v_descuento / 100))
    );
    new.monto_mensual := round(new.monto_por_cobro / 12, 2);
  else
    new.monto_mensual := round(v_precio * (1 - v_descuento / 100));
    new.monto_por_cobro := new.monto_mensual;
  end if;

  return new;
end;
$$;
