-- Solo hay membresia: el primer mes gratis es una promocion, no un plan.
--
-- Decidido el 9 de noviembre de 2026. La 000076 dejo una sola cosa que se
-- paga, la membresia, pero el plan Gratis seguia apareciendo como opcion al
-- lado, y quien estaba en la membresia podia «cambiarse a Gratis». No hay dos
-- planes: hay **la membresia, con su primer mes gratis de promocion**, y
-- despues $299 al mes.
--
-- 1. El plan 1 (Gratis) deja de ofrecerse. No se borra: `precio_de_suscripcion`
--    y los convenios viejos lo nombran. Las pruebas y las ocultas por no pagar
--    que estaban en el pasan a la membresia, con las mismas fechas: es la
--    misma prueba con su nombre de verdad.
-- 2. La prueba de la membresia respeta el «gratis hasta» de un convenio, que
--    antes solo valia en el plan Gratis.
-- 3. **El banner de la portada es de quien paga.** Durante el mes gratis el
--    micrositio sale en el directorio con todo, menos en el banner de los
--    estelares. `pagada(sucursales)` es la columna calculada que lee la
--    portada: `estado = 'activo'`, que es pagado con tarjeta o cubierto por una
--    promocion que ya se pago (o se regalo al 100%).
-- 4. Una prueba vencida ya no cuenta como plan aunque la tarea de la noche
--    todavia no la haya pausado: hasta entonces se podia volver a publicar con
--    ella. Sin plan vigente no se publica (`proteger_estado_sucursal`), y lo
--    oculto no se ve aunque se comparta el enlace.

-- ---------------------------------------------------------------------------
-- 1. El Gratis deja de ofrecerse
-- ---------------------------------------------------------------------------

update public.tiers set se_ofrece = false where id = 1;

update public.suscripciones s
   set tier_id = 3,
       monto_mensual = case
         when s.periodo = 'anual'
           then round(t.precio_mensual * public.meses_pagados_al_anio() / 12, 2)
         else t.precio_mensual
       end,
       monto_por_cobro = case
         when s.periodo = 'anual' then round(t.precio_mensual * public.meses_pagados_al_anio())
         else t.precio_mensual
       end
  from public.tiers t
 where t.id = 3
   and s.tier_id = 1
   and s.estado in ('trial', 'pausado_por_pago');

update public.sucursales su
   set tier_id = 3
 where su.tier_id = 1
   and exists (
     select 1 from public.suscripciones s
      where s.sucursal_id = su.id and s.tier_id = 3
        and s.estado in ('trial', 'activo', 'pausado_por_pago')
   );

-- ---------------------------------------------------------------------------
-- 2. La prueba de la membresia respeta el «gratis hasta» del convenio
-- ---------------------------------------------------------------------------
--
-- Igual que en la 000076; solo cambia el tope de la prueba de pago.
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
    if v_convenio.usos_maximos is not null
       and public.usos_de_convenio(new.convenio_id) >= v_convenio.usos_maximos then
      raise exception 'Ese código ya se agotó.';
    end if;

    new.pago_de_apertura := round(v_precio * (1 - v_convenio.descuento / 100.0));
    new.fecha_fin_trial := null;
    new.fecha_proximo_cobro :=
      ((v_convenio.cubre_hasta + 1)::timestamp at time zone 'America/Mexico_City');
  elsif v_convenio.plan_id is null then
    v_descuento := coalesce(v_convenio.descuento, 0);
  end if;

  -- La prueba de la membresia dura `dias_gratis()`, o hasta donde lo regale
  -- un convenio con «gratis hasta».
  if new.estado = 'trial' then
    v_tope := now() + make_interval(days => public.dias_gratis());

    if v_convenio.basico_gratis_hasta is not null and v_hoy <= v_convenio.basico_gratis_hasta then
      v_tope := greatest(
        v_tope,
        ((v_convenio.basico_gratis_hasta + 1)::timestamp at time zone 'America/Mexico_City')
      );
    end if;

    new.fecha_fin_trial := least(coalesce(new.fecha_fin_trial, v_tope), v_tope);
  end if;

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

-- ---------------------------------------------------------------------------
-- 3. El banner es de quien paga
-- ---------------------------------------------------------------------------

create or replace function public.pagada(s public.sucursales)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.suscripciones x
     where x.sucursal_id = s.id
       and x.estado = 'activo'
  );
$$;

comment on function public.pagada(public.sucursales) is
  'Si la sucursal ya paga su membresia (o la cubre una promocion). Columna calculada: la portada filtra el banner con ella. Ver migracion 000081.';

grant execute on function public.pagada(public.sucursales) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Una prueba vencida no es plan
-- ---------------------------------------------------------------------------

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
     and (
       s.estado = 'activo'
       or (s.estado = 'trial' and coalesce(s.fecha_fin_trial, now() + interval '1 day') > now())
     )
   limit 1;
$$;

comment on function public.plan_de_sucursal(uuid) is
  'El plan vigente de una sucursal: pagado, o en su mes gratis sin vencer. Null si no tiene, y entonces no se publica. Ver migracion 000081.';
