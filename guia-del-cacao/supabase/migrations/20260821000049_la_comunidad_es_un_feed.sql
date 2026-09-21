-- La comunidad pasa a ser un feed: carrusel de hasta diez, video, y guardados.
--
-- Tres cambios que van juntos porque son la misma decisión de producto: que el
-- muro se mire como se mira Instagram, donde nunca hay una publicación sin algo
-- que ver.
--
-- Lo que **no** cambia: que la foto sea obligatoria. Ya lo era —el check de la
-- migración 000030 exige al menos una— y sigue siendo `not valid` por lo mismo
-- que entonces: nueve de las catorce publicaciones que hay vienen del foro
-- viejo y no tienen ninguna. La regla es para lo que se escriba de hoy en
-- adelante; a lo de antes no se le cambian las reglas a media partida.

-- 1. Cuántos videos trae una lista de archivos ------------------------------
--
-- Hace falta para poder limitarlos en un `check`, que no admite subconsultas.
-- Las extensiones son las mismas que mira `esVideo()` en la aplicación: si se
-- agrega una allá, se agrega aquí. Se decide por la extensión y no por una
-- columna aparte porque el nombre del archivo lo pone la aplicación al subirlo.
create or replace function public.cuantos_videos(rutas text[])
returns integer
language sql
immutable
set search_path = ''
as $$
  select count(*)::integer
    from unnest(coalesce(rutas, '{}'::text[])) as ruta
   where ruta ~* '\.(mp4|webm|mov|m4v)$';
$$;

comment on function public.cuantos_videos is
  'Cuantos archivos de una lista son video, por su extension. Existe para poder contarlos dentro de un check, que no admite subconsultas.';

-- 2. Hasta diez elementos, y como mucho un video ----------------------------
--
-- Diez porque es lo que aguanta un carrusel antes de que nadie llegue al final,
-- y es la medida con la que la gente ya está acostumbrada a publicar.
--
-- Un solo video por publicación, en cambio, no es una decisión de diseño sino
-- de cuenta: el video se sirve tal cual se subió, sin recodificar, así que cada
-- persona que lo mira se lleva el archivo entero. Diez videos de 20 MB en una
-- publicación serían 200 MB por visita. Con uno, el techo es conocido.
alter table public.publicaciones
  drop constraint if exists publicaciones_fotos_check;

alter table public.publicaciones
  add constraint publicaciones_fotos_check
  check (
    cardinality(imagenes) >= 1
    and cardinality(imagenes) <= 10
    and public.cuantos_videos(imagenes) <= 1
  )
  not valid;

-- 3. El bucket acepta video -------------------------------------------------
--
-- Los mismos tipos y el mismo tope que `resenas` y `comprobantes`, que ya
-- aceptaban video desde la migración 000032. Se reutiliza ese número en vez de
-- inventar un tercero: 5 MB no alcanzan para nada grabado con un celular, y
-- pasar de 20 MB obligaría a subir tambien `serverActions.bodySizeLimit`, que
-- está en 22mb justo para que quepan con las cabeceras del multipart.
--
-- **El tope de 30 segundos no está aquí**, y no se puede: Postgres no sabe
-- cuánto dura un archivo. Lo comprueba el navegador antes de subirlo. Quien
-- salte la interfaz puede colar un video largo, y lo único que lo acota es este
-- tope de peso — que es justo el que decide el costo, así que el daño posible
-- está limitado a lo mismo que un video corto de buena calidad.
update storage.buckets
   set allowed_mime_types = array[
         'image/jpeg', 'image/png', 'image/webp', 'image/avif',
         'video/mp4', 'video/webm', 'video/quicktime'
       ],
       file_size_limit = 20 * 1024 * 1024
 where id = 'comunidad';

-- 4. Guardar una publicación ------------------------------------------------
--
-- Tabla aparte de `favoritos`, que guarda **sucursales**. Meter las dos cosas
-- en una obligaría a hacer opcionales sus dos columnas, perder la llave
-- primaria que impide guardar dos veces lo mismo, y sostener con un `check` lo
-- que hoy sostiene la estructura. Es el mismo razonamiento de la 000045.
--
-- Guardar es privado: a diferencia del corazón, que se cuenta a la vista de
-- todos, lo que alguien guarda no lo ve nadie más. Por eso la política de
-- lectura es solo suya, y por eso el muro puede filtrar por guardados sin
-- enseñarle a nadie lo que guardó el vecino.
create table if not exists public.guardados (
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  publicacion_id uuid not null references public.publicaciones (id) on delete cascade,
  fecha timestamptz not null default now(),
  primary key (usuario_id, publicacion_id)
);

comment on table public.guardados is
  'Las publicaciones que alguien guardo para despues. Privadas: solo las ve quien las guardo. La llave primaria compuesta impide guardar dos veces la misma.';

create index if not exists guardados_del_usuario_idx
  on public.guardados (usuario_id, fecha desc);

alter table public.guardados enable row level security;

create policy guardados_lectura on public.guardados
  for select to authenticated
  using ((select auth.uid()) = usuario_id);

create policy guardados_escritura on public.guardados
  for insert to authenticated
  with check ((select auth.uid()) = usuario_id);

create policy guardados_borrado on public.guardados
  for delete to authenticated
  using ((select auth.uid()) = usuario_id);
