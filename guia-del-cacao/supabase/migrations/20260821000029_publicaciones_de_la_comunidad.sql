-- La comunidad deja de tener tres formatos y pasa a tener uno: publicaciones.
--
-- Habia temas del foro (de la gente), noticias (de los negocios) y eventos, cada
-- uno con su tabla, su formulario y su regla de quien podia escribir. Desde
-- fuera eran lo mismo —alguien cuenta algo y los demas comentan— y lo unico que
-- cambiaba de verdad era el evento, que tiene fecha y caduca. Los eventos se
-- quedan en su agenda; el resto se unifica aqui.
--
-- No se crea una tabla nueva: `temas_foro` ya era exactamente esto —autor,
-- titulo, contenido— asi que se renombra y se le agrega lo que le faltaba para
-- que quepan tambien las noticias. Renombrar conserva los comentarios, los
-- apoyos y sus llaves; crear otra tabla habria obligado a mover 25 comentarios
-- a mano y a arrastrar dos modelos en paralelo.

-- ------------------------------------------------------------- publicaciones
alter table public.temas_foro rename to publicaciones;

alter index public.temas_foro_pkey rename to publicaciones_pkey;
alter index public.temas_foro_autor_idx rename to publicaciones_autor_idx;
alter index public.temas_foro_fecha_idx rename to publicaciones_fecha_idx;

-- Quien publica como negocio: la sucursal dice de quien es la marca que firma.
-- Nula cuando publica una persona, que es el caso normal.
alter table public.publicaciones
  add column sucursal_id uuid references public.sucursales(id) on delete set null;

-- Las noticias traian foto y los temas no. Se queda opcional: quitarla seria
-- perder las que ya estan subidas.
alter table public.publicaciones
  add column imagenes text[] not null default '{}';

-- Ocultar es del autor y no borra nada: una publicacion oculta deja de verse
-- pero se puede volver a mostrar. Borrar sigue existiendo, aparte.
alter table public.publicaciones add column oculta_en timestamptz;

create index publicaciones_sucursal_idx on public.publicaciones (sucursal_id);

comment on table public.publicaciones is
  'Lo que se cuenta en la comunidad: titulo, contenido y foto opcional. Antes eran `temas_foro` y `noticias`; los eventos siguen aparte porque tienen fecha y caducan.';

-- --------------------------------------------------------------- comentarios
alter table public.comentarios_foro rename to comentarios;
alter table public.comentarios rename column tema_id to publicacion_id;

alter index public.comentarios_foro_pkey rename to comentarios_pkey;
alter index public.comentarios_foro_tema_idx rename to comentarios_publicacion_idx;
alter index public.comentarios_foro_usuario_idx rename to comentarios_usuario_idx;

-- El tope de temas por rango se va antes de mover nada: es un trigger sobre esta
-- misma tabla y rechazaria las noticias que estan a punto de entrar.
drop trigger if exists limitar_temas_al_crear on public.publicaciones;

-- Los dos triggers de comentarios hablaban de `comentarios_foro` y `tema_id`,
-- que ya no existen: hay que ponerlos al dia antes de mover los comentarios de
-- las noticias, o el primer insert los despierta apuntando a la nada.
-- Las dos funciones de comentarios apuntaban a los nombres viejos.
create or replace function public.limitar_comentarios_de_foro()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  ya_lleva integer;
begin
  select count(*) into ya_lleva
    from public.comentarios c
   where c.publicacion_id = new.publicacion_id
     and c.usuario_id = new.usuario_id
     and c.id <> new.id;

  if ya_lleva >= 5 then
    raise exception 'Ya dejaste tus 5 comentarios en esta publicacion';
  end if;

  return new;
end;
$function$;

create or replace function public.proteger_comentario_foro()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  soy_el_autor boolean := new.usuario_id = (select auth.uid());
begin
  if (select auth.uid()) is not null
     and not soy_el_autor
     and not public.es_admin()
     and new.texto is distinct from old.texto
  then
    raise exception 'Quien publico puede ocultar un comentario, no reescribirlo';
  end if;

  if soy_el_autor
     and not public.es_admin()
     and new.oculto is distinct from old.oculto
  then
    raise exception 'Solo quien publico o un administrador pueden ocultar un comentario';
  end if;

  if new.texto is distinct from old.texto then
    new.fecha_edicion := now();
  end if;

  return new;
end;
$function$;

