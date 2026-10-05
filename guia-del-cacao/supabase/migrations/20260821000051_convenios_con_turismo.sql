-- Precios, pago anual y convenios con descuento.
--
--   Plan      Mensual   Anual (-20%)
--   Basico    $99       $950
--   Plus      $199      $1,910
--   Premier   $299      $2,870
--
-- **El precio lo calcula la base** (`precio_de_suscripcion`, en un trigger de
-- insert), no el formulario: hasta aqui `monto_mensual` lo mandaba la
-- aplicacion y un negocio podia abrir su suscripcion con el monto que quisiera.
-- La pantalla repite la cuenta en `lib/precios.ts` solo para ensenarla antes de
-- confirmar; si las dos se separan, manda esta.
--
-- Un **convenio** se activa con un codigo al contratar. El primero es el de la
-- Secretaria de Turismo para el Festival del Chocolate (FESTIVALCHOCOLATE):
-- quien publique en octubre o noviembre de 2026 tiene el Basico gratis hasta el
-- 30 de noviembre, y Plus y Premier con 20% de descuento mientras siga pagando.
-- El descuento del convenio y el del pago anual **no se suman**: se aplica uno.
--
-- **Quien no paga se oculta, no se borra.** Una prueba que vence sin pago pasa
-- a `pausado_por_pago` y la sucursal sale del directorio (`vencer_pruebas`,
-- cada noche). Su contenido se queda y vuelve en cuanto pague.

-- ---------------------------------------------------------------------------
-- Los codigos
-- ---------------------------------------------------------------------------

-- Se guardan y se comparan sin espacios, guiones ni minusculas: se dictan en
-- voz alta en un taller y cada quien los escribe a su manera.
create or replace function public.normalizar_codigo(p_codigo text)
returns text
language sql
immutable
set search_path = ''
as $$
  select upper(regexp_replace(coalesce(p_codigo, ''), '[^A-Za-z0-9]', '', 'g'));
$$;

create table if not exists public.convenios (
  id                   uuid primary key default gen_random_uuid(),
  codigo               text not null unique
                       check (codigo = public.normalizar_codigo(codigo) and codigo <> ''),
  descripcion          text not null,
  vigente_desde        date not null,
  vigente_hasta        date not null,
  basico_gratis_hasta  date,
  descuento            smallint not null default 0 check (descuento between 0 and 100),
  creado_en            timestamptz not null default now(),
  check (vigente_hasta >= vigente_desde)
);

comment on table public.convenios is
  'Codigos de convenio: Basico gratis hasta una fecha y descuento en los planes de pago. Ver migracion 000051.';
comment on column public.convenios.vigente_hasta is
  'Ultimo dia, inclusive y en hora del centro de Mexico, en que el codigo sirve para contratar.';
comment on column public.convenios.basico_gratis_hasta is
  'Ultimo dia de Basico gratis. Al dia siguiente, sin pago, la sucursal se oculta.';
comment on column public.convenios.descuento is
  'Porcentaje sobre Plus y Premier mientras se siga pagando. No se suma al del pago anual.';

alter table public.convenios enable row level security;

-- Solo el administrador lee y escribe la tabla. El negocio consulta un codigo
-- por `revisar_convenio`, que no le ensena ningun otro.
drop policy if exists convenios_admin on public.convenios;
create policy convenios_admin on public.convenios
  for all using (public.es_admin()) with check (public.es_admin());

insert into public.convenios
  (codigo, descripcion, vigente_desde, vigente_hasta, basico_gratis_hasta, descuento)
values
  ('FESTIVALCHOCOLATE', 'Festival del Chocolate 2026, con la Secretaría de Turismo',
   '2026-10-01', '2026-11-30', '2026-11-30', 20)
on conflict (codigo) do nothing;

-- ---------------------------------------------------------------------------
-- La suscripcion: periodo, monto por cobro y convenio
-- ---------------------------------------------------------------------------

alter table public.suscripciones
  add column if not exists convenio_id uuid references public.convenios (id) on delete restrict,
  add column if not exists periodo text not null default 'mensual'
    check (periodo in ('mensual', 'anual')),
  add column if not exists monto_por_cobro numeric(10,2);

comment on column public.suscripciones.monto_mensual is
  'Lo que equivale al mes. En anual, el monto del ano entre doce. Lo calcula precio_de_suscripcion.';
comment on column public.suscripciones.monto_por_cobro is
  'Lo que se cobra cada periodo: el mes, o el ano entero. Lo calcula precio_de_suscripcion.';

-- Las que ya existian son mensuales: lo que se cobra es su mensualidad.
update public.suscripciones set monto_por_cobro = monto_mensual where monto_por_cobro is null;

-- ---------------------------------------------------------------------------
-- Revisar un codigo
-- ---------------------------------------------------------------------------

create or replace function public.convenio_vigente(p_convenio uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.convenios
     where id = p_convenio
       and (now() at time zone 'America/Mexico_City')::date
           between vigente_desde and vigente_hasta
  );
$$;

-- Lo que ofrece un codigo vigente, o por que no sirve. Es lo que la pantalla
-- consulta para ensenar los precios de la oferta antes de contratar.
create or replace function public.revisar_convenio(p_codigo text)
returns table (id uuid, descripcion text, basico_gratis_hasta date, descuento smallint)
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
           v_convenio.basico_gratis_hasta, v_convenio.descuento;
end;
$$;

