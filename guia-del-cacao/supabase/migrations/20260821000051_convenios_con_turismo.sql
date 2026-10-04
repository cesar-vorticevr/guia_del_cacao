-- Convenio con Turismo: Premier a $99 durante tres meses.
--
-- Los negocios del Festival del Chocolate publican en Premier pagando lo del
-- plan Basico. El descuento lo pone la Guia; Turismo pone la convocatoria.
--
-- Es **un solo codigo para todos** (FESTIVALCHOCOLATE) y lo que lo acota es la
-- **fecha**: sirve para publicar durante octubre y noviembre de 2026, que es el
-- tiempo de convocar antes del Festival de diciembre. Se valoro un codigo por
-- negocio y se descarto: repartir cientos de codigos distintos era la parte
-- dificil, y un codigo que vence solo deja de circular por si mismo.
--
-- Quien lo uso se sabe por `suscripciones.convenio_id`: es el numero que se le
-- reporta a la Secretaria.
--
-- Los tres meses a $99 empiezan cuando terminan los quince dias gratis, que son
-- de todos. Despues se paga Premier normal; quien pague los meses 4 a 6 de
-- contado conserva los $99 **una sola vez**. Esa renovacion se cobra cuando
-- haya pasarela; aqui solo queda la fecha en que termina el precio.

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
  id             uuid primary key default gen_random_uuid(),
  codigo         text not null unique
                 check (codigo = public.normalizar_codigo(codigo) and codigo <> ''),
  descripcion    text not null,
  vigente_desde  date not null,
  vigente_hasta  date not null,
  creado_en      timestamptz not null default now(),
  check (vigente_hasta >= vigente_desde)
);

comment on table public.convenios is
  'Codigos de convenio: Premier a $99 tres meses para quien publique dentro de sus fechas. Ver migracion 000051.';
comment on column public.convenios.vigente_hasta is
  'Ultimo dia, inclusive, en hora del centro de Mexico, en que el codigo sirve para publicar.';

alter table public.convenios enable row level security;

-- Solo el administrador lee y escribe la tabla. El negocio canjea por
-- `revisar_convenio`, que no le ensena ningun otro codigo.
drop policy if exists convenios_admin on public.convenios;
create policy convenios_admin on public.convenios
  for all using (public.es_admin()) with check (public.es_admin());

insert into public.convenios (codigo, descripcion, vigente_desde, vigente_hasta)
values ('FESTIVALCHOCOLATE', 'Festival del Chocolate 2026, con la Secretaria de Turismo',
        '2026-10-01', '2026-11-30')
on conflict (codigo) do nothing;

-- ---------------------------------------------------------------------------
-- La suscripcion recuerda de que convenio salio
-- ---------------------------------------------------------------------------

alter table public.suscripciones
  add column if not exists convenio_id uuid references public.convenios (id) on delete restrict,
  add column if not exists precio_convenio_hasta timestamptz;

comment on column public.suscripciones.precio_convenio_hasta is
  'Hasta cuando se cobra el precio de convenio. Se fija al publicar: fin de la prueba + 3 meses.';

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

-- Devuelve el convenio si sirve hoy, o explica por que no.
create or replace function public.revisar_convenio(p_codigo text)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_convenio public.convenios%rowtype;
begin
  select * into v_convenio
    from public.convenios
   where codigo = public.normalizar_codigo(p_codigo);

  if not found then
    raise exception 'Ese código no existe. Revisa que esté bien escrito.';
  end if;

  if (now() at time zone 'America/Mexico_City')::date < v_convenio.vigente_desde then
    raise exception 'Ese código todavía no está vigente. Sirve a partir del %.',
      to_char(v_convenio.vigente_desde, 'DD/MM/YYYY');
  end if;

  if (now() at time zone 'America/Mexico_City')::date > v_convenio.vigente_hasta then
    raise exception 'Ese código ya venció: sirvió hasta el %.',
      to_char(v_convenio.vigente_hasta, 'DD/MM/YYYY');
  end if;

  return v_convenio.id;
end;
$$;

revoke all on function public.revisar_convenio(text) from public, anon;
grant execute on function public.revisar_convenio(text) to authenticated;

-- ---------------------------------------------------------------------------
-- El precio lo pone la base, no el formulario
-- ---------------------------------------------------------------------------
--
-- Igual que en `cobrar_canje`: si el monto viniera de fuera, cualquiera podria
-- poner un `convenio_id` y elegir cuanto pagar. Al abrir la suscripcion se
-- exige que el codigo este vigente ese dia; despues se respeta aunque venza,
-- porque los tres meses ya se prometieron. Mientras dure, el plan es Premier.
create or replace function public.aplicar_precio_de_convenio()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_premier smallint;
begin
  if new.convenio_id is null then
    return new;
  end if;

  if tg_op = 'INSERT' or new.convenio_id is distinct from old.convenio_id then
    if not public.convenio_vigente(new.convenio_id) then
      raise exception 'Ese código de convenio no está vigente.';
    end if;
  end if;

  -- El plan mas alto, sin escribir su numero: es el que sale en el banner.
  select id into v_premier
    from public.tiers
   where en_banner_principal
   order by precio_mensual desc
   limit 1;

  if new.tier_id is distinct from v_premier then
    raise exception 'El convenio con Turismo es del plan Premier y no se puede cambiar mientras dure.';
  end if;

  new.monto_mensual := 99.00;
  return new;
end;
$$;

drop trigger if exists al_guardar_precio_de_convenio on public.suscripciones;
create trigger al_guardar_precio_de_convenio
  before insert or update on public.suscripciones
  for each row execute function public.aplicar_precio_de_convenio();

-- ---------------------------------------------------------------------------
-- Al publicar: arranca la prueba y, si hay convenio, sus tres meses
-- ---------------------------------------------------------------------------
create or replace function public.arrancar_prueba_al_aprobar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.estado = 'publicado' and old.estado is distinct from 'publicado' then
    update public.suscripciones
       set fecha_fin_trial = now() + interval '15 days',
           precio_convenio_hasta = case
             when convenio_id is not null
             then now() + interval '15 days' + interval '3 months'
           end
     where sucursal_id = new.id
       and estado = 'trial'
       and fecha_fin_trial is null;
  end if;

  return new;
end;
$$;
