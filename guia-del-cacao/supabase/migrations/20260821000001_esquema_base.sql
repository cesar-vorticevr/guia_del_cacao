-- Guía del Cacao — esquema base
--
-- Traducción del modelo de datos de spec-tecnica-guia-del-cacao.md §6 a Postgres.
--
-- Diferencia deliberada con el spec: las tablas Usuario, Negocio y Administrador
-- del documento se unifican en `perfiles`. La identidad (correo, contraseña,
-- Google OAuth) la administra `auth.users` de Supabase, así que los campos
-- password_hash y google_id del spec ya no viven en nuestras tablas. El rol
-- distingue cliente / negocio / admin, y Turismo es una marca con bandera
-- especial, tal como pide §2.

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------

create type public.rol_usuario as enum ('cliente', 'negocio', 'admin');

create type public.estado_sucursal as enum (
  'borrador',
  'pendiente_pago',
  'pendiente_aprobacion',
  'publicado',
  'rechazado',
  'pausado'
);

create type public.estado_solicitud as enum ('pendiente', 'aprobada', 'rechazada');

create type public.estado_suscripcion as enum ('activo', 'vencido', 'cancelado');

-- ---------------------------------------------------------------------------
-- Perfiles (cuelga de auth.users)
-- ---------------------------------------------------------------------------

create table public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  rol public.rol_usuario not null default 'cliente',
  nombre text not null,
  correo text not null,
  foto_perfil text,
  fecha_registro timestamptz not null default now()
);

comment on table public.perfiles is
  'Un renglon por cuenta de auth.users. El rol se decide al registrarse y solo un admin puede cambiarlo.';

-- El rol llega en la metadata del registro, pero nunca se acepta 'admin' por esa
-- via: las cuentas de administrador se asignan a mano (spec §2).
create or replace function public.manejar_nuevo_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  rol_solicitado text := coalesce(new.raw_user_meta_data ->> 'rol', 'cliente');
begin
  if rol_solicitado not in ('cliente', 'negocio') then
    rol_solicitado := 'cliente';
  end if;

  insert into public.perfiles (id, rol, nombre, correo, foto_perfil)
  values (
    new.id,
    rol_solicitado::public.rol_usuario,
    coalesce(
      new.raw_user_meta_data ->> 'nombre',
      new.raw_user_meta_data ->> 'full_name',
      split_part(coalesce(new.email, 'sin-nombre@guiadelcacao.mx'), '@', 1)
    ),
    coalesce(new.email, ''),
    new.raw_user_meta_data ->> 'avatar_url'
  );

  return new;
end;
$fn$;

create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function public.manejar_nuevo_usuario();

-- Nadie se auto-promueve: solo un admin puede mover el rol de un perfil.
create or replace function public.proteger_rol()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  -- auth.uid() nulo = migraciones, semillas y service_role: no se bloquean.
  if new.rol is distinct from old.rol
     and (select auth.uid()) is not null
     and coalesce(
       (select p.rol from public.perfiles p where p.id = (select auth.uid())),
       'cliente'
     ) <> 'admin'
  then
    raise exception 'Solo un administrador puede cambiar el rol de un perfil';
  end if;

  return new;
end;
$fn$;

create trigger al_actualizar_perfil
  before update on public.perfiles
  for each row execute function public.proteger_rol();

-- ---------------------------------------------------------------------------
-- Catalogos: categorias y tiers
-- ---------------------------------------------------------------------------

create table public.categorias (
  id smallint generated always as identity primary key,
  nombre text not null unique,
  slug text not null unique,
  orden smallint not null default 0
);

create table public.tiers (
  id smallint primary key,
  nombre text not null,
  precio_mensual numeric(10, 2) not null,
  puede_dar_puntos boolean not null,
  puede_publicar_contenido boolean not null,
  en_banner_principal boolean not null
);

comment on table public.tiers is
  'Las banderas son la fuente de verdad de los permisos comerciales (spec §5.1). El precio es mensual y por sucursal.';

-- ---------------------------------------------------------------------------
-- Marcas y sucursales (la sucursal es el micrositio y la unidad de cobro)
-- ---------------------------------------------------------------------------

create table public.marcas (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references public.perfiles (id) on delete cascade,
  nombre_comercial text not null,
  categoria_id smallint not null references public.categorias (id),
  es_turismo boolean not null default false,
  fecha_registro timestamptz not null default now()
);

create index marcas_perfil_idx on public.marcas (perfil_id);
create index marcas_categoria_idx on public.marcas (categoria_id);

create table public.sucursales (
  id uuid primary key default gen_random_uuid(),
  marca_id uuid not null references public.marcas (id) on delete cascade,
  nombre_sucursal text not null,
  slug text not null unique,
  logo text,
  imagen_fondo text,
  ubicacion_maps_url text,
  acerca_de text,
  whatsapp text,
  facebook text,
  instagram text,
  youtube text,
  tiktok text,
  correo_contacto text,
  telefono text,
  tier_id smallint references public.tiers (id),
  estado public.estado_sucursal not null default 'borrador',
  motivo_rechazo text,
  fecha_creacion timestamptz not null default now(),
  fecha_publicacion timestamptz
);

create index sucursales_marca_idx on public.sucursales (marca_id);

-- El directorio publico siempre filtra por estado; el indice parcial lo cubre.
create index sucursales_publicadas_idx
  on public.sucursales (tier_id, fecha_publicacion desc)
  where estado = 'publicado';

comment on table public.sucursales is
  'Cada sucursal es un micrositio independiente y se cobra por separado (spec §5.1).';

