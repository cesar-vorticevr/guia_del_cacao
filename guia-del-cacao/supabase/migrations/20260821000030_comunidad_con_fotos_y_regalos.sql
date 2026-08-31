-- La comunidad, con cara: fotos, respuestas y mazorcas de regalo.
--
-- Tres cosas que iban juntas y por eso van en la misma migracion:
--
--   1. Una publicacion lleva **de una a cuatro fotos**. Sin foto el muro era una
--      lista de parrafos y nadie se paraba a leerlos.
--   2. Un comentario puede **responder a otro**, un nivel. Un negocio tenia que
--      contestar en un comentario suelto y no se sabia a quien.
--   3. Se pueden **regalar mazorcas**, tanto a quien publica como a quien
--      comenta, de una bolsa diaria que pone la plataforma.

-- ---------------------------------------------------------------- las fotos
-- Entre una y cuatro. El tope no es capricho: cinco ya no caben en la retícula
-- del detalle sin que la última quede huérfana en su fila.
--
-- El mínimo no se exige en las que ya existen: las doce de antes se publicaron
-- cuando no había fotos, y rechazarlas ahora sería obligar a editarlas para
-- poder tocar cualquier otra cosa. El `check` mira solo lo que se escribe de
-- aquí en adelante — por eso es `not valid` y no se valida hacia atrás.
alter table public.publicaciones
  add constraint publicaciones_fotos_check
  check (cardinality(imagenes) between 1 and 4)
  not valid;

comment on constraint publicaciones_fotos_check on public.publicaciones is
  'De una a cuatro fotos. NOT VALID a proposito: las publicaciones anteriores a la migracion 000030 no tienen ninguna y no se les inventa.';

-- ----------------------------------------------------------- las respuestas
-- Un nivel y no un arbol: dos niveles ya obligan a sangrar sangrados y en un
-- celular la cuarta respuesta sale en una columna de tres palabras.
alter table public.comentarios
  add column responde_a uuid references public.comentarios(id) on delete cascade;

create index comentarios_responde_idx on public.comentarios (responde_a);

comment on column public.comentarios.responde_a is
  'El comentario al que contesta, si contesta a alguno. Un solo nivel: una respuesta a una respuesta se guarda colgando del comentario de arriba.';

-- Una respuesta cuelga siempre de un comentario de la misma publicacion, y
-- nunca de otra respuesta: eso es lo que mantiene el hilo en un nivel.
create or replace function public.aplanar_respuesta()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  padre_publicacion uuid;
  padre_responde_a uuid;
begin
  if new.responde_a is null then
    return new;
  end if;

  select c.publicacion_id, c.responde_a
    into padre_publicacion, padre_responde_a
    from public.comentarios c
   where c.id = new.responde_a;

  if padre_publicacion is null then
    raise exception 'Ese comentario ya no existe';
  end if;

  if padre_publicacion <> new.publicacion_id then
    raise exception 'No se puede responder a un comentario de otra publicacion';
  end if;

  -- Responder a una respuesta cuelga del mismo comentario de arriba, en vez de
  -- abrir un nivel mas. Asi la conversacion se lee de corrido.
  if padre_responde_a is not null then
    new.responde_a := padre_responde_a;
  end if;

  return new;
end;
$$;

create trigger aplanar_al_responder
  before insert on public.comentarios
  for each row execute function public.aplanar_respuesta();

-- Y el tope de cinco por persona deja de contar las respuestas: contestar a
-- quien te contesta no es "comentar otra vez", y con el tope viejo una
-- conversacion de ida y vuelta se quedaba a medias.
create or replace function public.limitar_comentarios_de_foro()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ya_lleva integer;
begin
  if new.responde_a is not null then
    return new;
  end if;

  select count(*) into ya_lleva
    from public.comentarios c
   where c.publicacion_id = new.publicacion_id
     and c.usuario_id = new.usuario_id
     and c.responde_a is null
     and c.id <> new.id;

  if ya_lleva >= 5 then
    raise exception 'Ya dejaste tus 5 comentarios en esta publicacion';
  end if;

  return new;
end;
$$;

-- ------------------------------------------------------------- los regalos
-- Cinco mazorcas al dia, que pone la plataforma, para repartir en la comunidad.
--
-- Es a proposito que **no salgan del saldo de quien regala**: apoyar costaba una
-- mazorca propia y por eso casi nadie apoyaba —quien las junta visitando no las
-- quiere gastar—. La bolsa diaria las hace baratas de dar y caras de acumular:
-- caducan cada noche, asi que la unica forma de aprovecharlas es usarlas.
--
-- El tope de una por persona y dia es lo que impide vaciar las cinco en el mismo
-- amigo, que convertiria el contador de mazorcas en un club de dos.
create table public.regalos_mazorca (
  id uuid primary key default gen_random_uuid(),
  de_perfil uuid not null references public.perfiles(id) on delete cascade,
  a_perfil uuid not null references public.perfiles(id) on delete cascade,
  publicacion_id uuid references public.publicaciones(id) on delete set null,
  comentario_id uuid references public.comentarios(id) on delete set null,
  -- El dia en hora de Tabasco, guardado: calcularlo en cada consulta obligaria
  -- a un indice sobre una expresion con zona horaria, que no es inmutable.
  dia date not null default (now() at time zone 'America/Mexico_City')::date,
  fecha timestamptz not null default now()
);

-- Una por persona y por dia, sea en la publicacion o en un comentario suyo.
create unique index regalo_uno_por_persona_al_dia
  on public.regalos_mazorca (de_perfil, a_perfil, dia);