-- ------------------------------------------------- las noticias se mudan
-- El autor es el dueno de la marca: una noticia no tenia autor propio, colgaba
-- de la sucursal. El subtitulo se pega al principio del contenido en vez de
-- perderse, porque en varias es la frase que da contexto al titulo.
insert into public.publicaciones (id, autor_id, sucursal_id, titulo, contenido, imagenes, fecha)
select n.id,
       m.perfil_id,
       n.sucursal_id,
       n.titulo,
       case
         when n.subtitulo is null or btrim(n.subtitulo) = '' then n.contenido
         else n.subtitulo || E'\n\n' || n.contenido
       end,
       n.imagenes,
       n.fecha_publicacion
  from public.noticias n
  join public.sucursales s on s.id = n.sucursal_id
  join public.marcas m on m.id = s.marca_id
 where not exists (select 1 from public.publicaciones p where p.id = n.id);

-- Y sus comentarios con ellas. Los de eventos se quedan donde estan.
insert into public.comentarios (id, publicacion_id, usuario_id, texto, oculto, fecha, fecha_edicion)
select cp.id, cp.noticia_id, cp.usuario_id, cp.texto, cp.oculto, cp.fecha, cp.fecha_edicion
  from public.comentarios_publicacion cp
 where cp.noticia_id is not null
   and not exists (select 1 from public.comentarios c where c.id = cp.id);

delete from public.comentarios_publicacion where noticia_id is not null;

comment on table public.noticias is
  'EN DESUSO desde la migracion 000029: se mudaron a `publicaciones`. Se conserva para poder mirar atras; nadie la lee.';

-- ------------------------------------------------- publicar cuesta una mazorca
-- Ya no hay escalera de rangos para abrir un tema: publica quien quiera, pero a
-- una persona le cuesta **una mazorca**, la misma que puede recuperar si alguien
-- le apoya la publicacion. Es lo que sostiene que las mazorcas signifiquen algo:
-- si publicar fuera gratis, el muro se llenaria sin que nadie visitara un
-- negocio, que es de donde salen.
--
-- Un negocio no junta mazorcas, asi que para el sigue siendo cosa del plan:
-- publicar viene con Premier.
create or replace function public.cobrar_publicacion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  quien public.rol_usuario;
  anio smallint := extract(year from now() at time zone 'America/Mexico_City')::smallint;
  saldo integer;
begin
  select rol into quien from public.perfiles where id = new.autor_id;

  if quien <> 'cliente' then
    return new;
  end if;

  select puntos_acumulados into saldo
    from public.rangos_usuario
   where usuario_id = new.autor_id and rangos_usuario.anio = cobrar_publicacion.anio
     for update;

  if coalesce(saldo, 0) < 1 then
    raise exception 'Publicar cuesta una mazorca de cacao y no te queda ninguna. Visita un negocio y pide las tuyas.';
  end if;

  update public.rangos_usuario
     set puntos_acumulados = puntos_acumulados - 1,
         rango_actual = public.calcular_rango(puntos_acumulados - 1)
   where usuario_id = new.autor_id and rangos_usuario.anio = cobrar_publicacion.anio;

  return new;
end;
$$;

create trigger cobrar_al_publicar
  before insert on public.publicaciones
  for each row execute function public.cobrar_publicacion();

-- La escalera de temas deja de existir: publicar ya no depende del rango.
drop function if exists public.temas_permitidos_de(uuid);
drop function if exists public.temas_permitidos(integer);
drop function if exists public.limitar_temas_por_autor();

-- ------------------------------------------------------------------ politicas
drop policy if exists temas_lectura on public.publicaciones;
drop policy if exists temas_crea_propio on public.publicaciones;
drop policy if exists temas_edita_propio on public.publicaciones;
drop policy if exists temas_borra_propio on public.publicaciones;

-- Una publicacion oculta la sigue viendo su autor —para poder volver a
-- mostrarla— y nadie mas. Igual que con los comentarios ocultos: esconderla en
-- silencio de quien la escribio se lee como que se borro.
create policy publicaciones_lectura on public.publicaciones
  for select
  using (
    oculta_en is null
    or autor_id = (select auth.uid())
    or public.es_admin()
  );

-- Crear: quien firma es quien publica. Para el negocio, ademas, plan que lo
-- incluya; para la persona, el trigger le cobra la mazorca.
create policy publicaciones_crea_propia on public.publicaciones
  for insert
  with check (
    autor_id = (select auth.uid())
    and (
      public.es_cliente()
      or (sucursal_id is not null and public.marca_publica_contenido(sucursal_id))
      or public.es_admin()
    )
  );

