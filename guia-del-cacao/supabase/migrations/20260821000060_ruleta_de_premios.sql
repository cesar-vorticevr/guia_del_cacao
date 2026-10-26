-- La Ruleta Magica de premios, y los negocios de demostracion.
--
-- 1. Ruleta. Un negocio con plan Pro pone hasta tres premios, la probabilidad
--    de cada uno, cada cuanto se puede girar (una vez por persona para
--    siempre, una al dia o sin limite) y cuantos dias vale lo que se gana. Un
--    cliente gira en el micrositio; **el resultado lo decide la base** con
--    `girar_ruleta`, nunca el navegador, y el premio queda guardado con un
--    codigo en «Mis premios». En la sucursal, el negocio lo canjea con
--    `canjear_premio` y queda marcado como usado.
--
--    Tres tablas: `ruletas` (la configuracion, una por sucursal),
--    `premios_ruleta` (los tres premios) y `giros` (lo que gano cada quien). Un
--    giro guarda el texto del premio tal como era: si el negocio cambia sus
--    premios despues, lo ya ganado no cambia.
--
--    `giros.usuario_id` apunta a `auth.users` y no a `perfiles` a proposito:
--    una llave a perfiles abriria otro camino entre tablas que ya tienen uno y
--    PostgREST responderia PGRST201 (el tropiezo que AGENTS.md cuenta cinco
--    veces). Los nombres se leen por funciones `security definer`.
--
-- 2. Demo. `marcas.es_demo` marca un negocio de demostracion: se ensena con su
--    cinta de DEMO y no cuenta en los numeros de la guia. Solo el
--    administrador la pone o la quita.

-- ---------------------------------------------------------------------------
-- 1. Ruleta
-- ---------------------------------------------------------------------------

alter table public.tiers
  add column if not exists permite_ruleta boolean not null default false;

comment on column public.tiers.permite_ruleta is
  'Si el plan trae la Ruleta Magica de premios. Ver migracion 000060.';

update public.tiers set permite_ruleta = true where id = 3;

create table if not exists public.ruletas (
  sucursal_id    uuid primary key references public.sucursales (id) on delete cascade,
  activa         boolean not null default true,
  frecuencia     text not null default 'diaria'
                 check (frecuencia in ('una_vez', 'diaria', 'ilimitada')),
  vigencia_dias  smallint not null default 30 check (vigencia_dias between 1 and 365),
  actualizada_en timestamptz not null default now()
);

create table if not exists public.premios_ruleta (
  id           uuid primary key default gen_random_uuid(),
  sucursal_id  uuid not null references public.ruletas (sucursal_id) on delete cascade,
  orden        smallint not null check (orden between 1 and 3),
  texto        text not null check (char_length(trim(texto)) between 1 and 60),
  probabilidad smallint not null check (probabilidad between 1 and 100),
  unique (sucursal_id, orden)
);

create table if not exists public.giros (
  id          uuid primary key default gen_random_uuid(),
  sucursal_id uuid not null references public.sucursales (id) on delete cascade,
  usuario_id  uuid not null references auth.users (id) on delete cascade,
  orden       smallint not null,
  premio      text not null,
  codigo      text not null unique,
  vence_en    date not null,
  canjeado_en timestamptz,
  creado_en   timestamptz not null default now()
);

create index if not exists giros_usuario_idx on public.giros (usuario_id, creado_en desc);
create index if not exists giros_sucursal_idx on public.giros (sucursal_id, creado_en desc);

comment on table public.giros is
  'Lo que gano cada quien en la Ruleta Magica, con su codigo. Ver migracion 000060.';

alter table public.ruletas enable row level security;
alter table public.premios_ruleta enable row level security;
alter table public.giros enable row level security;

-- La ruleta y sus premios son publicos: se pintan en el micrositio.
drop policy if exists ruletas_lectura on public.ruletas;
create policy ruletas_lectura on public.ruletas
  for select to anon, authenticated using (true);

drop policy if exists ruletas_escribe_propia on public.ruletas;
create policy ruletas_escribe_propia on public.ruletas
  for all to authenticated
  using (public.posee_sucursal(sucursal_id) or public.es_admin())
  with check (public.posee_sucursal(sucursal_id) or public.es_admin());

drop policy if exists premios_lectura on public.premios_ruleta;
create policy premios_lectura on public.premios_ruleta
  for select to anon, authenticated using (true);

drop policy if exists premios_escribe_propios on public.premios_ruleta;
create policy premios_escribe_propios on public.premios_ruleta
  for all to authenticated
  using (public.posee_sucursal(sucursal_id) or public.es_admin())
  with check (public.posee_sucursal(sucursal_id) or public.es_admin());

