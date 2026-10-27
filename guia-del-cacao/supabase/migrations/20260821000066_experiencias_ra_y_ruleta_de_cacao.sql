-- Experiencias de realidad aumentada (powered by Vortice VR) y la ruleta de
-- cacao para quien ya gano.
--
-- 1. Experiencias. Un negocio sube una imagen (su tarjeta, su empaque, su
--    cartel) y le pone encima videos, imagenes, textos y links; quien la
--    enfoca con el celular la ve cobrar vida. Es el visor y el editor de
--    vorticevr.mx portados a la Guia.
--
--    - **Cualquiera arma, solo Pro publica.** Gratis crea y edita sus
--      experiencias igual que Pro; publicarlas pide un plan con
--      `tiers.experiencias_ra` (Pro: 3). Lo exige `exigir_cupo_de_experiencias`.
--    - **El cupo es de la marca**, no de la sucursal: el plan mas alto vigente
--      de sus sucursales mas `marcas.experiencias_extra`, que se compran de una
--      en una con un pago unico ($499) y no cambian la mensualidad.
--    - **Lo que se ve se deriva del plan de hoy**, como los eventos: al bajar
--      de plan las experiencias no se tocan, el visor deja de enseñarlas
--      (`experiencia_publica`), y al volver regresan. Si el cupo baja, se ven
--      las publicadas mas recientes que quepan.
--    - Los extras solo los suma el webhook de Stripe (o el cobro simulado con
--      la llave de servicio) por `sumar_experiencia_extra`, con la referencia
--      del pago para no sumar dos veces el mismo.
--
-- 2. Ruleta. Gratis tambien arma y guarda su ruleta (no sale en publico sin
--    Pro, como antes). Y en una ruleta sin limite, quien tiene un premio
--    vigente sin canjear ya no gira de verdad: gira la de cacao, que no da nada.

-- ---------------------------------------------------------------------------
-- 1. Experiencias
-- ---------------------------------------------------------------------------

alter table public.tiers
  add column if not exists experiencias_ra smallint not null default 0
    check (experiencias_ra >= 0);

comment on column public.tiers.experiencias_ra is
  'Cuantas experiencias de realidad aumentada publica una marca con este plan. Ver migracion 000066.';

update public.tiers set experiencias_ra = 3 where id = 3;

alter table public.marcas
  add column if not exists experiencias_extra smallint not null default 0
    check (experiencias_extra between 0 and 500);

comment on column public.marcas.experiencias_extra is
  'Experiencias compradas aparte, con un pago unico cada una. Solo las suma sumar_experiencia_extra.';

-- La marca no se regala experiencias: el numero lo pone el pago.
create or replace function public.proteger_experiencias_extra()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.experiencias_extra is distinct from old.experiencias_extra
     and coalesce(current_setting('guia.sumando_extra', true), '') <> 'si'
     and (select auth.uid()) is not null
     and not public.es_admin() then
    raise exception 'Las experiencias extra se suman al pagarlas.';
  end if;
  return new;
end;
$$;

drop trigger if exists al_editar_proteger_extras on public.marcas;
create trigger al_editar_proteger_extras
  before update on public.marcas
  for each row execute function public.proteger_experiencias_extra();

create table if not exists public.experiencias (
  id             uuid primary key default gen_random_uuid(),
  marca_id       uuid not null references public.marcas (id) on delete cascade,
  codigo         text not null unique check (codigo ~ '^[a-z0-9]{6,12}$'),
  titulo         text not null default '' check (char_length(titulo) <= 80),
  estado         text not null default 'borrador' check (estado in ('borrador', 'publicada')),
  -- Rutas dentro del bucket `experiencias`: `{marca}/{experiencia}/{archivo}`.
  imagen         text,
  objetivo       text,
  imagen_ancho   int check (imagen_ancho between 1 and 4000),
  imagen_alto    int check (imagen_alto between 1 and 4000),
  -- Los elementos, con el mismo formato que el editor de Vortice VR
  -- (`assets/escena.js`): {id, type, x, y, z, s, rx, ry, rz, in, file, ...}.
  elementos      jsonb not null default '[]' check (jsonb_typeof(elementos) = 'array'),
  botones        jsonb not null default '{}' check (jsonb_typeof(botones) = 'object'),
  vistas         int not null default 0,
  publicada_en   timestamptz,
  creada_en      timestamptz not null default now(),
  actualizada_en timestamptz not null default now()
);

