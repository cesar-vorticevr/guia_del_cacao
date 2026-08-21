-- Guía del Cacao — reglas de negocio
--
-- Las reglas comerciales de spec-tecnica §5 viven aqui, en la base de datos, y
-- no solo en el frontend: un negocio con Tier 1 no puede dar puntos aunque
-- llame al API directamente.
--
-- Nota sobre husos horarios: los topes "por dia" se calculan en la hora local
-- de Tabasco (America/Mexico_City), no en UTC, para que el dia coincida con el
-- dia real de la feria.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.marca_de_sucursal(p_sucursal uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $fn$
  select s.marca_id from public.sucursales s where s.id = p_sucursal;
$fn$;

-- ---------------------------------------------------------------------------
-- Solo el administrador publica o rechaza una sucursal (spec §3.3)
-- ---------------------------------------------------------------------------

create or replace function public.proteger_estado_sucursal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  if new.estado is distinct from old.estado
     and new.estado in ('publicado', 'rechazado')
     and (select auth.uid()) is not null
     and coalesce(
       (select p.rol from public.perfiles p where p.id = (select auth.uid())),
       'cliente'
     ) <> 'admin'
  then
    raise exception 'Solo un administrador puede publicar o rechazar una sucursal';
  end if;

  -- La fecha de publicacion se sella sola la primera vez que se publica.
  if new.estado = 'publicado' and old.estado <> 'publicado' then
    new.fecha_publicacion := coalesce(new.fecha_publicacion, now());
  end if;

  return new;
end;
$fn$;

create trigger al_cambiar_estado_sucursal
  before update on public.sucursales
  for each row execute function public.proteger_estado_sucursal();

-- ---------------------------------------------------------------------------
-- Contenido reservado al Tier 3 (spec §5.3)
-- ---------------------------------------------------------------------------

create or replace function public.exigir_tier_contenido()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  permitido boolean;
begin
  select coalesce(t.puede_publicar_contenido, false)
    into permitido
    from public.sucursales s
    left join public.tiers t on t.id = s.tier_id
   where s.id = new.sucursal_id;

  if not permitido then
    raise exception 'Solo las sucursales Tier 3 pueden publicar eventos y noticias';
  end if;

  return new;
end;
$fn$;

create trigger exigir_tier_en_eventos
  before insert or update on public.eventos
  for each row execute function public.exigir_tier_contenido();

create trigger exigir_tier_en_noticias
  before insert or update on public.noticias
  for each row execute function public.exigir_tier_contenido();

-- ---------------------------------------------------------------------------
-- Banner rotativo reservado al Tier 3 (spec §5.2)
-- ---------------------------------------------------------------------------

create or replace function public.exigir_tier_banner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  permitido boolean;
begin
  select coalesce(t.en_banner_principal, false)
    into permitido
    from public.sucursales s
    left join public.tiers t on t.id = s.tier_id
   where s.id = new.sucursal_id;

  if not permitido then
    raise exception 'Solo las sucursales Tier 3 aparecen en el banner principal';
  end if;

  return new;
end;
$fn$;

create trigger exigir_tier_en_banners
  before insert or update on public.banners
  for each row execute function public.exigir_tier_banner();

-- ---------------------------------------------------------------------------
-- Maximo 1 evento activo por semana por marca (spec §5.3)
-- ---------------------------------------------------------------------------

create or replace function public.limitar_evento_semanal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  ya_hay integer;
begin
  select count(*)
    into ya_hay
    from public.eventos e
    join public.sucursales s on s.id = e.sucursal_id
   where s.marca_id = public.marca_de_sucursal(new.sucursal_id)
     and e.id <> new.id
     and to_char(e.fecha_evento, 'IYYY-IW') = to_char(new.fecha_evento, 'IYYY-IW');

  if ya_hay > 0 then
    raise exception 'Esta marca ya tiene un evento en esa semana (maximo 1 por semana)';
  end if;

  return new;
end;
$fn$;

create trigger limitar_eventos_por_semana
  after insert or update on public.eventos
  for each row execute function public.limitar_evento_semanal();

-- ---------------------------------------------------------------------------
-- Pasaporte de puntos (spec §5.4)
-- ---------------------------------------------------------------------------

-- Al pedir puntos: la sucursal debe estar publicada y su tier debe permitirlo.
create or replace function public.validar_solicitud_puntos()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  s_estado public.estado_sucursal;
  s_da_puntos boolean;
begin
  select s.estado, coalesce(t.puede_dar_puntos, false)
    into s_estado, s_da_puntos
    from public.sucursales s
    left join public.tiers t on t.id = s.tier_id
   where s.id = new.sucursal_id;

  if s_estado is distinct from 'publicado' then
    raise exception 'La sucursal no esta publicada';
  end if;

  if not s_da_puntos then
    raise exception 'Esta sucursal no otorga puntos (requiere Tier 2 o superior)';
  end if;

  return new;
end;
$fn$;

create trigger validar_solicitud_al_crear
  before insert on public.solicitudes_puntos
  for each row execute function public.validar_solicitud_puntos();

-- Al aprobar: se respeta el tope diario por marca y se recalcula el rango.
create or replace function public.acreditar_puntos()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  marca uuid := public.marca_de_sucursal(new.sucursal_id);
  dia date := (new.fecha_resolucion at time zone 'America/Mexico_City')::date;
  ya_otorgados integer;
  anio_actual smallint := extract(year from (new.fecha_resolucion at time zone 'America/Mexico_City'))::smallint;
  total integer;
begin
  if new.estado <> 'aprobada' or old.estado = 'aprobada' then
    return new;
  end if;

  -- Tope §5.4.6: 3 puntos por persona, por marca, por dia.
  select coalesce(sum(sp.puntos_otorgados), 0)
    into ya_otorgados
    from public.solicitudes_puntos sp
    join public.sucursales s on s.id = sp.sucursal_id
   where sp.usuario_id = new.usuario_id
     and s.marca_id = marca
     and sp.estado = 'aprobada'
     and sp.id <> new.id
     and (sp.fecha_resolucion at time zone 'America/Mexico_City')::date = dia;

  if ya_otorgados + new.puntos_otorgados > 3 then
    raise exception 'Tope alcanzado: maximo 3 puntos por persona, por marca, por dia (ya lleva %)', ya_otorgados;
  end if;

  insert into public.rangos_usuario (usuario_id, anio, puntos_acumulados, rango_actual)
  values (new.usuario_id, anio_actual, new.puntos_otorgados, public.calcular_rango(new.puntos_otorgados))
  on conflict (usuario_id, anio) do update
    set puntos_acumulados = public.rangos_usuario.puntos_acumulados + excluded.puntos_acumulados
  returning puntos_acumulados into total;

  update public.rangos_usuario
     set rango_actual = public.calcular_rango(total)
   where usuario_id = new.usuario_id
     and anio = anio_actual;

  return new;
end;
$fn$;

create trigger acreditar_al_aprobar
  after update on public.solicitudes_puntos
  for each row execute function public.acreditar_puntos();