create policy publicaciones_edita_propia on public.publicaciones
  for update
  using (autor_id = (select auth.uid()) or public.es_admin())
  with check (autor_id = (select auth.uid()) or public.es_admin());

create policy publicaciones_borra_propia on public.publicaciones
  for delete
  using (autor_id = (select auth.uid()) or public.es_admin());

-- ------------------------------------------------------- comentarios sin ver
-- Que ha visto cada quien de cada publicacion. Una fila por persona y
-- publicacion, con la hora en que la abrio: "hay comentarios nuevos" es que
-- alguno es posterior a esa hora, no un contador que haya que ir corrigiendo.
create table public.vistas_publicacion (
  perfil_id uuid not null references public.perfiles(id) on delete cascade,
  publicacion_id uuid not null references public.publicaciones(id) on delete cascade,
  visto_en timestamptz not null default now(),
  primary key (perfil_id, publicacion_id)
);

alter table public.vistas_publicacion enable row level security;

-- Cada quien escribe y lee solo las suyas: son marcas de lectura, no datos que
-- le importen a nadie mas.
create policy vistas_propias on public.vistas_publicacion
  for all
  using (perfil_id = (select auth.uid()))
  with check (perfil_id = (select auth.uid()));

create index vistas_publicacion_perfil_idx on public.vistas_publicacion (perfil_id);

comment on table public.vistas_publicacion is
  'Cuando abrio cada quien cada publicacion. Lo que marca "comentarios nuevos" es la comparacion con la fecha de los comentarios, no un contador guardado que habria que mantener al dia.';
-- Renombrar tambien las llaves: PostgREST las usa por nombre para desambiguar
-- (`perfiles_publicos!publicaciones_autor_id_fkey`), y dejarlas hablando de
-- temas obligaria a recordar para siempre que la tabla se llamo de otra forma.
alter table public.publicaciones rename constraint temas_foro_autor_id_fkey to publicaciones_autor_id_fkey;
alter table public.comentarios rename constraint comentarios_foro_tema_id_fkey to comentarios_publicacion_id_fkey;
alter table public.comentarios rename constraint comentarios_foro_usuario_id_fkey to comentarios_usuario_id_fkey;
alter table public.apoyos_tema rename constraint apoyos_tema_tema_id_fkey to apoyos_publicacion_id_fkey;

alter table public.publicaciones rename constraint temas_foro_titulo_check to publicaciones_titulo_check;
alter table public.publicaciones rename constraint temas_foro_contenido_check to publicaciones_contenido_check;
alter table public.comentarios rename constraint comentarios_foro_texto_check to comentarios_texto_check;

-- Los apoyos son de una publicacion, no de un tema.
alter table public.apoyos_tema rename to apoyos;
alter table public.apoyos rename column tema_id to publicacion_id;
-- El apoyo mueve una mazorca y ahora habla de publicaciones, no de temas.
-- Es la mazorca que devuelve lo que costo publicar: por eso apoyar sigue
-- costandole una a quien apoya, y no se crea ninguna de la nada.
create or replace function public.mover_moneda_de_apoyo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  autor uuid;
  anio_actual smallint := extract(year from (now() at time zone 'America/Mexico_City'))::smallint;
  restantes integer;
  total integer;
begin
  select p.autor_id into autor
    from public.publicaciones p
   where p.id = new.publicacion_id;

  if autor = new.usuario_id then
    raise exception 'No puedes apoyar tu propia publicacion';
  end if;

  update public.rangos_usuario
     set puntos_acumulados = puntos_acumulados - 1
   where usuario_id = new.usuario_id
     and anio = anio_actual
     and puntos_acumulados >= 1
  returning puntos_acumulados into restantes;

  if restantes is null then
    raise exception 'No tienes mazorcas de cacao para apoyar';
  end if;

  update public.rangos_usuario
     set rango_actual = public.calcular_rango(restantes)
   where usuario_id = new.usuario_id and anio = anio_actual;

  insert into public.rangos_usuario (usuario_id, anio, puntos_acumulados, rango_actual)
  values (autor, anio_actual, 1, public.calcular_rango(1))
  on conflict (usuario_id, anio) do update
    set puntos_acumulados = public.rangos_usuario.puntos_acumulados + 1
  returning puntos_acumulados into total;

  update public.rangos_usuario
     set rango_actual = public.calcular_rango(total)
   where usuario_id = autor and anio = anio_actual;

  return new;
end;
$function$;