revoke all on function public.revisar_convenio(text) from public, anon;
grant execute on function public.revisar_convenio(text) to authenticated;

-- ---------------------------------------------------------------------------
-- El precio
-- ---------------------------------------------------------------------------
--
-- Fija tier, monto y, si toca, la prueba. Mandar cualquiera de esos datos
-- desde fuera no sirve de nada: se sobrescriben aqui.
create or replace function public.precio_de_suscripcion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_basico smallint;
  v_precio numeric;
  v_convenio public.convenios%rowtype;
  v_descuento numeric := 0;
  v_hoy date := (now() at time zone 'America/Mexico_City')::date;
begin
  select id into v_basico from public.tiers order by precio_mensual limit 1;
  select precio_mensual into v_precio from public.tiers where id = new.tier_id;

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

    -- Basico gratis: hasta la fecha del convenio, con una prueba que vence ese
    -- dia a medianoche del centro de Mexico.
    if new.tier_id = v_basico
       and v_convenio.basico_gratis_hasta is not null
       and v_hoy <= v_convenio.basico_gratis_hasta then
      new.monto_mensual := 0;
      new.monto_por_cobro := 0;
      new.estado := 'trial';
      new.fecha_fin_trial :=
        ((v_convenio.basico_gratis_hasta + 1)::timestamp at time zone 'America/Mexico_City');
      return new;
    end if;

    if new.tier_id <> v_basico then
      v_descuento := v_convenio.descuento;
    end if;
  end if;

  -- Una prueba de pago dura quince dias como mucho. Sin esto, quien tiene el
  -- Basico gratis hasta noviembre se pasaba a Premier y lo tenia gratis igual.
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

drop trigger if exists al_guardar_precio_de_convenio on public.suscripciones;
drop trigger if exists al_abrir_precio_de_suscripcion on public.suscripciones;
create trigger al_abrir_precio_de_suscripcion
  before insert on public.suscripciones
  for each row execute function public.precio_de_suscripcion();

-- Despues de abierta, ni el precio ni el convenio se tocan desde fuera:
-- cambiar de plan es cancelar y abrir otra (asi lo hace `contratarPlan`), y el
-- historial guarda que se pago y hasta cuando.
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
     or new.convenio_id is distinct from old.convenio_id
     or new.periodo is distinct from old.periodo
     or new.tier_id is distinct from old.tier_id then
    raise exception 'El plan y su precio no se cambian así: hay que contratar de nuevo.';
  end if;

  return new;
end;
$$;

drop trigger if exists al_editar_proteger_precio on public.suscripciones;
create trigger al_editar_proteger_precio
  before update on public.suscripciones
  for each row execute function public.proteger_precio_de_suscripcion();

-- ---------------------------------------------------------------------------
-- Quien no paga se oculta
-- ---------------------------------------------------------------------------
--
-- Una prueba que vence sin pago pasa a `pausado_por_pago` y la sucursal a
-- `pausado`, fuera del directorio. No se borra nada. El negocio no puede
-- reactivarla por su cuenta: `proteger_estado_sucursal` pide un plan en
-- `trial` o `activo` para volver a `publicado`, y esta ya no lo tiene.
create or replace function public.vencer_pruebas()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_vencida record;
  v_cuantas integer := 0;
begin
  for v_vencida in
    select id, sucursal_id
      from public.suscripciones
     where estado = 'trial'
       and fecha_fin_trial is not null
       and fecha_fin_trial <= now()
       for update
  loop
    update public.suscripciones set estado = 'pausado_por_pago' where id = v_vencida.id;

    update public.sucursales
       set estado = 'pausado'
     where id = v_vencida.sucursal_id and estado = 'publicado';

    v_cuantas := v_cuantas + 1;
  end loop;

  return v_cuantas;
end;
$$;

revoke all on function public.vencer_pruebas() from public, anon, authenticated;

comment on function public.vencer_pruebas() is
  'Oculta las sucursales cuya prueba vencio sin pago. Se programara en pg_cron cuando haya pasarela de pago.';

-- **Todavia no se programa.** Mientras no haya pasarela de pago nadie puede
-- pagar, y ocultar a quien no pago seria sacar del directorio a todos a los
-- quince dias. El dia que el cobro funcione, una migracion nueva la programa:
--
--   create extension if not exists pg_cron with schema pg_catalog;
--   select cron.schedule('vencer-pruebas', '15 6 * * *', $select public.vencer_pruebas()$);
--
-- (00:15 del centro de Mexico, 06:15 UTC.)

-- ---------------------------------------------------------------------------
-- El convenio de una sucursal, para su duena
-- ---------------------------------------------------------------------------
--
-- `convenios` solo la lee el administrador. Esta da a la duena lo que necesita
-- para ver sus precios al cambiar de plan: que convenio tiene y que le da.
create or replace function public.convenio_de_sucursal(p_sucursal uuid)
returns table (codigo text, descripcion text, basico_gratis_hasta date, descuento smallint)
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
    select c.codigo, c.descripcion, c.basico_gratis_hasta, c.descuento
      from public.suscripciones s
      join public.convenios c on c.id = s.convenio_id
     where s.sucursal_id = p_sucursal
     order by s.fecha_inicio desc
     limit 1;
end;
$$;

revoke all on function public.convenio_de_sucursal(uuid) from public, anon;
grant execute on function public.convenio_de_sucursal(uuid) to authenticated;
