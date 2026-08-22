-- Guía del Cacao — estrellas, promedio y foto en las resenas
--
-- Reseniar pasa a ser dos cosas distintas, con reglas distintas, y por eso son
-- dos tablas y no una columna mas:
--
--   * La CALIFICACION (1 a 5 estrellas) se da UNA SOLA VEZ por negocio. Es lo
--     que alimenta el promedio publico, asi que si se pudiera repetir o editar
--     el promedio dejaria de significar algo.
--   * El COMENTARIO (texto y, si quiere, una foto) se puede dejar UNA VEZ AL
--     DIA por negocio. Alguien que va seguido tiene mas que contar; alguien
--     que quiere inflar o hundir a un negocio, no.
--
-- Las dos reglas viven aqui y no en el frontend, como todas las demas: la
-- pantalla se puede saltar llamando al API directo, la base no.
--
-- Los topes "por dia" se calculan en hora local de Tabasco
-- (America/Mexico_City), igual que el tope diario de puntos.

-- ---------------------------------------------------------------------------
-- Calificaciones: una por persona, por sucursal, para siempre
-- ---------------------------------------------------------------------------

create table public.calificaciones (
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  sucursal_id uuid not null references public.sucursales (id) on delete cascade,
  estrellas smallint not null check (estrellas between 1 and 5),
  fecha timestamptz not null default now(),
  -- La llave primaria es la regla: no hay forma de tener dos calificaciones
  -- de la misma persona en el mismo negocio.
  primary key (usuario_id, sucursal_id)
);

-- El promedio se pide por sucursal en cada micrositio; sin este indice seria
-- un recorrido completo de la tabla cada vez.
create index calificaciones_sucursal_idx on public.calificaciones (sucursal_id);

alter table public.calificaciones enable row level security;

grant select on public.calificaciones to anon, authenticated;
grant insert on public.calificaciones to authenticated;

create policy calificaciones_lectura on public.calificaciones
  for select using (
    public.sucursal_publicada(sucursal_id)
    or public.posee_sucursal(sucursal_id)
    or public.es_admin()
  );

create policy calificaciones_crea_propia on public.calificaciones
  for insert with check (
    usuario_id = (select auth.uid())
    and public.es_cliente()
    and public.sucursal_publicada(sucursal_id)
  );

-- No hay politica de UPDATE, y es a proposito: calificar es de una sola vez.
-- RLS niega por omision, asi que la ausencia de la politica ES la regla. Si
-- alguien agrega una aqui, esta rompiendo la del spec sin darse cuenta.

-- Borrar queda para moderacion: una calificacion con insultos o de un negocio
-- que se auto-califica se quita, y entonces la persona puede volver a votar.
create policy calificaciones_borra_admin on public.calificaciones
  for delete using (public.es_admin());

-- ---------------------------------------------------------------------------
-- El promedio, ya calculado
-- ---------------------------------------------------------------------------

-- `security_invoker` para que la vista respete la politica de lectura de
-- arriba en vez de saltarsela: asi el promedio de un micrositio en borrador no
-- se asoma al publico. Es la diferencia con `perfiles_publicos`, que si corre
-- como definer porque su trabajo es justamente exponer columnas seguras de una
-- tabla cerrada.
create view public.calificaciones_sucursal
  with (security_invoker = true)
  as select sucursal_id,
            round(avg(estrellas), 1) as promedio,
            count(*)::integer as total
       from public.calificaciones
      group by sucursal_id;

grant select on public.calificaciones_sucursal to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Resenas: foto opcional y tope de una al dia
-- ---------------------------------------------------------------------------

-- Ruta dentro del bucket `resenas`, no una URL: el dominio de Supabase cambia
-- entre local y produccion, asi que guardarlo entero volveria las filas
-- inservibles al desplegar. Igual que logo y galeria en `sucursales`.
alter table public.resenas add column foto text;

-- El tope diario se cuenta por (persona, sucursal, dia), asi que el indice
-- lleva las tres en ese orden.
create index resenas_usuario_sucursal_idx
  on public.resenas (usuario_id, sucursal_id, fecha desc);

create or replace function public.limitar_resena_diaria()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  dia date := (new.fecha at time zone 'America/Mexico_City')::date;
  ya_hay integer;
begin
  select count(*)
    into ya_hay
    from public.resenas r
   where r.usuario_id = new.usuario_id
     and r.sucursal_id = new.sucursal_id
     and r.id <> new.id
     and (r.fecha at time zone 'America/Mexico_City')::date = dia;

  if ya_hay > 0 then
    raise exception 'Ya dejaste una resena hoy en este negocio (maximo 1 por dia)';
  end if;

  return new;
end;
$fn$;

-- Solo al insertar: editar el texto de la resena de hoy no cuenta como dejar
-- otra, y la marca sigue pudiendo responder sin toparse con este limite.
create trigger limitar_resenas_por_dia
  before insert on public.resenas
  for each row execute function public.limitar_resena_diaria();

-- ---------------------------------------------------------------------------
-- Bucket para las fotos de las resenas
-- ---------------------------------------------------------------------------

-- Bucket aparte de `micrositios` porque quien escribe es otro: alli escribe el
-- dueno del negocio, aqui el cliente que vino. Mezclarlos obligaria a una sola
-- politica que dejara escribir a los dos, y entonces un cliente podria
-- sobrescribir el logo de una marca.
--
-- Convencion de rutas: `{usuario_id}/{archivo}`. La primera carpeta es la
-- llave de permisos, igual que en micrositios.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'resenas',
  'resenas',
  true,
  5242880, -- 5 MB, el mismo tope que el resto de las imagenes
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
);

create or replace function public.es_su_carpeta_de_resenas(ruta text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select (select auth.uid())::text = (storage.foldername(ruta))[1];
$fn$;

create policy "resenas lectura publica"
  on storage.objects for select
  using (bucket_id = 'resenas');

create policy "resenas alta del cliente"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'resenas'
    and public.es_cliente()
    and public.es_su_carpeta_de_resenas(name)
  );

-- Sin UPDATE: una foto de resena no se reemplaza, se sube otra. Borrar si, por
-- si alguien se arrepiente de lo que subio.
create policy "resenas borrado del cliente"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'resenas'
    and (public.es_su_carpeta_de_resenas(name) or public.es_admin())
  );