create index regalos_del_dia_idx on public.regalos_mazorca (de_perfil, dia);
create index regalos_recibidos_idx on public.regalos_mazorca (a_perfil);

alter table public.regalos_mazorca enable row level security;

comment on table public.regalos_mazorca is
  'Las mazorcas que la plataforma regala cada dia para repartir en la comunidad: cinco por cuenta y dia, y como maximo una a la misma persona. No salen del saldo de quien regala; si suman al de quien recibe.';

-- Cuantas le quedan hoy a alguien por repartir.
create or replace function public.regalos_que_me_quedan(p_perfil uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select 5 - count(*)::integer
    from public.regalos_mazorca r
   where r.de_perfil = p_perfil
     and r.dia = (now() at time zone 'America/Mexico_City')::date;
$$;

create or replace function public.acreditar_regalo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  anio_actual smallint := extract(year from (now() at time zone 'America/Mexico_City'))::smallint;
  total integer;
begin
  if new.de_perfil = new.a_perfil then
    raise exception 'No puedes regalarte una mazorca a ti mismo';
  end if;

  if public.regalos_que_me_quedan(new.de_perfil) < 1 then
    raise exception 'Ya repartiste tus 5 mazorcas de hoy. Manana tienes otras cinco';
  end if;

  insert into public.rangos_usuario (usuario_id, anio, puntos_acumulados, rango_actual)
  values (new.a_perfil, anio_actual, 1, public.calcular_rango(1))
  on conflict (usuario_id, anio) do update
    set puntos_acumulados = public.rangos_usuario.puntos_acumulados + 1
  returning puntos_acumulados into total;

  update public.rangos_usuario
     set rango_actual = public.calcular_rango(total)
   where usuario_id = new.a_perfil and anio = anio_actual;

  return new;
end;
$$;

create trigger acreditar_al_regalar
  before insert on public.regalos_mazorca
  for each row execute function public.acreditar_regalo();

-- Quien regala escribe lo suyo; quien recibe puede verlo. Nadie edita ni borra
-- un regalo: una mazorca dada no se quita.
create policy regalos_lectura on public.regalos_mazorca
  for select
  using (de_perfil = (select auth.uid()) or a_perfil = (select auth.uid()) or public.es_admin());

create policy regalos_crea_propio on public.regalos_mazorca
  for insert
  with check (de_perfil = (select auth.uid()));

-- --------------------------------------------- lo que ya recibio hoy alguien
-- Para el panel de solicitudes: si esa persona ya llego a sus 3 mazorcas del dia
-- en esta marca, los botones no deben dejar dar mas. La regla ya existia en
-- `acreditar_puntos`, pero solo saltaba al pulsar; esto permite decirlo antes.
create or replace function public.mazorcas_dadas_hoy(p_usuario uuid, p_marca uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(sp.puntos_otorgados), 0)::integer
    from public.solicitudes_puntos sp
    join public.sucursales s on s.id = sp.sucursal_id
   where sp.usuario_id = p_usuario
     and s.marca_id = p_marca
     and sp.estado = 'aprobada'
     and (sp.fecha_resolucion at time zone 'America/Mexico_City')::date
         = (now() at time zone 'America/Mexico_City')::date;
$$;

comment on function public.mazorcas_dadas_hoy(uuid, uuid) is
  'Cuantas mazorcas lleva hoy esa persona en esta marca (tope 3, spec 5.4.6). Existe para poder avisarlo antes de pulsar, no solo cuando el trigger rechaza.';
-- El bucket de la comunidad.
--
-- Aparte de `micrositios` y `resenas` porque en cada uno escribe alguien
-- distinto: aquí escribe cualquiera con cuenta, sea cliente o negocio, y una
-- sola política tendría que dejar entrar a los tres a los tres sitios.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('comunidad', 'comunidad', true, 5242880,
        array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do nothing;

-- La primera carpeta es de quien sube, igual que en reseñas: es la llave que
-- impide escribir en la carpeta de otro.
create or replace function public.es_su_carpeta_de_comunidad(ruta text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid())::text = (storage.foldername(ruta))[1];
$$;

drop policy if exists "comunidad lectura publica" on storage.objects;
create policy "comunidad lectura publica" on storage.objects
  for select using (bucket_id = 'comunidad');

drop policy if exists "comunidad alta propia" on storage.objects;
create policy "comunidad alta propia" on storage.objects
  for insert
  with check (bucket_id = 'comunidad' and public.es_su_carpeta_de_comunidad(name));

drop policy if exists "comunidad borrado propio" on storage.objects;
create policy "comunidad borrado propio" on storage.objects
  for delete
  using (bucket_id = 'comunidad' and (public.es_su_carpeta_de_comunidad(name) or public.es_admin()));
-- La vista de conteos seguía llamando `tema_id` a su llave, y el código ya pide
-- `publicacion_id`: la consulta volvía vacía y los contadores salían en cero.
drop view if exists public.temas_foro_resumen;

create view public.publicaciones_resumen
with (security_invoker = true)
as
select p.id as publicacion_id,
       (select count(*) from public.comentarios c where c.publicacion_id = p.id) as comentarios,
       (select count(*) from public.apoyos a where a.publicacion_id = p.id) as apoyos,
       (select count(*) from public.regalos_mazorca r where r.publicacion_id = p.id) as regalos
  from public.publicaciones p;

comment on view public.publicaciones_resumen is
  'Comentarios, apoyos y mazorcas regaladas de cada publicacion. Con security_invoker: un comentario oculto no debe sumar para quien no lo ve.';
