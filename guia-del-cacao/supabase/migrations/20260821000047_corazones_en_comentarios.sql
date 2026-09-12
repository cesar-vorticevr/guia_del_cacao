-- Corazones en los comentarios de la comunidad.
--
-- Los tenían la publicación (`apoyos`) y el evento (`apoyos_evento`), pero no
-- lo que de verdad se lee en una conversación, que es lo que contesta la gente.
-- Sin un corazón, estar de acuerdo con un comentario obligaba a escribir otro
-- comentario para decir "eso"; y el tope de cinco por publicación existe para
-- que nadie acapare la conversación, no para gastarlo en asentir.
--
-- Tabla aparte y no una columna más en `apoyos`, por lo mismo que se escribió
-- en la migración 000045: la llave primaria de `apoyos` es
-- (publicacion_id, usuario_id), y meter ahí los comentarios obligaría a hacer
-- las dos columnas opcionales, perder la llave y sostener con un `check` lo que
-- hoy sostiene la estructura.
--
-- **Solo los de la comunidad.** Los de un evento viven en
-- `comentarios_publicacion`, y ahí se comenta **una vez**: no es una
-- conversación sino "qué me parece esto", y de hecho esa tabla no tiene ni
-- `responde_a`. Donde no hay hilo, no hay a qué asentir.
create table if not exists public.apoyos_comentario (
  comentario_id uuid not null references public.comentarios (id) on delete cascade,
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  fecha timestamptz not null default now(),
  primary key (comentario_id, usuario_id)
);

comment on table public.apoyos_comentario is
  'Los corazones de un comentario de la comunidad. La llave primaria compuesta es la que impide dar dos veces el mismo: no hace falta comprobarlo antes de insertar.';

create index if not exists apoyos_comentario_idx
  on public.apoyos_comentario (comentario_id);

alter table public.apoyos_comentario enable row level security;

-- Cuántos corazones tiene un comentario es tan público como el comentario: se
-- lee sin sesión, que es lo que permite enseñar el contador a quien todavía no
-- ha entrado. No hace falta acotarlo a los comentarios visibles — un número sin
-- el texto al lado no dice nada de nadie, y el texto lo sigue guardando la
-- política de `comentarios`.
create policy apoyos_comentario_lectura on public.apoyos_comentario
  for select to anon, authenticated
  using (true);

create policy apoyos_comentario_crea_propio on public.apoyos_comentario
  for insert to authenticated
  with check (usuario_id = (select auth.uid()));

-- Se puede retirar, igual que el de la publicación desde la migración 000045:
-- un corazón que no se puede quitar deja de ser una opinión.
create policy apoyos_comentario_quita_propio on public.apoyos_comentario
  for delete to authenticated
  using (usuario_id = (select auth.uid()) or public.es_admin());
