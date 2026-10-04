-- Basico gratis para siempre, y el convenio del Festival del Chocolate.
--
-- El modelo cambia de "pagas por aparecer" a "aparecer es gratis; pagas por lo
-- que el Basico no tiene". El problema era el orden: un negocio paga por gente
-- que lo vea, y una guia nueva todavia no la tiene. Cada negocio gratis es
-- contenido que atrae visitantes, y ocultarlo por no pagar seria tirar justo lo
-- que hace que valga la pena pagar.
--
--   Basico   gratis   directorio, micrositio, catalogo y contacto
--   Plus     $199     + resenas
--   Premier  $299     + eventos, noticias y banner principal
--
-- **Nadie se oculta por no pagar.** Una prueba que vence sin pago baja la
-- sucursal a Basico (`vencer_pruebas`, cada noche): sigue en el directorio con
-- todo su contenido, solo sin lo que era de pago.
--
-- El convenio con la Secretaria de Turismo: quien publique con el codigo
-- FESTIVALCHOCOLATE durante octubre y noviembre de 2026 tiene Premier gratis
-- hasta el 31 de diciembre, para tenerlo durante el Festival. El 1 de enero, si
-- no pago, baja a Basico como cualquier otra prueba.
--
-- Es un solo codigo para todos y lo acota la fecha. Se valoro un codigo por
-- negocio y se descarto: repartir cientos de codigos distintos era lo dificil,
-- y uno que vence deja de circular solo.

-- ---------------------------------------------------------------------------
-- Basico gratis
-- ---------------------------------------------------------------------------

update public.tiers set precio_mensual = 0
 where id = (select id from public.tiers order by precio_mensual limit 1);

-- Las que ya estaban en Basico dejan de pagar, y una prueba de algo gratis no
-- tiene nada que probar: pasan a activas.
update public.suscripciones
   set monto_mensual = 0,
       estado = case when estado = 'trial' then 'activo'::public.estado_suscripcion else estado end,
       fecha_fin_trial = case when estado = 'trial' then null else fecha_fin_trial end
 where tier_id = (select id from public.tiers order by precio_mensual limit 1)
   and estado in ('trial', 'activo', 'pausado_por_pago');

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
  id                    uuid primary key default gen_random_uuid(),
  codigo                text not null unique
                        check (codigo = public.normalizar_codigo(codigo) and codigo <> ''),
  descripcion           text not null,
  vigente_desde         date not null,
  vigente_hasta         date not null,
  premier_gratis_hasta  date not null,
  creado_en             timestamptz not null default now(),
  check (vigente_hasta >= vigente_desde),
  check (premier_gratis_hasta >= vigente_hasta)
);

comment on table public.convenios is
  'Codigos de convenio: Premier gratis hasta una fecha para quien publique dentro de su vigencia. Ver migracion 000051.';
comment on column public.convenios.vigente_hasta is
  'Ultimo dia, inclusive y en hora del centro de Mexico, en que el codigo sirve para publicar.';
comment on column public.convenios.premier_gratis_hasta is
  'Ultimo dia de Premier gratis. Al dia siguiente, sin pago, la sucursal baja a Basico.';

alter table public.convenios enable row level security;

-- Solo el administrador lee y escribe la tabla. El negocio canjea por
-- `revisar_convenio`, que no le ensena ningun otro codigo.
drop policy if exists convenios_admin on public.convenios;
create policy convenios_admin on public.convenios
  for all using (public.es_admin()) with check (public.es_admin());

insert into public.convenios (codigo, descripcion, vigente_desde, vigente_hasta, premier_gratis_hasta)
values ('FESTIVALCHOCOLATE', 'Festival del Chocolate 2026, con la Secretaria de Turismo',
        '2026-10-01', '2026-11-30', '2026-12-31')
on conflict (codigo) do nothing;

alter table public.suscripciones
  add column if not exists convenio_id uuid references public.convenios (id) on delete restrict;

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
  v_hoy date := (now() at time zone 'America/Mexico_City')::date;