-- ---------------------------------------------------------------------------
-- Contenido de la sucursal
-- ---------------------------------------------------------------------------

create table public.productos_servicios (
  id uuid primary key default gen_random_uuid(),
  sucursal_id uuid not null references public.sucursales (id) on delete cascade,
  nombre text not null,
  descripcion text,
  precio numeric(10, 2),
  imagen text,
  fecha_creacion timestamptz not null default now()
);

create index productos_sucursal_idx on public.productos_servicios (sucursal_id);

create table public.eventos (
  id uuid primary key default gen_random_uuid(),
  sucursal_id uuid not null references public.sucursales (id) on delete cascade,
  titulo text not null,
  subtitulo text,
  contenido text not null,
  imagenes text[] not null default '{}',
  fecha_evento timestamptz not null,
  fecha_publicacion timestamptz not null default now(),
  rango_exclusivo smallint check (rango_exclusivo between 1 and 4)
);

create index eventos_sucursal_idx on public.eventos (sucursal_id);
create index eventos_fecha_idx on public.eventos (fecha_evento desc);

create table public.noticias (
  id uuid primary key default gen_random_uuid(),
  sucursal_id uuid not null references public.sucursales (id) on delete cascade,
  titulo text not null,
  subtitulo text,
  contenido text not null,
  imagenes text[] not null default '{}',
  fecha_publicacion timestamptz not null default now()
);

create index noticias_sucursal_idx on public.noticias (sucursal_id);
create index noticias_fecha_idx on public.noticias (fecha_publicacion desc);

create table public.banners (
  id uuid primary key default gen_random_uuid(),
  sucursal_id uuid not null references public.sucursales (id) on delete cascade,
  imagen text not null,
  texto text,
  orden_rotacion smallint not null default 0,
  activo boolean not null default true
);

create index banners_orden_idx on public.banners (orden_rotacion) where activo;

-- ---------------------------------------------------------------------------
-- Resenas
-- ---------------------------------------------------------------------------

create table public.resenas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  sucursal_id uuid not null references public.sucursales (id) on delete cascade,
  texto text not null,
  fecha timestamptz not null default now(),
  respuesta_marca text,
  fecha_respuesta timestamptz
);

create index resenas_sucursal_idx on public.resenas (sucursal_id, fecha desc);
create index resenas_usuario_idx on public.resenas (usuario_id);

-- ---------------------------------------------------------------------------
-- Pasaporte de puntos
-- ---------------------------------------------------------------------------

create table public.solicitudes_puntos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  sucursal_id uuid not null references public.sucursales (id) on delete cascade,
  puntos_otorgados smallint check (puntos_otorgados between 1 and 3),
  estado public.estado_solicitud not null default 'pendiente',
  fecha_solicitud timestamptz not null default now(),
  fecha_resolucion timestamptz,
  constraint puntos_coherentes_con_estado check (
    (estado = 'pendiente' and puntos_otorgados is null and fecha_resolucion is null)
    or (estado = 'rechazada' and fecha_resolucion is not null)
    or (estado = 'aprobada' and puntos_otorgados is not null and fecha_resolucion is not null)
  )
);

create index solicitudes_sucursal_idx on public.solicitudes_puntos (sucursal_id, estado);
create index solicitudes_usuario_idx on public.solicitudes_puntos (usuario_id, fecha_solicitud desc);

-- Regla §5.4.4: no se puede pedir puntos otra vez a la misma sucursal
-- mientras haya una solicitud sin resolver.
create unique index solicitud_pendiente_unica
  on public.solicitudes_puntos (usuario_id, sucursal_id)
  where estado = 'pendiente';

create table public.solicitud_productos (
  solicitud_id uuid not null references public.solicitudes_puntos (id) on delete cascade,
  producto_id uuid not null references public.productos_servicios (id) on delete cascade,
  primary key (solicitud_id, producto_id)
);

create table public.rangos_usuario (
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  anio smallint not null,
  puntos_acumulados integer not null default 0,
  rango_actual smallint not null default 1,
  primary key (usuario_id, anio)
);

comment on table public.rangos_usuario is
  'Los puntos se particionan por anio, asi el reinicio del 1 de enero (spec §5.4) ocurre solo, sin tarea programada.';

-- Escalera de rangos de §5.4. El spec traslapa los limites (Rango 3: 50-100,
-- Rango 4: 100-200); aqui 100 cuenta como Rango 4 y no hay tope superior.
create or replace function public.calcular_rango(puntos integer)
returns smallint
language sql
immutable
as $fn$
  select case
    when puntos >= 100 then 4
    when puntos >= 50 then 3
    when puntos >= 20 then 2
    else 1
  end::smallint;
$fn$;

-- ---------------------------------------------------------------------------
-- Suscripciones (el cobro real todavia no existe: ver spec §4)
-- ---------------------------------------------------------------------------

create table public.suscripciones (
  id uuid primary key default gen_random_uuid(),
  sucursal_id uuid not null references public.sucursales (id) on delete cascade,
  tier_id smallint not null references public.tiers (id),
  monto_mensual numeric(10, 2) not null,
  estado public.estado_suscripcion not null default 'activo',
  fecha_inicio timestamptz not null default now(),
  fecha_proximo_cobro timestamptz not null,
  metodo_pago_stub text
);

create index suscripciones_sucursal_idx on public.suscripciones (sucursal_id, estado);

comment on column public.suscripciones.metodo_pago_stub is
  'PENDIENTE: marcador del cobro simulado. Se reemplaza cuando se conecte la pasarela real (Stripe / Conekta / Mercado Pago).';
