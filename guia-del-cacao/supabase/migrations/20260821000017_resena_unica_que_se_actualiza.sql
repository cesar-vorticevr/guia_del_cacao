-- Guía del Cacao — la resena se actualiza, no se acumula
--
-- Cambia el modelo de las resenas, y con el una regla que estaba al reves.
--
-- ANTES: cada resena era una fila nueva, una por dia. Con el tiempo, una misma
-- persona acumulaba diez comentarios del mismo negocio y el micrositio se
-- llenaba de la misma voz. La calificacion, en cambio, era para siempre: se
-- daba una vez y no se podia corregir nunca.
--
-- AHORA: cada quien tiene UNA resena por negocio y UNA calificacion, y las dos
-- se pueden cambiar —a lo mas una vez al dia, igual que se pide recompensa una
-- vez al dia—. Es lo que la gente espera: volviste, cambiaste de opinion, lo
-- corriges. Lo que se lee es lo que piensas hoy, no un historial.
--
-- La calificacion deja de ser inmutable a proposito: la migracion 000011 no
-- tenia politica de UPDATE justamente para impedirlo, y aqui se agrega.

-- ---------------------------------------------------------------------------
-- Una resena por persona y por negocio
-- ---------------------------------------------------------------------------

-- Si quedaran duplicados de antes habria que quedarse con el mas reciente, que
-- es lo que esta regla considera "tu resena". Hoy no hay ninguno, pero la
-- migracion tiene que poder correr sobre una base que si los tenga.
delete from public.resenas r
 where exists (
   select 1 from public.resenas otra
    where otra.usuario_id = r.usuario_id
      and otra.sucursal_id = r.sucursal_id
      and (otra.fecha, otra.id) > (r.fecha, r.id)
 );

alter table public.resenas
  add constraint resena_unica_por_negocio unique (usuario_id, sucursal_id);

-- El tope diario deja de contar altas y pasa a contar cambios: se puede tocar
-- la resena una vez al dia, en hora de Tabasco, igual que el resto de los
-- topes de la plataforma.
drop trigger limitar_resenas_por_dia on public.resenas;

alter table public.resenas add column fecha_edicion timestamptz;

comment on column public.resenas.fecha_edicion is
  'Cuando se cambio por ultima vez. Es lo que mide el tope de un cambio al dia, y lo que se enseña como "editada".';

create or replace function public.limitar_cambio_de_resena()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  hoy date := (now() at time zone 'America/Mexico_City')::date;
  ultimo date := (coalesce(old.fecha_edicion, old.fecha) at time zone 'America/Mexico_City')::date;
begin
  -- La marca respondiendo no cuenta como cambio de la resena: eso toca otra
  -- columna y lo vigila proteger_resena.
  if new.texto is not distinct from old.texto
     and new.foto is not distinct from old.foto
  then
    return new;
  end if;

  if ultimo = hoy and (select auth.uid()) = old.usuario_id then
    raise exception 'Ya cambiaste tu resena hoy en este negocio; puedes volver a hacerlo manana';
  end if;

  new.fecha_edicion := now();

  return new;
end;
$fn$;

create trigger limitar_cambio_de_resena_al_dia
  before update on public.resenas
  for each row execute function public.limitar_cambio_de_resena();

-- ---------------------------------------------------------------------------
-- La calificacion tambien se corrige
-- ---------------------------------------------------------------------------

create policy calificaciones_actualiza_propia on public.calificaciones
  for update using (usuario_id = (select auth.uid()) or public.es_admin())
  with check (usuario_id = (select auth.uid()) or public.es_admin());

grant update on public.calificaciones to authenticated;

alter table public.calificaciones add column fecha_edicion timestamptz;

create or replace function public.limitar_cambio_de_calificacion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  hoy date := (now() at time zone 'America/Mexico_City')::date;
  ultimo date := (coalesce(old.fecha_edicion, old.fecha) at time zone 'America/Mexico_City')::date;
begin
  if new.estrellas is not distinct from old.estrellas then
    return new;
  end if;

  if ultimo = hoy and (select auth.uid()) = old.usuario_id then
    raise exception 'Ya cambiaste tu calificacion hoy en este negocio; puedes volver a hacerlo manana';
  end if;

  new.fecha_edicion := now();

  return new;
end;
$fn$;

create trigger limitar_cambio_de_calificacion_al_dia
  before update on public.calificaciones
  for each row execute function public.limitar_cambio_de_calificacion();

-- ---------------------------------------------------------------------------
-- Video, no solo foto
-- ---------------------------------------------------------------------------

-- Un video de veinte segundos dice mas de una finca que cualquier foto. El
-- tope sube a 20 MB porque con 5 no cabe nada grabado con celular, y el tipo
-- se deduce de la extension al mostrarlo: es la aplicacion la que decide el
-- nombre del archivo, asi que no hace falta una columna que lo repita.
update storage.buckets
   set file_size_limit = 20971520,
       allowed_mime_types = array[
         'image/jpeg', 'image/png', 'image/webp', 'image/avif',
         'video/mp4', 'video/webm', 'video/quicktime'
       ]
 where id in ('resenas', 'comprobantes');

comment on column public.resenas.foto is
  'Ruta del medio que acompana la resena: imagen o video. El nombre quedo de cuando solo habia fotos.';
