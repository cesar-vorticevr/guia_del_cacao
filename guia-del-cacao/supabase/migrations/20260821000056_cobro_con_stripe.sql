-- Cobro con Stripe.
--
-- Hasta aqui el cobro era simulado (`lib/pagos.ts` aprobaba todo). Desde esta
-- migracion el negocio paga en Stripe Checkout: la tarjeta la captura Stripe y
-- nunca pasa por la Guia. Lo que se guarda aqui son solo los identificadores
-- que unen cada cosa con su par en Stripe.
--
-- Una marca es un cliente de Stripe (`marcas.stripe_customer_id`). Una
-- suscripcion de Stripe puede cubrir varias sucursales a la vez —se pagan
-- juntas desde la cuenta, una por unidad—, asi que varias filas de
-- `suscripciones` pueden compartir el mismo `stripe_subscription_id`.
--
-- Quien escribe estas columnas es el webhook de Stripe (`/api/stripe/webhook`),
-- con la llave de servicio: el negocio no las toca. `proteger_precio_de_
-- suscripcion` ya impide cambiar plan y monto; el id de Stripe tambien queda
-- fuera de su alcance.
--
-- Cada plan tiene su producto en Stripe (`tiers.stripe_product_id`), creado la
-- primera vez que se cobra. El precio no se guarda alli: se manda en cada
-- cobro desde la misma cuenta de siempre (`lib/precios.ts`, espejo de
-- `precio_de_suscripcion`).

alter table public.marcas
  add column if not exists stripe_customer_id text unique;

alter table public.suscripciones
  add column if not exists stripe_subscription_id text;

create index if not exists suscripciones_por_stripe
  on public.suscripciones (stripe_subscription_id)
  where stripe_subscription_id is not null;

alter table public.tiers
  add column if not exists stripe_product_id text;

comment on column public.marcas.stripe_customer_id is
  'Cliente de Stripe de la marca. Lo pone el webhook al primer pago. Ver migracion 000056.';
comment on column public.suscripciones.stripe_subscription_id is
  'Suscripcion de Stripe que cobra esta fila. Varias sucursales pueden compartirla.';
comment on column public.tiers.stripe_product_id is
  'Producto de Stripe del plan. Se crea la primera vez que se cobra.';

-- El negocio no puede apuntar su suscripcion a otra de Stripe ni quitarsela.
create or replace function public.proteger_precio_de_suscripcion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Sin usuario (migraciones, webhook con la llave de servicio) o administrador.
  if (select auth.uid()) is null or public.es_admin() then
    return new;
  end if;

  if new.monto_mensual is distinct from old.monto_mensual
     or new.monto_por_cobro is distinct from old.monto_por_cobro
     or new.pago_de_apertura is distinct from old.pago_de_apertura
     or new.convenio_id is distinct from old.convenio_id
     or new.periodo is distinct from old.periodo
     or new.tier_id is distinct from old.tier_id
     or new.stripe_subscription_id is distinct from old.stripe_subscription_id then
    raise exception 'El plan y su precio no se cambian así: hay que contratar de nuevo.';
  end if;

  return new;
end;
$$;

-- Lo mismo al abrir: una fila nueva no nace apuntando a una suscripcion de
-- Stripe si no la abre el webhook.
create or replace function public.solo_stripe_abre_con_stripe()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.stripe_subscription_id is not null
     and (select auth.uid()) is not null
     and not public.es_admin() then
    raise exception 'Una suscripción de Stripe solo la registra el cobro.';
  end if;

  return new;
end;
$$;

drop trigger if exists al_abrir_solo_stripe on public.suscripciones;
create trigger al_abrir_solo_stripe
  before insert on public.suscripciones
  for each row execute function public.solo_stripe_abre_con_stripe();

-- `stripe_customer_id` de la marca: tampoco lo cambia su duena.
create or replace function public.proteger_cliente_de_stripe()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.stripe_customer_id is distinct from old.stripe_customer_id
     and (select auth.uid()) is not null
     and not public.es_admin() then
    raise exception 'El cliente de Stripe lo registra el cobro.';
  end if;

  return new;
end;
$$;

drop trigger if exists al_editar_proteger_stripe on public.marcas;
create trigger al_editar_proteger_stripe
  before update on public.marcas
  for each row execute function public.proteger_cliente_de_stripe();