-- Un giro lo ve quien lo gano, el negocio que lo da y el administrador. Nadie
-- lo escribe a mano: lo crea `girar_ruleta` y lo canjea `canjear_premio`.
drop policy if exists giros_lectura on public.giros;
create policy giros_lectura on public.giros
  for select using (
    usuario_id = (select auth.uid())
    or public.posee_sucursal(sucursal_id)
    or public.es_admin()
  );

-- La ruleta es del plan: sin el, no se arma ni se enciende. Apagarla si se
-- puede siempre, y lo ya ganado sigue valiendo.
create or replace function public.sucursal_tiene_ruleta(p_sucursal uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select t.permite_ruleta from public.tiers t
     where t.id = public.plan_de_sucursal(p_sucursal)
  ), false);
$$;

create or replace function public.exigir_plan_con_ruleta()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.activa and not public.es_admin() and (select auth.uid()) is not null
     and not public.sucursal_tiene_ruleta(new.sucursal_id) then
    raise exception 'La Ruleta Mágica viene con el plan Pro.';
  end if;
  new.actualizada_en := now();
  return new;
end;
$$;

drop trigger if exists al_guardar_exigir_plan on public.ruletas;
create trigger al_guardar_exigir_plan
  before insert or update on public.ruletas
  for each row execute function public.exigir_plan_con_ruleta();

-- Las sucursales con ruleta que hoy se puede girar: encendida, con premios,
-- con el plan que la incluye y publicada. Para la insignia y el filtro.
create or replace function public.sucursales_con_ruleta()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select r.sucursal_id
    from public.ruletas r
    join public.sucursales s on s.id = r.sucursal_id
   where r.activa
     and s.estado = 'publicado'
     and public.sucursal_tiene_ruleta(r.sucursal_id)
     and exists (select 1 from public.premios_ruleta p where p.sucursal_id = r.sucursal_id);
$$;

-- Girar. Solo clientes y nunca la propia: un negocio que gira su ruleta se
-- regala premios a si mismo. La frecuencia se cuenta en hora del centro de
-- Mexico, y un candado por persona y sucursal evita que dos clics al mismo
-- tiempo se cuelen los dos en «una vez».
create or replace function public.girar_ruleta(p_sucursal uuid)
returns table (orden smallint, premio text, codigo text, vence_en date)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := (select auth.uid());
  v_rol text;
  v_ruleta public.ruletas%rowtype;
  v_hoy date := (now() at time zone 'America/Mexico_City')::date;
  v_total int;
  v_tiro numeric;
  v_premio record;
  v_prefijo text;
  v_letras constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_codigo text;
  i int;
begin
  if v_usuario is null then
    raise exception 'Inicia sesión para girar la ruleta.';
  end if;

  select p.rol into v_rol from public.perfiles p where p.id = v_usuario and p.rol_confirmado;
  if v_rol is distinct from 'cliente' then
    raise exception 'La ruleta es para los visitantes: entra con tu cuenta de cliente.';
  end if;

  select * into v_ruleta from public.ruletas r where r.sucursal_id = p_sucursal;
  if not found or not v_ruleta.activa
     or not exists (select 1 from public.sucursales s where s.id = p_sucursal and s.estado = 'publicado')
     or not public.sucursal_tiene_ruleta(p_sucursal) then
    raise exception 'Esta ruleta no está disponible ahora.';
  end if;

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

  select coalesce(sum(p.probabilidad), 0) into v_total
    from public.premios_ruleta p where p.sucursal_id = p_sucursal;
  if v_total = 0 then
    raise exception 'Esta ruleta no está disponible ahora.';
  end if;

  -- El tiro: un numero entre 0 y el total de las probabilidades, y gana el
  -- premio en cuyo tramo cae.
  v_tiro := random() * v_total;
  for v_premio in
    select p.orden, p.texto, p.probabilidad from public.premios_ruleta p
     where p.sucursal_id = p_sucursal order by p.orden
  loop
    v_tiro := v_tiro - v_premio.probabilidad;
    exit when v_tiro < 0;
  end loop;

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

  insert into public.giros (sucursal_id, usuario_id, orden, premio, codigo, vence_en)
  values (p_sucursal, v_usuario, v_premio.orden, v_premio.texto, v_codigo,
          v_hoy + v_ruleta.vigencia_dias)
  returning giros.orden, giros.premio, giros.codigo, giros.vence_en
    into orden, premio, codigo, vence_en;

  return next;
