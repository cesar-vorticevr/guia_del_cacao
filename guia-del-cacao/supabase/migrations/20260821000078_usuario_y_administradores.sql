-- Cuentas compartidas, fase 1: el @usuario y los administradores de cada marca.
--
-- El plan (noviembre de 2026) es que una cuenta sirva para todo y pueda
-- administrar varios negocios, que un negocio tenga varios administradores y
-- que su dueño pueda ceder la propiedad. Esta fase no cambia nada de lo que se
-- ve ni de quién puede qué: prepara el terreno.
--
-- 1. **@usuario** en `perfiles`: único, en minúsculas, de 3 a 30 letras,
--    números, punto o guion bajo. Se genera solo con el nombre al darse de alta
--    (`usuario_disponible`) y se puede cambiar una vez cada 30 días. Es como se
--    va a buscar a alguien para compartirle un negocio (fase 3).
-- 2. **`administradores_marca`**: quién administra cada marca y con qué papel
--    (`dueno` o `admin`). Hoy cada marca tiene una sola fila, la de su dueño
--    (`marcas.perfil_id`), y un trigger la mantiene así: `perfil_id` sigue siendo
--    el dueño y el código que lo lee no cambia.
-- 3. **`posee_marca` y `posee_sucursal` preguntan por la lista**, no por
--    `perfil_id`. Como hoy solo está el dueño, dan lo mismo que antes; cuando
--    haya administradores, las más de cien políticas que se apoyan en ellas los
--    dejarán editar sin tocarlas una por una. Lo que solo puede el dueño
--    (pagar, borrar, ceder) se separa en la fase 3 con `es_dueno_de_marca`.
--
-- `administradores_marca.perfil_id` apunta a `auth.users` y no a `perfiles`:
-- con dos llaves (a marcas y a perfiles) PostgREST la leería como un camino más
-- entre las dos tablas y cada embed de `perfiles` desde `marcas` daría PGRST201.
-- Es el mismo tropiezo que ya cuenta AGENTS.md.

-- ---------------------------------------------------------------------------
-- 1. @usuario
-- ---------------------------------------------------------------------------

alter table public.perfiles
  add column if not exists usuario text,
  add column if not exists usuario_cambiado_en timestamptz;

comment on column public.perfiles.usuario is
  'El @usuario, sin la arroba. Único. Se genera solo al darse de alta. Ver migración 000078.';

/**
 * Convierte un nombre en un @usuario libre: sin acentos ni espacios, en
 * minúsculas, y con un número al final si ya lo tiene otra cuenta. No lo
 * reserva: quien lo usa lo guarda enseguida y el índice único ataja el empate.
 */
create or replace function public.usuario_disponible(p_base text, p_ignorar uuid default null)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_base text;
  v_intento text;
  v_n integer := 1;
begin
  v_base := lower(translate(coalesce(p_base, ''),
    'ÁÀÄÂÃáàäâãÉÈËÊéèëêÍÌÏÎíìïîÓÒÖÔÕóòöôõÚÙÜÛúùüûÑñÇç',
    'aaaaaaaaaaeeeeeeeeiiiiiiiioooooooooouuuuuuuunncc'));
  v_base := regexp_replace(v_base, '[^a-z0-9]+', '', 'g');
  v_base := left(v_base, 24);
  if length(v_base) < 3 then
    v_base := v_base || 'cacao';
  end if;

  v_intento := v_base;
  while exists (
    select 1 from public.perfiles p
     where p.usuario = v_intento and p.id is distinct from p_ignorar
  ) loop
    v_n := v_n + 1;
    v_intento := v_base || v_n;
  end loop;

  return v_intento;
end;
$$;

-- Los que ya existen reciben el suyo, por orden de llegada: quien se registró
-- primero se queda con el nombre sin número.
do $$
declare
  p record;
begin
  for p in select id, nombre, correo from public.perfiles where usuario is null order by fecha_registro, id loop
    update public.perfiles
       set usuario = public.usuario_disponible(
             coalesce(nullif(p.nombre, ''), split_part(p.correo, '@', 1)), p.id)
     where id = p.id;
  end loop;
end;
$$;

alter table public.perfiles
  alter column usuario set not null,
  drop constraint if exists perfiles_usuario_formato,
  add constraint perfiles_usuario_formato check (usuario ~ '^[a-z0-9._]{3,30}$');

create unique index if not exists perfiles_usuario_unico on public.perfiles (usuario);

/**
 * Al darse de alta se genera; al cambiarlo, se limpia (sin arroba, en
 * minúsculas) y se cuida que no sea más de una vez cada 30 días: quien ya le
 * compartió un negocio a @alguien no debe encontrarse con que ese nombre ahora
 * es de otra persona a la semana. El administrador lo cambia sin esperar.
 */
create or replace function public.preparar_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.usuario is null or new.usuario = '' then
      new.usuario := public.usuario_disponible(
        coalesce(nullif(new.nombre, ''), split_part(new.correo, '@', 1)), new.id);
    end if;
    return new;
  end if;

  if new.usuario is distinct from old.usuario then
    new.usuario := lower(btrim(ltrim(btrim(new.usuario), '@')));

    if new.usuario = old.usuario then
      return new;
    end if;

    if not public.es_admin()
       and old.usuario_cambiado_en is not null
       and old.usuario_cambiado_en > now() - interval '30 days' then
      raise exception 'Tu @usuario se puede cambiar una vez cada 30 días. El próximo cambio, a partir del %.',
        to_char((old.usuario_cambiado_en + interval '30 days') at time zone 'America/Mexico_City', 'DD/MM/YYYY');
    end if;

    if exists (select 1 from public.perfiles p where p.usuario = new.usuario and p.id <> new.id) then
      raise exception 'Ese @usuario ya lo tiene otra cuenta. Prueba con otro.';
    end if;

    new.usuario_cambiado_en := now();
  end if;

  return new;
