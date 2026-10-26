-- La comision del embajador es recurrente y sube a 25%.
--
-- Hasta la 000059 el embajador ganaba el 20% del PRIMER pago del negocio que
-- invito, y se anotaba en la misma fila de `referidos`. Ahora gana el 25% de
-- CADA cobro que Stripe confirme mientras ese negocio siga pagando: el primero
-- y todas las renovaciones, mes a mes o año a año.
--
-- - Cada cobro es una fila de `comisiones`, con la factura de Stripe que lo
--   prueba (`stripe_factura`, unica): un aviso repetido no anota dos veces.
-- - Solo la escribe `registrar_comision`, que llama el webhook con la llave de
--   servicio al recibir `invoice.paid` con monto cobrado. Volver de la pagina
--   de pago o abrir una suscripcion no prueba nada; la factura pagada si.
-- - El descuento del negocio no cambia: 20% en su primer pago.
-- - `referidos` se queda como el vinculo (que marca trajo quien) y su
--   `monto_pagado` sigue marcando que el descuento ya se uso. Sus columnas
--   `comision` y `pago_id` quedan en desuso: lo que cuenta es `comisiones`.

create or replace function public.comision_de_embajador()
returns numeric language sql immutable set search_path = '' as $$ select 25::numeric; $$;

create table if not exists public.comisiones (
  id             uuid primary key default gen_random_uuid(),
  embajador_id   uuid not null references public.embajadores (perfil_id) on delete restrict,
  marca_id       uuid not null references public.marcas (id) on delete cascade,
  -- Lo que Stripe cobro de verdad, ya con descuentos.
  monto_pagado   numeric(10, 2) not null check (monto_pagado > 0),
  porcentaje     numeric(5, 2) not null check (porcentaje > 0 and porcentaje <= 100),
  comision       numeric(10, 2) not null check (comision >= 0),
  stripe_factura text not null unique,
  cobrado_en     timestamptz not null default now(),
  -- La transferencia que la cubrio. Null: todavia se le debe.
  pago_id        uuid references public.pagos_a_embajadores (id) on delete set null
);

create index if not exists comisiones_embajador_idx
  on public.comisiones (embajador_id, cobrado_en desc);

comment on table public.comisiones is
  'Una comision por cada cobro confirmado por Stripe de un negocio referido. Ver migracion 000065.';

alter table public.comisiones enable row level security;

drop policy if exists comisiones_lectura on public.comisiones;
create policy comisiones_lectura on public.comisiones
  for select using (embajador_id = (select auth.uid()) or public.es_admin());

-- Sin politicas de escritura: la ausencia es la regla.

-- Lo anotado antes, al 20% del primer pago, pasa a su propia fila.
insert into public.comisiones
  (embajador_id, marca_id, monto_pagado, porcentaje, comision, stripe_factura, cobrado_en, pago_id)
select r.embajador_id, r.marca_id, r.monto_pagado, 20, r.comision,
       'anterior-' || r.marca_id::text, coalesce(r.pagado_en, r.vinculado_en), r.pago_id
  from public.referidos r
 where r.comision is not null and r.monto_pagado > 0
on conflict (stripe_factura) do nothing;

-- Stripe confirmo un cobro. Si la marca llego con codigo de un embajador
-- activo, se anota su comision. Idempotente por factura.
--
-- La marca puede no venir (suscripciones viejas sin `marca_id` en su
-- metadata): entonces se deduce de la suscripcion de Stripe.
drop function if exists public.registrar_comision(uuid, numeric, text);

create or replace function public.registrar_comision(
  p_marca uuid,
  p_monto numeric,
  p_suscripcion text,
  p_factura text
)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_marca uuid := p_marca;
  v_embajador uuid;
  v_comision numeric;
begin
  if coalesce(p_monto, 0) <= 0 or coalesce(trim(p_factura), '') = '' then
    return 0;
  end if;

  if v_marca is null then
    select s.marca_id into v_marca
      from public.suscripciones su
      join public.sucursales s on s.id = su.sucursal_id
     where su.stripe_subscription_id = p_suscripcion
     limit 1;
  end if;

  select r.embajador_id into v_embajador
    from public.referidos r
    join public.embajadores e on e.perfil_id = r.embajador_id
   where r.marca_id = v_marca and e.estado = 'activo';

  if v_embajador is null then
    return 0;
  end if;

  insert into public.comisiones (embajador_id, marca_id, monto_pagado, porcentaje, comision, stripe_factura)
  values (v_embajador, v_marca, p_monto, public.comision_de_embajador(),
          round(p_monto * public.comision_de_embajador() / 100, 2), p_factura)
  on conflict (stripe_factura) do nothing
  returning comision into v_comision;

  -- El primer cobro marca que el descuento del codigo ya se uso.
  update public.referidos r
     set monto_pagado = p_monto,
         pagado_en = now(),
         stripe_subscription_id = p_suscripcion
   where r.marca_id = v_marca and r.monto_pagado is null;

  return coalesce(v_comision, 0);
end;
$$;

revoke all on function public.registrar_comision(uuid, numeric, text, text) from public, anon, authenticated;
grant execute on function public.registrar_comision(uuid, numeric, text, text) to service_role;

-- Pagar lo acumulado: ahora suma las comisiones de cada cobro.
create or replace function public.registrar_pago_a_embajador(p_embajador uuid, p_referencia text)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_monto numeric;
  v_pago uuid;
begin
  if not public.es_admin() then
    raise exception 'Solo el administrador registra pagos a embajadores.';
  end if;

  select coalesce(sum(c.comision), 0) into v_monto
    from public.comisiones c
   where c.embajador_id = p_embajador and c.pago_id is null;

  if v_monto <= 0 then
    raise exception 'No hay comisiones por pagar a este embajador.';
  end if;

  insert into public.pagos_a_embajadores (embajador_id, monto, referencia)
  values (p_embajador, v_monto, nullif(trim(p_referencia), ''))
  returning id into v_pago;

  update public.comisiones
     set pago_id = v_pago
   where embajador_id = p_embajador and pago_id is null;

  return v_monto;
end;
$$;

-- Los negocios que trajo quien mira, con lo que llevan pagado y lo que le han
-- dejado. `sigue_pagando`: tiene hoy alguna suscripcion pagada y activa.
drop function if exists public.mis_referidos();

create or replace function public.mis_referidos()
returns table (
  marca text,
  vinculado_en timestamptz,
  cobros integer,
  total_pagado numeric,
  total_comision numeric,
  por_cobrar numeric,
  ultimo_cobro timestamptz,
  sigue_pagando boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.nombre_comercial,
         r.vinculado_en,
         count(c.id)::integer,
         coalesce(sum(c.monto_pagado), 0),
         coalesce(sum(c.comision), 0),
         coalesce(sum(c.comision) filter (where c.pago_id is null), 0),
         max(c.cobrado_en),
         exists (
           select 1 from public.suscripciones su
             join public.sucursales s on s.id = su.sucursal_id
            where s.marca_id = r.marca_id and su.estado = 'activo' and su.monto_por_cobro > 0
         )
    from public.referidos r
    join public.marcas m on m.id = r.marca_id
    left join public.comisiones c on c.marca_id = r.marca_id and c.embajador_id = r.embajador_id
   where r.embajador_id = (select auth.uid())
   group by m.nombre_comercial, r.vinculado_en, r.marca_id
   order by r.vinculado_en desc;
$$;

revoke all on function public.mis_referidos() from public, anon;
grant execute on function public.mis_referidos() to authenticated;
