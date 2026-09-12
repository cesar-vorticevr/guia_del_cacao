-- Corazones en eventos y publicaciones, y que se puedan quitar.
--
-- Habia `apoyos` para publicaciones, con dos huecos:
--
--   1. **No se podian quitar.** No existia politica de delete, asi que un
--      corazon dado por error se quedaba puesto para siempre. Un "me gusta" que
--      no se puede retirar deja de ser una opinion y pasa a ser una trampa.
--   2. **Solo los clientes podian darlos.** Igual que pasaba con los
--      comentarios antes de la migracion 000044: un negocio leia el muro y no
--      podia responder a nada.
--
-- Y los eventos no tenian ninguno, aunque si tienen comentarios desde la
-- migracion 000013.

-- ---------------------------------------------------------------------------
-- Los de siempre: se abren y se pueden retirar
-- ---------------------------------------------------------------------------
drop policy if exists apoyos_crea_propio on public.apoyos;

create policy apoyos_crea_propio on public.apoyos
  for insert to authenticated
  with check (usuario_id = (select auth.uid()));

create policy apoyos_quita_propio on public.apoyos
  for delete to authenticated
  using (usuario_id = (select auth.uid()) or public.es_admin());

-- ---------------------------------------------------------------------------
-- Los de los eventos
-- ---------------------------------------------------------------------------
--
-- Tabla aparte y no una columna mas en `apoyos`: su llave primaria es
-- (publicacion_id, usuario_id) y meter ahi los eventos obligaria a hacer las
-- dos columnas opcionales, perder la llave y sostener con un check lo que hoy
-- sostiene la estructura. Es el mismo reparto que ya existe entre `comentarios`
-- -del muro- y `comentarios_publicacion` -de eventos y noticias-.
create table if not exists public.apoyos_evento (
  evento_id uuid not null references public.eventos (id) on delete cascade,
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  fecha timestamptz not null default now(),
  primary key (evento_id, usuario_id)
);

comment on table public.apoyos_evento is
  'Los corazones de un evento. La llave primaria compuesta es la que impide dar dos veces el mismo: no hace falta comprobarlo antes de insertar.';

create index if not exists apoyos_evento_idx on public.apoyos_evento (evento_id);

alter table public.apoyos_evento enable row level security;

-- Cuantos corazones tiene un evento es tan publico como el evento: se lee sin
-- sesion, que es lo que permite ensenar el contador a quien todavia no entra.
create policy apoyos_evento_lectura on public.apoyos_evento
  for select to anon, authenticated
  using (true);

create policy apoyos_evento_crea_propio on public.apoyos_evento
  for insert to authenticated
  with check (usuario_id = (select auth.uid()));

create policy apoyos_evento_quita_propio on public.apoyos_evento
  for delete to authenticated
  using (usuario_id = (select auth.uid()) or public.es_admin());

-- No hay politica de update a proposito: un corazon se da o se quita, no se
-- edita. La ausencia es la regla.