begin
  select * into v_convenio
    from public.convenios
   where codigo = public.normalizar_codigo(p_codigo);

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

  return v_convenio.id;
end;
$$;

revoke all on function public.revisar_convenio(text) from public, anon;
grant execute on function public.revisar_convenio(text) to authenticated;

-- ---------------------------------------------------------------------------
-- El precio y la fecha los pone la base, no el formulario
-- ---------------------------------------------------------------------------
--
-- Igual que en `cobrar_canje`: si vinieran de fuera, cualquiera podria poner un
-- `convenio_id` y elegir cuanto pagar o hasta cuando. Al abrir la suscripcion se
-- exige que el codigo este vigente ese dia; despues se respeta aunque venza,
-- porque lo prometido ya se prometio. Mientras dure, el plan es Premier.
create or replace function public.aplicar_precio_de_convenio()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_premier smallint;
  v_hasta date;
begin
  if new.convenio_id is null then
    return new;
  end if;

  -- El plan mas alto, sin escribir su numero: es el que sale en el banner.
  select id into v_premier
    from public.tiers
   where en_banner_principal
   order by precio_mensual desc
   limit 1;

  if tg_op = 'INSERT' then
    if not public.convenio_vigente(new.convenio_id) then
      raise exception 'Ese código de convenio no está vigente.';
    end if;

    select premier_gratis_hasta into v_hasta
      from public.convenios where id = new.convenio_id;

    new.tier_id := v_premier;
    new.monto_mensual := 0;
    new.estado := 'trial';
    -- Medianoche del dia siguiente en el centro de Mexico: el 31 de diciembre
    -- se tiene completo.
    new.fecha_fin_trial := ((v_hasta + 1)::timestamp at time zone 'America/Mexico_City');
    return new;
  end if;

  if new.convenio_id is distinct from old.convenio_id then
    raise exception 'El convenio de una suscripción no se cambia.';
  end if;

  if new.estado = 'trial' and new.tier_id is distinct from v_premier then
    raise exception 'El convenio es del plan Premier y no se puede cambiar mientras dure.';
  end if;

  return new;
end;
$$;

drop trigger if exists al_guardar_precio_de_convenio on public.suscripciones;
create trigger al_guardar_precio_de_convenio
  before insert or update on public.suscripciones
  for each row execute function public.aplicar_precio_de_convenio();

-- ---------------------------------------------------------------------------
-- Una prueba vencida baja a Basico, no se oculta
-- ---------------------------------------------------------------------------
--
-- Se cancela la suscripcion de prueba y se abre otra en Basico, en vez de
-- editarle el plan, por lo mismo que `contratarPlan`: el historial guarda que
-- tuvo y hasta cuando. La sucursal no cambia de estado: sigue publicada.
create or replace function public.vencer_pruebas()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_basico smallint;
  v_vencida record;
  v_cuantas integer := 0;
begin
  select id into v_basico from public.tiers order by precio_mensual limit 1;

  for v_vencida in
    select id, sucursal_id
      from public.suscripciones
     where estado = 'trial'
       and fecha_fin_trial is not null
       and fecha_fin_trial <= now()
       for update
  loop
    update public.suscripciones set estado = 'cancelado' where id = v_vencida.id;

    insert into public.suscripciones
      (sucursal_id, tier_id, monto_mensual, estado, fecha_proximo_cobro)
    values
      (v_vencida.sucursal_id, v_basico, 0, 'activo', now() + interval '1 month');

    update public.sucursales set tier_id = v_basico where id = v_vencida.sucursal_id;

    v_cuantas := v_cuantas + 1;
  end loop;

  return v_cuantas;
end;
$$;

revoke all on function public.vencer_pruebas() from public, anon, authenticated;

comment on function public.vencer_pruebas() is
  'Baja a Basico las sucursales cuya prueba vencio. La corre pg_cron cada noche.';

-- Cada noche a las 00:15 del centro de Mexico (06:15 UTC).
create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule('vencer-pruebas', '15 6 * * *', $$select public.vencer_pruebas()$$);