end;
$$;

drop trigger if exists al_guardar_preparar_usuario on public.perfiles;
create trigger al_guardar_preparar_usuario
  before insert or update of usuario on public.perfiles
  for each row execute function public.preparar_usuario();

-- El @usuario es público: es con lo que se encuentra a alguien. Va al final de
-- la vista para no mover las columnas que ya leen las demás consultas.
create or replace view public.perfiles_publicos as
  select id, nombre, foto_perfil, usuario from public.perfiles;

-- ---------------------------------------------------------------------------
-- 2. Administradores de cada marca
-- ---------------------------------------------------------------------------

create table if not exists public.administradores_marca (
  marca_id     uuid not null references public.marcas (id) on delete cascade,
  perfil_id    uuid not null references auth.users (id) on delete cascade,
  papel        text not null default 'admin' check (papel in ('dueno', 'admin')),
  agregado_en  timestamptz not null default now(),
  agregado_por uuid references auth.users (id) on delete set null,
  primary key (marca_id, perfil_id)
);

comment on table public.administradores_marca is
  'Quién administra cada marca. Un solo dueño (el de marcas.perfil_id) y los administradores que comparta. Ver migración 000078.';

create unique index if not exists administradores_marca_un_dueno
  on public.administradores_marca (marca_id) where papel = 'dueno';
create index if not exists administradores_marca_perfil_idx
  on public.administradores_marca (perfil_id);

insert into public.administradores_marca (marca_id, perfil_id, papel, agregado_en)
select m.id, m.perfil_id, 'dueno', m.fecha_registro
  from public.marcas m
on conflict (marca_id, perfil_id) do update set papel = 'dueno';

/**
 * La fila del dueño sigue a `marcas.perfil_id`: al crear la marca se anota, y
 * si el dueño cambia, el anterior se queda como administrador. Así el código
 * que todavía lee `perfil_id` y la lista nunca se contradicen.
 */
create or replace function public.anotar_dueno_de_marca()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.perfil_id is not distinct from old.perfil_id then
      return new;
    end if;
    update public.administradores_marca
       set papel = 'admin'
     where marca_id = new.id and papel = 'dueno';
  end if;

  insert into public.administradores_marca (marca_id, perfil_id, papel, agregado_por)
  values (new.id, new.perfil_id, 'dueno', (select auth.uid()))
  on conflict (marca_id, perfil_id) do update set papel = 'dueno';

  return new;
end;
$$;

drop trigger if exists al_guardar_anotar_dueno on public.marcas;
create trigger al_guardar_anotar_dueno
  after insert or update of perfil_id on public.marcas
  for each row execute function public.anotar_dueno_de_marca();

alter table public.administradores_marca enable row level security;

-- Cada quien ve las marcas que administra y a sus compañeros de esas marcas.
-- No hay políticas de escritura: compartir y ceder van por funciones (fase 3).
drop policy if exists administradores_marca_lectura on public.administradores_marca;
create policy administradores_marca_lectura on public.administradores_marca
  for select to authenticated
  using (perfil_id = (select auth.uid()) or public.posee_marca(marca_id) or public.es_admin());

revoke all on public.administradores_marca from anon, authenticated;
grant select on public.administradores_marca to authenticated;

-- ---------------------------------------------------------------------------
-- 3. «Puede editar este negocio» pregunta por la lista
-- ---------------------------------------------------------------------------

create or replace function public.posee_marca(p_marca uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select exists (
    select 1 from public.administradores_marca a
     where a.marca_id = p_marca
       and a.perfil_id = (select auth.uid())
  );
$fn$;

create or replace function public.posee_sucursal(p_sucursal uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select exists (
    select 1
      from public.sucursales s
      join public.administradores_marca a on a.marca_id = s.marca_id
     where s.id = p_sucursal
       and a.perfil_id = (select auth.uid())
  );
$fn$;

/** Solo el dueño: pagar, borrar el negocio, ceder y compartir (fase 3). */
create or replace function public.es_dueno_de_marca(p_marca uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select exists (
    select 1 from public.administradores_marca a
     where a.marca_id = p_marca
       and a.perfil_id = (select auth.uid())
       and a.papel = 'dueno'
  );
$fn$;

/** Las marcas que administra quien pregunta, con su papel: el selector de la fase 2. */
create or replace function public.mis_marcas()
returns table (marca_id uuid, nombre_comercial text, papel text)
language sql
stable
security definer
set search_path = ''
as $fn$
  select m.id, m.nombre_comercial, a.papel
    from public.administradores_marca a
    join public.marcas m on m.id = a.marca_id
   where a.perfil_id = (select auth.uid())
   order by a.papel = 'dueno' desc, m.nombre_comercial;
$fn$;

revoke all on function public.mis_marcas() from public, anon;
grant execute on function public.mis_marcas() to authenticated;

-- Subir fotos al micrositio, al catálogo y a las experiencias también lo puede
-- quien administra la marca, no solo su dueño. Se reescribe la definición
-- vigente cambiando solo la comparación con el dueño.
do $$
declare
  v_def text;
begin
  foreach v_def in array array[
    pg_get_functiondef('public.puede_escribir_en_micrositio(text)'::regprocedure),
    pg_get_functiondef('public.puede_escribir_en_experiencia(text)'::regprocedure)
  ] loop
    execute replace(v_def, 'm.perfil_id = (select auth.uid())', 'public.posee_marca(m.id)');
  end loop;
end;
$$;