create index if not exists experiencias_marca_idx on public.experiencias (marca_id, creada_en desc);

comment on table public.experiencias is
  'Experiencias de realidad aumentada sobre imagen (editor y visor de Vortice VR). Ver migracion 000066.';

alter table public.experiencias enable row level security;

-- Solo su duena (y el administrador) las lee directo. El visor publico entra
-- por `experiencia_publica`, que ya decide si se ve.
drop policy if exists experiencias_lectura on public.experiencias;
create policy experiencias_lectura on public.experiencias
  for select to authenticated
  using (public.posee_marca(marca_id) or public.es_admin());

drop policy if exists experiencias_escribe_propias on public.experiencias;
create policy experiencias_escribe_propias on public.experiencias
  for all to authenticated
  using (public.posee_marca(marca_id) or public.es_admin())
  with check (public.posee_marca(marca_id) or public.es_admin());

-- Cuantas experiencias publica hoy una marca: su mejor plan vigente, y si ese
-- plan las trae, las compradas aparte.
create or replace function public.cupo_de_experiencias(p_marca uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  with plan as (
    select coalesce(max(t.experiencias_ra), 0) as base
      from public.sucursales s
      join public.tiers t on t.id = public.plan_de_sucursal(s.id)
     where s.marca_id = p_marca
  )
  select case when plan.base > 0
              then plan.base + coalesce((select m.experiencias_extra from public.marcas m where m.id = p_marca), 0)
              else 0 end
    from plan;
$$;

revoke all on function public.cupo_de_experiencias(uuid) from public, anon;
grant execute on function public.cupo_de_experiencias(uuid) to authenticated;

-- Publicar pide plan, cupo y una experiencia completa. Las vistas solo las
-- cuenta `contar_vista_de_experiencia`.
create or replace function public.exigir_cupo_de_experiencias()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cupo int;
  v_otras int;
begin
  new.actualizada_en := now();

  if tg_op = 'UPDATE' then
    new.marca_id := old.marca_id;
    new.codigo := old.codigo;
    if coalesce(current_setting('guia.contando_vista', true), '') <> 'si' then
      new.vistas := old.vistas;
    end if;
  else
    new.vistas := 0;
  end if;

  if new.estado = 'publicada' and (tg_op = 'INSERT' or old.estado <> 'publicada') then
    if new.imagen is null or new.objetivo is null then
      raise exception 'Sube la imagen de tu experiencia antes de publicarla.';
    end if;
    if jsonb_array_length(new.elementos) = 0 then
      raise exception 'Agrega al menos un video, imagen o texto antes de publicar.';
    end if;

    if not public.es_admin() then
      v_cupo := public.cupo_de_experiencias(new.marca_id);
      if v_cupo = 0 then
        raise exception 'Publicar experiencias viene con el plan Pro.';
      end if;

      select count(*) into v_otras
        from public.experiencias e
       where e.marca_id = new.marca_id and e.estado = 'publicada' and e.id <> new.id;

      if v_otras >= v_cupo then
        raise exception 'Ya tienes publicadas tus % experiencias. Suma una más o pasa otra a borrador.', v_cupo;
      end if;
    end if;

    new.publicada_en := now();
  end if;

  if new.estado = 'borrador' then
    new.publicada_en := null;
  end if;

  return new;
end;
$$;

drop trigger if exists al_guardar_exigir_cupo on public.experiencias;
create trigger al_guardar_exigir_cupo
  before insert or update on public.experiencias
  for each row execute function public.exigir_cupo_de_experiencias();

-- La experiencia que pinta el visor, si hoy se ve: publicada, con plan, y
-- dentro del cupo (las mas recientes primero). Su duena la ve aunque no.
create or replace function public.experiencia_publica(p_codigo text)
returns table (id uuid, marca_id uuid, codigo text, titulo text, imagen text, objetivo text,
               imagen_ancho int, imagen_alto int, elementos jsonb, botones jsonb,
               actualizada_en timestamptz, marca text, logo text, slug text, se_ve boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with e as (
    select x.* from public.experiencias x where x.codigo = lower(p_codigo)
  ),
  orden as (
    select x.id,
           row_number() over (order by x.publicada_en desc nulls last) as n
      from public.experiencias x
     where x.marca_id = (select marca_id from e) and x.estado = 'publicada'
  )
  select e.id, e.marca_id, e.codigo, e.titulo, e.imagen, e.objetivo, e.imagen_ancho, e.imagen_alto,
         e.elementos, e.botones, e.actualizada_en, m.nombre_comercial,
         (select s.logo from public.sucursales s where s.marca_id = e.marca_id and s.logo is not null
           order by s.estado = 'publicado' desc, s.fecha_creacion limit 1),
         (select s.slug from public.sucursales s where s.marca_id = e.marca_id and s.estado = 'publicado'
           order by s.fecha_creacion limit 1),
         e.estado = 'publicada'
           and (select o.n from orden o where o.id = e.id) <= public.cupo_de_experiencias(e.marca_id)
    from e
    join public.marcas m on m.id = e.marca_id
   where (e.estado = 'publicada'
          and (select o.n from orden o where o.id = e.id) <= public.cupo_de_experiencias(e.marca_id))
      or public.posee_marca(e.marca_id)
      or public.es_admin();
$$;

revoke all on function public.experiencia_publica(text) from public;
grant execute on function public.experiencia_publica(text) to anon, authenticated;

-- Una vista mas, la cuenta el visor al abrir la camara. Solo de lo publicado.
create or replace function public.contar_vista_de_experiencia(p_codigo text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform set_config('guia.contando_vista', 'si', true);
  update public.experiencias
     set vistas = vistas + 1
   where codigo = lower(p_codigo) and estado = 'publicada'
     and not public.posee_marca(marca_id);
  perform set_config('guia.contando_vista', '', true);
end;
$$;

revoke all on function public.contar_vista_de_experiencia(text) from public;
grant execute on function public.contar_vista_de_experiencia(text) to anon, authenticated;

-- Las compras de experiencias extra, una fila por pago.
create table if not exists public.compras_de_experiencias (
  id         uuid primary key default gen_random_uuid(),
  marca_id   uuid not null references public.marcas (id) on delete cascade,
  referencia text not null unique,
  monto      numeric(10, 2) not null check (monto >= 0),
  creada_en  timestamptz not null default now()
);

alter table public.compras_de_experiencias enable row level security;

-- La marca ve lo que compro; nadie escribe a mano.
drop policy if exists compras_de_experiencias_lectura on public.compras_de_experiencias;
create policy compras_de_experiencias_lectura on public.compras_de_experiencias
  for select to authenticated
  using (public.posee_marca(marca_id) or public.es_admin());

-- Suma una experiencia pagada. Idempotente por la referencia del pago: Stripe
-- repite sus avisos.
create or replace function public.sumar_experiencia_extra(p_marca uuid, p_referencia text, p_monto numeric)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  insert into public.compras_de_experiencias (marca_id, referencia, monto)
  values (p_marca, p_referencia, p_monto)
  on conflict (referencia) do nothing;

  if not found then
    return false;
  end if;

  perform set_config('guia.sumando_extra', 'si', true);
  update public.marcas set experiencias_extra = experiencias_extra + 1 where id = p_marca;
  perform set_config('guia.sumando_extra', '', true);
  return true;
end;
$$;

revoke all on function public.sumar_experiencia_extra(uuid, text, numeric) from public, anon, authenticated;
grant execute on function public.sumar_experiencia_extra(uuid, text, numeric) to service_role;

-- Archivos: imagen, objetivo (.mind) y lo que va encima. Publico de lectura
-- (el visor los baja sin sesion); escribe solo la duena de la marca de la
-- primera carpeta. 50 MB por archivo: un video de celular comprimido.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'experiencias',
  'experiencias',
  true,
  52428800,
  array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime',
        'application/octet-stream']
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.puede_escribir_en_experiencia(ruta text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select exists (
    select 1 from public.marcas m
     where m.perfil_id = (select auth.uid())
       and m.id::text = (storage.foldername(ruta))[1]
  );
$fn$;

drop policy if exists "experiencias lectura publica" on storage.objects;
create policy "experiencias lectura publica"
  on storage.objects for select
  using (bucket_id = 'experiencias');

drop policy if exists "experiencias alta de la duena" on storage.objects;
create policy "experiencias alta de la duena"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'experiencias' and public.puede_escribir_en_experiencia(name));

drop policy if exists "experiencias cambio de la duena" on storage.objects;
create policy "experiencias cambio de la duena"
  on storage.objects for update to authenticated
  using (bucket_id = 'experiencias' and public.puede_escribir_en_experiencia(name));

drop policy if exists "experiencias borrado de la duena" on storage.objects;
create policy "experiencias borrado de la duena"
  on storage.objects for delete to authenticated
  using (bucket_id = 'experiencias' and public.puede_escribir_en_experiencia(name));

-- ---------------------------------------------------------------------------
-- 2. Ruleta
-- ---------------------------------------------------------------------------

-- Gratis tambien la arma y la guarda. Que se vea y se gire lo sigue decidiendo
-- `sucursal_tiene_ruleta` en `sucursales_con_ruleta` y `girar_ruleta`.
create or replace function public.exigir_plan_con_ruleta()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.actualizada_en := now();
  return new;
end;
$$;

-- Si quien mira tiene un premio de esta ruleta que todavia vale y no ha
-- canjeado.
create or replace function public.tiene_premio_vigente(p_sucursal uuid, p_usuario uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.giros g
     where g.sucursal_id = p_sucursal and g.usuario_id = p_usuario
       and g.codigo is not null and g.canjeado_en is null
       and g.vence_en >= (now() at time zone 'America/Mexico_City')::date
  );
$$;

revoke all on function public.tiene_premio_vigente(uuid, uuid) from public, anon, authenticated;

create or replace function public.mi_giro_en(p_sucursal uuid)
returns table (premio text, es_premio boolean, codigo text, vence_en date,
               canjeado_en timestamptz, creado_en timestamptz, puede_girar boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with ruleta as (
    select r.frecuencia from public.ruletas r where r.sucursal_id = p_sucursal
  ),
  ultimo as (
    select g.* from public.giros g
     where g.sucursal_id = p_sucursal and g.usuario_id = (select auth.uid())
     order by g.creado_en desc
     limit 1
  )
  select u.premio, u.codigo is not null, u.codigo, u.vence_en, u.canjeado_en, u.creado_en,
         case
           when (select frecuencia from ruleta) = 'ilimitada'
             then not public.tiene_premio_vigente(p_sucursal, (select auth.uid()))
           when (select frecuencia from ruleta) = 'una_vez' then false
           else (u.creado_en at time zone 'America/Mexico_City')::date
                <> (now() at time zone 'America/Mexico_City')::date
         end
    from ultimo u;
$$;

revoke all on function public.mi_giro_en(uuid) from public, anon;
grant execute on function public.mi_giro_en(uuid) to authenticated;

-- Girar: igual que en la 000064, y en «sin limite» no se gana otro premio
-- mientras haya uno vigente sin canjear.
create or replace function public.girar_ruleta(p_sucursal uuid)
returns table (gajo smallint, premio text, es_premio boolean, codigo text, vence_en date)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := (select auth.uid());
  v_ruleta public.ruletas%rowtype;
  v_demo boolean;
  v_hoy date := (now() at time zone 'America/Mexico_City')::date;
  v_total numeric;
  v_tiro numeric;
  v_gajo record;
  v_prefijo text;
  v_letras constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_codigo text;
  i int;
begin
  if v_usuario is null then
    raise exception 'Inicia sesión para girar la ruleta.';
  end if;

  if not exists (
    select 1 from public.perfiles p
     where p.id = v_usuario and p.rol_confirmado and p.rol in ('cliente', 'negocio')
  ) then
    raise exception 'Termina de crear tu cuenta para girar la ruleta.';
  end if;

  select coalesce(m.es_demo, false) into v_demo
    from public.sucursales s join public.marcas m on m.id = s.marca_id
   where s.id = p_sucursal;

  if public.posee_sucursal(p_sucursal) and not v_demo then
    raise exception 'Es tu propia ruleta: gira la de otros negocios.';
  end if;

  select * into v_ruleta from public.ruletas r where r.sucursal_id = p_sucursal;
  if not found or not v_ruleta.activa
     or not exists (select 1 from public.sucursales s where s.id = p_sucursal and s.estado = 'publicado')
     or not public.sucursal_tiene_ruleta(p_sucursal) then
    raise exception 'Esta ruleta no está disponible ahora.';
  end if;

  if not v_demo then
    perform pg_advisory_xact_lock(hashtext(v_usuario::text || p_sucursal::text));

    if v_ruleta.frecuencia = 'una_vez' and exists (
      select 1 from public.giros g where g.sucursal_id = p_sucursal and g.usuario_id = v_usuario
    ) then
      raise exception 'Ya giraste esta ruleta: es una vez por persona.';
    end if;

    if v_ruleta.frecuencia = 'diaria' and exists (
      select 1 from public.giros g
       where g.sucursal_id = p_sucursal and g.usuario_id = v_usuario
         and (g.creado_en at time zone 'America/Mexico_City')::date = v_hoy
    ) then
      raise exception 'Ya giraste hoy. ¡Vuelve mañana por otro premio!';
    end if;

    if v_ruleta.frecuencia = 'ilimitada' and public.tiene_premio_vigente(p_sucursal, v_usuario) then
      raise exception 'Ya tienes un premio de esta ruleta. Canjéalo para volver a ganar.';
    end if;
  end if;

  select coalesce(sum(g.probabilidad), 0) into v_total from public.gajos_de_ruleta(p_sucursal) g;
  if v_total <= 0 then
    raise exception 'Esta ruleta no está disponible ahora.';
  end if;

  v_tiro := random() * v_total;
  for v_gajo in
    select g.gajo, g.texto, g.probabilidad, g.es_premio
      from public.gajos_de_ruleta(p_sucursal) g order by g.gajo
  loop
    v_tiro := v_tiro - v_gajo.probabilidad;
    exit when v_tiro < 0;
  end loop;

  if v_demo then
    gajo := v_gajo.gajo;
    premio := v_gajo.texto;
    es_premio := v_gajo.es_premio;
    codigo := case when v_gajo.es_premio then 'DEMO-MUESTRA' end;
    vence_en := case when v_gajo.es_premio then v_hoy + v_ruleta.vigencia_dias end;
    return next;
    return;
  end if;

  if v_gajo.es_premio then
    select left(regexp_replace(upper(translate(coalesce(m.nombre_comercial, 'CACAO'),
             'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN')), '[^A-Z]', '', 'g'), 3)
      into v_prefijo
      from public.sucursales s join public.marcas m on m.id = s.marca_id
     where s.id = p_sucursal;
    if coalesce(v_prefijo, '') = '' then v_prefijo := 'GDC'; end if;

    loop
      v_codigo := v_prefijo || '-';
      for i in 1..5 loop
        v_codigo := v_codigo || substr(v_letras, 1 + floor(random() * length(v_letras))::int, 1);
      end loop;
      exit when not exists (select 1 from public.giros g where g.codigo = v_codigo);
    end loop;
  end if;

  insert into public.giros (sucursal_id, usuario_id, orden, premio, codigo, vence_en)
  values (p_sucursal, v_usuario, v_gajo.gajo, v_gajo.texto, v_codigo,
          case when v_gajo.es_premio then v_hoy + v_ruleta.vigencia_dias end);

  gajo := v_gajo.gajo;
  premio := v_gajo.texto;
  es_premio := v_gajo.es_premio;
  codigo := v_codigo;
  vence_en := case when v_gajo.es_premio then v_hoy + v_ruleta.vigencia_dias end;
  return next;
end;
$$;

revoke all on function public.girar_ruleta(uuid) from public, anon;
grant execute on function public.girar_ruleta(uuid) to authenticated;
