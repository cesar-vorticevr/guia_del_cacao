-- La membresia de la Guia, los precios del Festival y treinta dias con todo.
--
-- Decidido el 9 de noviembre de 2026, con el poster del stand:
--
-- 0. Ya no hay «Pro»: hay una **membresia** para estar o no en la Guia. El
--    plan 3 se llama asi, y los avisos de la base dejan de nombrar al Pro.
--    Sin membresia (la prueba vencida, un pago que no llego) la marca deja de
--    verse al publico, pero su dueño **conserva el control de su contenido**:
--    edita su micrositio, su catalogo y sus eventos, que vuelven a verse en
--    cuanto paga. Por eso se quitan los triggers que frenaban escribir eventos
--    y noticias sin plan: lo que se ve ya se deriva del plan de hoy
--    (`marca_publica_contenido` en la politica de lectura, 000028).
-- 1. La membresia baja a $299 al mes. El anual sigue siendo diez mensualidades
--    (000055): $2,990.
-- 2. La prueba dura **treinta dias** y trae todo: lo que ya traia el Gratis
--    desde la 000068 y, ahora, tambien **recibir pedidos**, que era lo unico
--    que el Gratis no tenia. Al vencer, `vencer_pruebas()` la pausa como
--    siempre.
-- 3. **Promocion Festival**: del 12 al 16 de noviembre, el primer año del
--    anual cuesta $1,499 en vez de $2,990. No vive aqui: el monto guardado es
--    el normal, que es lo que se cobra al renovar, y el descuento lo aplica
--    Stripe en el primer cobro con un cupon de una vez, como el de los
--    vendedores (`lib/stripe.ts`, `FESTIVAL` en `lib/precios.ts`).
--
-- Las suscripciones ya abiertas conservan su precio: el monto se fija al
-- abrir y `proteger_precio_de_suscripcion` no lo deja tocar. Las pruebas
-- vigentes si se alargan a los treinta dias, que es lo que se le dice a todos.

update public.tiers set precio_mensual = 299 where id = 3;

create or replace function public.dias_gratis()
returns integer
language sql
immutable
set search_path = ''
as $$
  select 30;
$$;

-- Las pruebas que siguen vivas llegan a los treinta dias desde que empezaron.
-- Solo se alarga: a quien un convenio le daba mas, se le respeta.
update public.suscripciones
   set fecha_fin_trial = fecha_inicio + make_interval(days => public.dias_gratis())
 where estado = 'trial'
   and fecha_fin_trial > now()
   and fecha_fin_trial < fecha_inicio + make_interval(days => public.dias_gratis());

-- Igual que en la 000055; solo cambia el tope de la prueba de pago, que eran
-- quince dias escritos a mano y ahora es `dias_gratis()`.
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

  -- Una prueba de pago dura lo que el Gratis como mucho. Sin esto, quien tiene
  -- Gratis hasta noviembre se pasaba a Pro y lo tenia gratis igual.
  if new.estado = 'trial' then
    v_tope := now() + make_interval(days => public.dias_gratis());
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

-- Recibir pedidos: tambien en la prueba. Antes pedia un plan pagado
-- (`activo` y precio mayor que cero); ahora basta un plan vigente, que es la
-- prueba sin vencer o el pagado. Lo demas, igual que en la 000074.
create or replace function public.por_que_no_vende(p_sucursal uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s record;
begin
  select su.estado, su.marca_id, m.es_demo
    into s
    from public.sucursales su
    join public.marcas m on m.id = su.marca_id
   where su.id = p_sucursal;

  if not found then
    return 'Esa sucursal no existe.';
  end if;

  if s.es_demo then
    return 'Es un negocio de demostración.';
  end if;

  if s.estado <> 'publicado' then
    return 'La sucursal no está publicada.';
  end if;

  if not exists (
    select 1 from public.suscripciones x
     where x.sucursal_id = p_sucursal
       and (
         x.estado = 'activo'
         or (x.estado = 'trial' and coalesce(x.fecha_fin_trial, now()) > now())
       )
  ) then
    return 'Para recibir pedidos hace falta un plan vigente: tu prueba ya venció.';
  end if;

  if exists (
    select 1 from public.datos_de_pago d
     where d.marca_id = s.marca_id and not d.recibe_pedidos
  ) then
    return 'Apagaste «Recibir pedidos».';
  end if;

  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- 0. La membresia
-- ---------------------------------------------------------------------------

update public.tiers set nombre = 'Membresía' where id = 3;

-- Escribir eventos y noticias ya no depende del plan: sin membresia no se ven,
-- pero se pueden preparar y corregir. La funcion se queda por si se vuelve a
-- necesitar; solo se le quitan sus triggers.
drop trigger if exists exigir_plan_al_publicar_evento on public.eventos;
drop trigger if exists exigir_plan_al_publicar_noticia on public.noticias;

-- Los avisos que nombraban al Pro. Se reescribe la definicion vigente en vez
-- de copiarla aqui entera: solo cambia la frase.
do $$
declare
  v_def text;
begin
  v_def := pg_get_functiondef('public.exigir_cupo_de_experiencias()'::regprocedure);
  execute replace(v_def, 'viene con el plan Pro.', 'viene con la membresía.');
  v_def := pg_get_functiondef('public.exigir_plan_con_ruleta()'::regprocedure);
  execute replace(v_def, 'viene con el plan Pro.', 'viene con la membresía.');
end;
$$;
