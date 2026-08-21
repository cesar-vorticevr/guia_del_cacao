-- Guía del Cacao — Row Level Security
--
-- Principio: el permiso se decide en Postgres, no en el cliente. Todo lo que el
-- publico ve pasa por "la sucursal esta publicada"; todo lo que un negocio
-- edita pasa por "esta sucursal es suya".
--
-- El rol se lee siempre de public.perfiles, nunca de user_metadata del JWT:
-- user_metadata lo puede editar el propio usuario y no sirve para autorizar.

-- ---------------------------------------------------------------------------
-- Helpers de autorizacion
-- ---------------------------------------------------------------------------

create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select exists (
    select 1 from public.perfiles p
     where p.id = (select auth.uid())
       and p.rol = 'admin'
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
      join public.marcas m on m.id = s.marca_id
     where s.id = p_sucursal
       and m.perfil_id = (select auth.uid())
  );
$fn$;

-- Estas dos funciones existen para romper un ciclo: la politica de `marcas`
-- necesita saber de `sucursales` y la de `sucursales` necesita saber de
-- `marcas`. Si se consultaran en linea, Postgres evaluaria la politica de una
-- dentro de la otra sin fin ("infinite recursion detected in policy").
-- Al ser security definer, saltan RLS y cortan la recursion.
create or replace function public.posee_marca(p_marca uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select exists (
    select 1 from public.marcas m
     where m.id = p_marca
       and m.perfil_id = (select auth.uid())
  );
$fn$;

create or replace function public.marca_con_micrositio_publicado(p_marca uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select exists (
    select 1 from public.sucursales s
     where s.marca_id = p_marca
       and s.estado = 'publicado'
  );
$fn$;

create or replace function public.sucursal_publicada(p_sucursal uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select exists (
    select 1 from public.sucursales s
     where s.id = p_sucursal
       and s.estado = 'publicado'
  );
$fn$;

-- ---------------------------------------------------------------------------
-- Perfiles
-- ---------------------------------------------------------------------------

alter table public.perfiles enable row level security;

create policy perfiles_lee_propio on public.perfiles
  for select using ((select auth.uid()) = id or public.es_admin());

create policy perfiles_actualiza_propio on public.perfiles
  for update using ((select auth.uid()) = id or public.es_admin())
  with check ((select auth.uid()) = id or public.es_admin());

-- Las resenas muestran el nombre de quien las escribio, pero el correo no debe
-- salir nunca. Esta vista expone solo lo publicable y evita abrir la tabla.
create view public.perfiles_publicos as
  select id, nombre, foto_perfil
    from public.perfiles;

grant select on public.perfiles_publicos to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Catalogos: lectura abierta, escritura solo admin
-- ---------------------------------------------------------------------------

alter table public.categorias enable row level security;
alter table public.tiers enable row level security;

create policy categorias_lectura on public.categorias for select using (true);
create policy categorias_admin on public.categorias for all
  using (public.es_admin()) with check (public.es_admin());

create policy tiers_lectura on public.tiers for select using (true);
create policy tiers_admin on public.tiers for all
  using (public.es_admin()) with check (public.es_admin());

-- ---------------------------------------------------------------------------
-- Marcas
-- ---------------------------------------------------------------------------

alter table public.marcas enable row level security;

-- Una marca solo es visible si ya tiene al menos un micrositio publicado; en
-- borrador no existe para nadie mas que su dueno (spec §3.2).
create policy marcas_lectura on public.marcas
  for select using (
    perfil_id = (select auth.uid())
    or public.es_admin()
    or public.marca_con_micrositio_publicado(id)
  );

create policy marcas_crea_propia on public.marcas
  for insert with check (perfil_id = (select auth.uid()));

create policy marcas_edita_propia on public.marcas
  for update using (perfil_id = (select auth.uid()) or public.es_admin())
  with check (perfil_id = (select auth.uid()) or public.es_admin());

create policy marcas_borra_propia on public.marcas
  for delete using (perfil_id = (select auth.uid()) or public.es_admin());

-- ---------------------------------------------------------------------------
-- Sucursales
-- ---------------------------------------------------------------------------

alter table public.sucursales enable row level security;

create policy sucursales_lectura on public.sucursales
  for select using (
    estado = 'publicado'
    or public.es_admin()
    or public.posee_marca(marca_id)
  );

create policy sucursales_crea_propia on public.sucursales
  for insert with check (public.posee_marca(marca_id));

-- El dueno edita su micrositio libremente; el paso a 'publicado' lo bloquea el
-- trigger proteger_estado_sucursal, no esta politica.
create policy sucursales_edita_propia on public.sucursales
  for update using (public.posee_sucursal(id) or public.es_admin())
  with check (public.posee_sucursal(id) or public.es_admin());

create policy sucursales_borra_propia on public.sucursales
  for delete using (public.posee_sucursal(id) or public.es_admin());

-- ---------------------------------------------------------------------------
-- Contenido de sucursal: productos, eventos, noticias, banners
-- ---------------------------------------------------------------------------

alter table public.productos_servicios enable row level security;
alter table public.eventos enable row level security;
alter table public.noticias enable row level security;
alter table public.banners enable row level security;

create policy productos_lectura on public.productos_servicios
  for select using (
    public.sucursal_publicada(sucursal_id)
    or public.posee_sucursal(sucursal_id)
    or public.es_admin()
  );

create policy productos_escritura on public.productos_servicios
  for all using (public.posee_sucursal(sucursal_id) or public.es_admin())
  with check (public.posee_sucursal(sucursal_id) or public.es_admin());

create policy eventos_lectura on public.eventos
  for select using (
    public.sucursal_publicada(sucursal_id)
    or public.posee_sucursal(sucursal_id)
    or public.es_admin()
  );

create policy eventos_escritura on public.eventos
  for all using (public.posee_sucursal(sucursal_id) or public.es_admin())
  with check (public.posee_sucursal(sucursal_id) or public.es_admin());

create policy noticias_lectura on public.noticias
  for select using (
    public.sucursal_publicada(sucursal_id)
    or public.posee_sucursal(sucursal_id)
    or public.es_admin()
  );

create policy noticias_escritura on public.noticias
  for all using (public.posee_sucursal(sucursal_id) or public.es_admin())
  with check (public.posee_sucursal(sucursal_id) or public.es_admin());

create policy banners_lectura on public.banners
  for select using (
    public.sucursal_publicada(sucursal_id)
    or public.posee_sucursal(sucursal_id)
    or public.es_admin()
  );

create policy banners_escritura on public.banners
  for all using (public.posee_sucursal(sucursal_id) or public.es_admin())
  with check (public.posee_sucursal(sucursal_id) or public.es_admin());

-- ---------------------------------------------------------------------------
-- Resenas
-- ---------------------------------------------------------------------------

alter table public.resenas enable row level security;

create policy resenas_lectura on public.resenas
  for select using (
    public.sucursal_publicada(sucursal_id)
    or public.posee_sucursal(sucursal_id)
    or public.es_admin()
  );

create policy resenas_crea_propia on public.resenas
  for insert with check (
    usuario_id = (select auth.uid())
    and public.sucursal_publicada(sucursal_id)
  );

-- El cliente puede editar su texto; la marca solo puede contestar. El reparto
-- exacto de columnas lo impone el trigger de abajo.
create policy resenas_edita on public.resenas
  for update using (
    usuario_id = (select auth.uid())
    or public.posee_sucursal(sucursal_id)
    or public.es_admin()
  )
  with check (
    usuario_id = (select auth.uid())
    or public.posee_sucursal(sucursal_id)
    or public.es_admin()
  );

create policy resenas_borra_propia on public.resenas
  for delete using (usuario_id = (select auth.uid()) or public.es_admin());

-- Una marca no puede reescribir la resena que le dejaron: solo responderla.
create or replace function public.proteger_resena()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  if (select auth.uid()) is not null
     and new.usuario_id <> (select auth.uid())
     and not public.es_admin()
     and new.texto is distinct from old.texto
  then
    raise exception 'La marca solo puede responder una resena, no editarla';
  end if;

  if new.respuesta_marca is distinct from old.respuesta_marca then
    new.fecha_respuesta := now();
  end if;

  return new;
end;
$fn$;

create trigger al_actualizar_resena
  before update on public.resenas
  for each row execute function public.proteger_resena();

-- ---------------------------------------------------------------------------
-- Solicitudes de puntos
-- ---------------------------------------------------------------------------

alter table public.solicitudes_puntos enable row level security;
alter table public.solicitud_productos enable row level security;

create policy solicitudes_lectura on public.solicitudes_puntos
  for select using (
    usuario_id = (select auth.uid())
    or public.posee_sucursal(sucursal_id)
    or public.es_admin()
  );

create policy solicitudes_crea_propia on public.solicitudes_puntos
  for insert with check (usuario_id = (select auth.uid()));

-- Solo la marca (o un admin) resuelve la solicitud. El cliente no se aprueba
-- sus propios puntos.
create policy solicitudes_resuelve_marca on public.solicitudes_puntos
  for update using (public.posee_sucursal(sucursal_id) or public.es_admin())
  with check (public.posee_sucursal(sucursal_id) or public.es_admin());

-- Igual que arriba: se consulta solicitudes_puntos desde una politica, asi que
-- conviene hacerlo con security definer y no anidar la RLS de esa tabla.
create or replace function public.puede_ver_solicitud(p_solicitud uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select exists (
    select 1 from public.solicitudes_puntos sp
     where sp.id = p_solicitud
       and (
         sp.usuario_id = (select auth.uid())
         or public.posee_sucursal(sp.sucursal_id)
         or public.es_admin()
       )
  );
$fn$;

create or replace function public.solicitud_es_mia(p_solicitud uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select exists (
    select 1 from public.solicitudes_puntos sp
     where sp.id = p_solicitud
       and sp.usuario_id = (select auth.uid())
  );
$fn$;

create policy solicitud_productos_lectura on public.solicitud_productos
  for select using (public.puede_ver_solicitud(solicitud_id));

create policy solicitud_productos_crea on public.solicitud_productos
  for insert with check (public.solicitud_es_mia(solicitud_id));

-- ---------------------------------------------------------------------------
-- Rangos
-- ---------------------------------------------------------------------------

alter table public.rangos_usuario enable row level security;

-- Solo el propio usuario y el admin ven el acumulado. Los eventos exclusivos
-- por rango se filtran del lado del servidor, para no exponer los puntos de
-- todos los clientes a todos los negocios.
create policy rangos_lectura_propia on public.rangos_usuario
  for select using (usuario_id = (select auth.uid()) or public.es_admin());

-- ---------------------------------------------------------------------------
-- Suscripciones: nunca publicas
-- ---------------------------------------------------------------------------

alter table public.suscripciones enable row level security;

create policy suscripciones_propias on public.suscripciones
  for select using (public.posee_sucursal(sucursal_id) or public.es_admin());

create policy suscripciones_crea on public.suscripciones
  for insert with check (public.posee_sucursal(sucursal_id) or public.es_admin());

create policy suscripciones_edita on public.suscripciones
  for update using (public.posee_sucursal(sucursal_id) or public.es_admin())
  with check (public.posee_sucursal(sucursal_id) or public.es_admin());

-- ---------------------------------------------------------------------------
-- Permisos de tabla
-- ---------------------------------------------------------------------------
--
-- RLS decide QUE renglones ve cada quien, pero antes hace falta el permiso de
-- tabla. Sin estos GRANT, PostgREST contesta "permission denied" sin llegar
-- siquiera a evaluar las politicas.
--
-- Es seguro dar SELECT sobre todo a anon porque todas las tablas de este
-- esquema tienen RLS activo: el permiso abre la puerta, la politica filtra.

grant usage on schema public to anon, authenticated;

grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Lo anterior solo cubre las tablas que existen hoy. Esto cubre las que se
-- creen en migraciones futuras.
alter default privileges in schema public
  grant select on tables to anon, authenticated;
alter default privileges in schema public
  grant insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;
