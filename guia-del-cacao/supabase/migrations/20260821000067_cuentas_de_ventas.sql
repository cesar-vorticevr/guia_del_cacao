-- Cuentas de ventas: el embajador deja de pedirse y lo da de alta el
-- administrador.
--
-- 1. Nadie pide ser embajador. El administrador crea la cuenta (correo y
--    contrasena los pone el, con la llave de servicio) y le asigna el codigo
--    con `asignar_embajador`. La politica `embajadores_solicita` se va: la
--    ausencia es la regla.
--
-- 2. El negocio que pone el codigo ahorra 15% en su primer pago (era 20%). El
--    vendedor sigue ganando 25% de cada cobro, ya con el descuento, pero solo
--    de los cobros hasta `embajadores.comision_hasta` (por omision, el 30 de
--    abril de 2027: noviembre a abril, seis meses). El administrador la mueve.
--
-- 3. `prospectos`: la libreta del vendedor. Cada negocio que visita, en que
--    paso va y que sigue. Cada quien ve la suya; el administrador, todas.

-- ---------------------------------------------------------------------------
-- 1. Solo el administrador da de alta
-- ---------------------------------------------------------------------------

drop policy if exists embajadores_solicita on public.embajadores;

-- Da de alta (o reactiva) a una persona como vendedora, con su codigo.
create or replace function public.asignar_embajador(p_perfil uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_codigo text;
begin
  if not public.es_admin() then
    raise exception 'Solo el administrador da de alta cuentas de ventas.';
  end if;

  if not exists (select 1 from public.perfiles p where p.id = p_perfil) then
    raise exception 'Esa cuenta no existe.';
  end if;

  select e.codigo into v_codigo from public.embajadores e where e.perfil_id = p_perfil;

  if v_codigo is null then
    select public.inventar_codigo_de_embajador(p.nombre) into v_codigo
      from public.perfiles p where p.id = p_perfil;
  end if;

  insert into public.embajadores (perfil_id, estado, codigo, aprobado_en)
  values (p_perfil, 'activo', v_codigo, now())
  on conflict (perfil_id) do update
     set estado = 'activo',
         codigo = excluded.codigo,
         aprobado_en = coalesce(public.embajadores.aprobado_en, now());

  return v_codigo;
end;
$$;

revoke all on function public.asignar_embajador(uuid) from public, anon;
grant execute on function public.asignar_embajador(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. 15% al negocio, 25% al vendedor hasta una fecha
-- ---------------------------------------------------------------------------

-- `lib/precios.ts` lo repite (`DESCUENTO_DE_EMBAJADOR`).
create or replace function public.descuento_de_embajador()
returns numeric language sql immutable set search_path = '' as $$ select 15::numeric; $$;

alter table public.embajadores
  add column if not exists comision_hasta date not null default '2027-04-30';

comment on column public.embajadores.comision_hasta is
  'Ultimo dia (hora del centro) cuyos cobros le dejan comision. Lo mueve el administrador. Ver migracion 000067.';

-- La fecha de corte tambien es del administrador.
create or replace function public.proteger_embajador()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.es_admin() or (select auth.uid()) is null then
    return new;
  end if;

  if new.estado is distinct from old.estado
     or new.codigo is distinct from old.codigo
     or new.aprobado_en is distinct from old.aprobado_en
     or new.perfil_id is distinct from old.perfil_id
     or new.solicitado_en is distinct from old.solicitado_en
     or new.comision_hasta is distinct from old.comision_hasta then
    raise exception 'Solo el administrador cambia el estado, el código o la vigencia de un vendedor.';
  end if;

  return new;
end;
$$;

-- Igual que en la 000065, mas la fecha de corte: un cobro despues de
-- `comision_hasta` no deja comision, aunque el negocio siga pagando.
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
  v_hasta date;
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

  select r.embajador_id, e.comision_hasta into v_embajador, v_hasta
    from public.referidos r
    join public.embajadores e on e.perfil_id = r.embajador_id
   where r.marca_id = v_marca and e.estado = 'activo';

  -- El primer cobro marca que el descuento del codigo ya se uso, haya
  -- comision o no.
  update public.referidos r
     set monto_pagado = p_monto,
         pagado_en = now(),
         stripe_subscription_id = p_suscripcion
   where r.marca_id = v_marca and r.monto_pagado is null;

  if v_embajador is null
     or (now() at time zone 'America/Mexico_City')::date > v_hasta then
    return 0;
  end if;

  insert into public.comisiones (embajador_id, marca_id, monto_pagado, porcentaje, comision, stripe_factura)
  values (v_embajador, v_marca, p_monto, public.comision_de_embajador(),
          round(p_monto * public.comision_de_embajador() / 100, 2), p_factura)
  on conflict (stripe_factura) do nothing
  returning comision into v_comision;

  return coalesce(v_comision, 0);
end;
$$;

revoke all on function public.registrar_comision(uuid, numeric, text, text) from public, anon, authenticated;
grant execute on function public.registrar_comision(uuid, numeric, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- 3. La libreta de prospectos
-- ---------------------------------------------------------------------------

create table if not exists public.prospectos (
  id             uuid primary key default gen_random_uuid(),
  embajador_id   uuid not null references public.embajadores (perfil_id) on delete cascade,
  negocio        text not null check (char_length(trim(negocio)) between 1 and 120),
  contacto       text check (char_length(contacto) <= 120),
  telefono       text check (char_length(telefono) <= 30),
  ciudad         text check (char_length(ciudad) <= 80),
  etapa          text not null default 'por_contactar'
                 check (etapa in ('por_contactar', 'contactado', 'demo', 'alta', 'pago', 'no_interesa')),
  nota           text check (char_length(nota) <= 1000),
  siguiente_en   date,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index if not exists prospectos_embajador_idx
  on public.prospectos (embajador_id, actualizado_en desc);

comment on table public.prospectos is
  'La libreta de cada vendedor: a que negocios ha ido y en que paso van. Ver migracion 000067.';

alter table public.prospectos enable row level security;

drop policy if exists prospectos_lectura on public.prospectos;
create policy prospectos_lectura on public.prospectos
  for select using (embajador_id = (select auth.uid()) or public.es_admin());

-- Escribe solo el vendedor en su libreta, y solo mientras tenga cuenta de
-- ventas (cualquier estado menos rechazado).
create or replace function public.es_vendedor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.embajadores e
     where e.perfil_id = (select auth.uid()) and e.estado in ('activo', 'pausado')
  );
$$;

revoke all on function public.es_vendedor() from public, anon;
grant execute on function public.es_vendedor() to authenticated;

drop policy if exists prospectos_crea on public.prospectos;
create policy prospectos_crea on public.prospectos
  for insert to authenticated
  with check (embajador_id = (select auth.uid()) and public.es_vendedor());

drop policy if exists prospectos_edita on public.prospectos;
create policy prospectos_edita on public.prospectos
  for update to authenticated
  using (embajador_id = (select auth.uid()))
  with check (embajador_id = (select auth.uid()) and public.es_vendedor());

drop policy if exists prospectos_borra on public.prospectos;
create policy prospectos_borra on public.prospectos
  for delete to authenticated
  using (embajador_id = (select auth.uid()));

create or replace function public.tocar_prospecto()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;

drop trigger if exists al_editar_prospecto on public.prospectos;
create trigger al_editar_prospecto
  before update on public.prospectos
  for each row execute function public.tocar_prospecto();