end;
$$;

-- El cliente enseña su codigo y el negocio lo marca usado. Se escribe como
-- sea: minusculas, sin guion. Devuelve el premio para decir que entregar.
create or replace function public.canjear_premio(p_codigo text)
returns table (premio text, cliente text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_giro public.giros%rowtype;
begin
  select g.* into v_giro from public.giros g
   where public.normalizar_codigo(g.codigo) = public.normalizar_codigo(p_codigo)
     and (public.posee_sucursal(g.sucursal_id) or public.es_admin());

  if not found then
    raise exception 'No encontramos ese código en tus sucursales. Revisa que esté bien escrito.';
  end if;

  if v_giro.canjeado_en is not null then
    raise exception 'Ese premio ya se canjeó el %.',
      to_char(v_giro.canjeado_en at time zone 'America/Mexico_City', 'DD/MM/YYYY');
  end if;

  if v_giro.vence_en < (now() at time zone 'America/Mexico_City')::date then
    raise exception 'Ese premio venció el %.', to_char(v_giro.vence_en, 'DD/MM/YYYY');
  end if;

  update public.giros set canjeado_en = now() where id = v_giro.id;

  return query
    select v_giro.premio, coalesce(p.nombre, 'Un cliente')
      from public.perfiles p where p.id = v_giro.usuario_id;
end;
$$;

-- Los premios de quien mira, con el negocio que los dio (aunque ese negocio
-- este en pausa y su nombre ya no sea publico).
create or replace function public.mis_premios()
returns table (
  codigo text, premio text, vence_en date, canjeado_en timestamptz, creado_en timestamptz,
  marca text, sucursal text, slug text
)
language sql
stable
security definer
set search_path = ''
as $$
  select g.codigo, g.premio, g.vence_en, g.canjeado_en, g.creado_en,
         m.nombre_comercial, s.nombre_sucursal, s.slug
    from public.giros g
    join public.sucursales s on s.id = g.sucursal_id
    join public.marcas m on m.id = s.marca_id
   where g.usuario_id = (select auth.uid())
   order by g.creado_en desc;
$$;

-- Lo que ha repartido una sucursal, para su panel: quien, que y si ya lo cobro.
create or replace function public.premios_entregados(p_sucursal uuid)
returns table (
  codigo text, premio text, vence_en date, canjeado_en timestamptz, creado_en timestamptz,
  cliente text
)
language sql
stable
security definer
set search_path = ''
as $$
  select g.codigo, g.premio, g.vence_en, g.canjeado_en, g.creado_en,
         coalesce(p.nombre, 'Un cliente')
    from public.giros g
    left join public.perfiles p on p.id = g.usuario_id
   where g.sucursal_id = p_sucursal
     and (public.posee_sucursal(p_sucursal) or public.es_admin())
   order by g.creado_en desc
   limit 200;
$$;

-- ---------------------------------------------------------------------------
-- 2. Demo
-- ---------------------------------------------------------------------------

alter table public.marcas
  add column if not exists es_demo boolean not null default false;

comment on column public.marcas.es_demo is
  'Negocio de demostracion: lleva cinta de DEMO y no cuenta en los numeros. Solo lo pone el administrador. Ver migracion 000060.';

create or replace function public.proteger_es_demo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or public.es_admin() then
    return new;
  end if;

  if (tg_op = 'INSERT' and new.es_demo)
     or (tg_op = 'UPDATE' and new.es_demo is distinct from old.es_demo) then
    raise exception 'Solo el administrador marca un negocio como demostración.';
  end if;

  return new;
end;
$$;

drop trigger if exists al_guardar_proteger_demo on public.marcas;
create trigger al_guardar_proteger_demo
  before insert or update on public.marcas
  for each row execute function public.proteger_es_demo();

-- ---------------------------------------------------------------------------
-- Permisos de las funciones
-- ---------------------------------------------------------------------------

revoke all on function public.girar_ruleta(uuid) from public, anon;
revoke all on function public.canjear_premio(text) from public, anon;
revoke all on function public.mis_premios() from public, anon;
revoke all on function public.premios_entregados(uuid) from public, anon;

grant execute on function public.girar_ruleta(uuid) to authenticated;
grant execute on function public.canjear_premio(text) to authenticated;
grant execute on function public.mis_premios() to authenticated;
grant execute on function public.premios_entregados(uuid) to authenticated;
grant execute on function public.sucursales_con_ruleta() to anon, authenticated;
grant execute on function public.sucursal_tiene_ruleta(uuid) to anon, authenticated;
