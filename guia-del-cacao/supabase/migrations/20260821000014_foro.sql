-- Guía del Cacao — el foro
--
-- Un espacio de la comunidad, no de los negocios. Abrir un tema cuesta
-- monedas de chocolate acumuladas, asi que hablar aqui es algo que se gana
-- visitando el cacao de Tabasco, que es de lo que va toda la plataforma.
--
--   * Con 50 monedas (Conocedor) se puede abrir 1 tema.
--   * Con 100 (Maestro cacaotero), hasta 3.
--   * Comentar es libre para cualquier cliente, hasta 5 veces por tema. El
--     tope existe para que un tema no se vuelva la conversacion privada de dos.
--   * Cada cliente puede regalarle UNA moneda al autor de un tema. Es la unica
--     forma de ganar monedas sin comprar en un negocio.
--
-- Los cortes de 50 y 100 no se escriben otra vez: salen de calcular_rango, que
-- es donde viven desde el esquema base. Si mañana cambian, cambian ahi solo.

-- ---------------------------------------------------------------------------
-- Cuantos temas puede tener alguien, segun lo que lleva juntado
-- ---------------------------------------------------------------------------

create or replace function public.temas_permitidos(monedas integer)
returns integer
language sql
immutable
as $fn$
  select case public.calcular_rango(coalesce(monedas, 0))
    when 4 then 3  -- Maestro cacaotero
    when 3 then 1  -- Conocedor
    else 0
  end;
$fn$;

comment on function public.temas_permitidos is
  'Cuantos temas de foro puede tener abiertos alguien con esas monedas. Se apoya en calcular_rango para no repetir los cortes de la escalera.';

/** Las monedas del año en curso de una persona. */
create or replace function public.monedas_de(p_usuario uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $fn$
  select coalesce(
    (select r.puntos_acumulados
       from public.rangos_usuario r
      where r.usuario_id = p_usuario
        and r.anio = extract(year from (now() at time zone 'America/Mexico_City'))::smallint),
    0
  );
$fn$;

-- ---------------------------------------------------------------------------
-- Temas
-- ---------------------------------------------------------------------------

create table public.temas_foro (
  id uuid primary key default gen_random_uuid(),
  autor_id uuid not null references public.perfiles (id) on delete cascade,
  titulo text not null check (length(btrim(titulo)) between 5 and 120),
  contenido text not null check (length(btrim(contenido)) between 10 and 3000),
  fecha timestamptz not null default now(),
  fecha_edicion timestamptz
);

create index temas_foro_fecha_idx on public.temas_foro (fecha desc);
create index temas_foro_autor_idx on public.temas_foro (autor_id);

create or replace function public.limitar_temas_por_autor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  monedas integer := public.monedas_de(new.autor_id);
  permitidos integer := public.temas_permitidos(monedas);
  abiertos integer;
begin
  if permitidos = 0 then
    raise exception 'Hacen falta 50 monedas de chocolate para abrir un tema (llevas %)', monedas;
  end if;

  select count(*) into abiertos
    from public.temas_foro t
   where t.autor_id = new.autor_id
     and t.id <> new.id;

  if abiertos >= permitidos then
    raise exception 'Ya tienes % de los % temas que puedes abrir', abiertos, permitidos;
  end if;

  return new;
end;
$fn$;

create trigger limitar_temas_al_crear
  before insert on public.temas_foro
  for each row execute function public.limitar_temas_por_autor();

-- ---------------------------------------------------------------------------
-- Comentarios del foro
-- ---------------------------------------------------------------------------

-- Aqui si se puede conversar —hasta 5 veces por tema—, a diferencia de los
-- comentarios de una noticia, que son uno solo. Son dos tablas distintas por
-- eso: mismas palabras, reglas opuestas.
create table public.comentarios_foro (
  id uuid primary key default gen_random_uuid(),
  tema_id uuid not null references public.temas_foro (id) on delete cascade,
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  texto text not null check (length(btrim(texto)) between 2 and 1000),
  oculto boolean not null default false,
  fecha timestamptz not null default now(),
  fecha_edicion timestamptz
);

create index comentarios_foro_tema_idx on public.comentarios_foro (tema_id, fecha);
create index comentarios_foro_usuario_idx on public.comentarios_foro (usuario_id);

create or replace function public.limitar_comentarios_de_foro()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  ya_lleva integer;
begin
  select count(*) into ya_lleva
    from public.comentarios_foro c
   where c.tema_id = new.tema_id
     and c.usuario_id = new.usuario_id
     and c.id <> new.id;

  if ya_lleva >= 5 then
    raise exception 'Ya dejaste tus 5 comentarios en este tema';
  end if;

  return new;
end;
$fn$;

create trigger limitar_comentarios_al_crear
  before insert on public.comentarios_foro
  for each row execute function public.limitar_comentarios_de_foro();

-- ---------------------------------------------------------------------------
-- Apoyos: una moneda de cada quien, para el autor del tema
-- ---------------------------------------------------------------------------

-- La llave primaria es la regla: una sola vez por persona y por tema.
create table public.apoyos_tema (
  tema_id uuid not null references public.temas_foro (id) on delete cascade,
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  fecha timestamptz not null default now(),
  primary key (tema_id, usuario_id)
);

create index apoyos_tema_idx on public.apoyos_tema (tema_id);

/**
 * Mueve la moneda de quien apoya a quien escribio el tema.
 *
 * Es una transferencia, no una moneda nueva: quien apoya se queda con una
 * menos. Si el sistema regalara monedas, un tema con cien apoyos crearia cien
 * monedas de la nada y el rango dejaria de significar "cuanto visitaste".
 *
 * Los dos rangos se recalculan, porque la transferencia puede subir a uno y
 * bajar al otro de escalon.
 */
create or replace function public.mover_moneda_de_apoyo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  autor uuid;
  anio_actual smallint := extract(year from (now() at time zone 'America/Mexico_City'))::smallint;
  restantes integer;
  total integer;
begin
  select t.autor_id into autor from public.temas_foro t where t.id = new.tema_id;

  if autor = new.usuario_id then
    raise exception 'No puedes apoyar tu propio tema';
  end if;

  update public.rangos_usuario
     set puntos_acumulados = puntos_acumulados - 1
   where usuario_id = new.usuario_id
     and anio = anio_actual
     and puntos_acumulados >= 1
  returning puntos_acumulados into restantes;

  if restantes is null then
    raise exception 'No tienes monedas de chocolate para apoyar';
  end if;

  update public.rangos_usuario
     set rango_actual = public.calcular_rango(restantes)
   where usuario_id = new.usuario_id
     and anio = anio_actual;

  insert into public.rangos_usuario (usuario_id, anio, puntos_acumulados, rango_actual)
  values (autor, anio_actual, 1, public.calcular_rango(1))
  on conflict (usuario_id, anio) do update
    set puntos_acumulados = public.rangos_usuario.puntos_acumulados + 1
  returning puntos_acumulados into total;

  update public.rangos_usuario
     set rango_actual = public.calcular_rango(total)
   where usuario_id = autor
     and anio = anio_actual;

  return new;
end;
$fn$;

create trigger mover_moneda_al_apoyar
  after insert on public.apoyos_tema
  for each row execute function public.mover_moneda_de_apoyo();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.temas_foro enable row level security;
alter table public.comentarios_foro enable row level security;
alter table public.apoyos_tema enable row level security;

grant select on public.temas_foro, public.comentarios_foro, public.apoyos_tema
  to anon, authenticated;
grant insert, update, delete on public.temas_foro, public.comentarios_foro to authenticated;
grant insert on public.apoyos_tema to authenticated;

-- El foro se lee sin cuenta: es parte de lo que hace atractivo registrarse.
create policy temas_lectura on public.temas_foro for select using (true);

create policy temas_crea_propio on public.temas_foro
  for insert with check (
    autor_id = (select auth.uid())
    and public.es_cliente()
  );

create policy temas_edita_propio on public.temas_foro
  for update using (autor_id = (select auth.uid()) or public.es_admin())
  with check (autor_id = (select auth.uid()) or public.es_admin());

create policy temas_borra_propio on public.temas_foro
  for delete using (autor_id = (select auth.uid()) or public.es_admin());

-- Un comentario oculto lo sigue viendo quien lo escribio, igual que en las
-- publicaciones. Aqui quien oculta es el autor del tema: es su conversacion.
create policy comentarios_foro_lectura on public.comentarios_foro
  for select using (
    not oculto
    or usuario_id = (select auth.uid())
    or public.es_admin()
    or exists (
      select 1 from public.temas_foro t
       where t.id = tema_id and t.autor_id = (select auth.uid())
    )
  );

create policy comentarios_foro_crea on public.comentarios_foro
  for insert with check (
    usuario_id = (select auth.uid())
    and public.es_cliente()
  );

create policy comentarios_foro_edita on public.comentarios_foro
  for update using (
    usuario_id = (select auth.uid())
    or public.es_admin()
    or exists (
      select 1 from public.temas_foro t
       where t.id = tema_id and t.autor_id = (select auth.uid())
    )
  )
  with check (
    usuario_id = (select auth.uid())
    or public.es_admin()
    or exists (
      select 1 from public.temas_foro t
       where t.id = tema_id and t.autor_id = (select auth.uid())
    )
  );

create policy comentarios_foro_borra on public.comentarios_foro
  for delete using (usuario_id = (select auth.uid()) or public.es_admin());

create or replace function public.proteger_comentario_foro()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  soy_el_autor boolean := new.usuario_id = (select auth.uid());
begin
  if (select auth.uid()) is not null
     and not soy_el_autor
     and not public.es_admin()
     and new.texto is distinct from old.texto
  then
    raise exception 'El dueno del tema puede ocultar un comentario, no reescribirlo';
  end if;

  if soy_el_autor
     and not public.es_admin()
     and new.oculto is distinct from old.oculto
  then
    raise exception 'Solo quien abrio el tema o un administrador pueden ocultar un comentario';
  end if;

  if new.texto is distinct from old.texto then
    new.fecha_edicion := now();
  end if;

  return new;
end;
$fn$;

create trigger al_actualizar_comentario_foro
  before update on public.comentarios_foro
  for each row execute function public.proteger_comentario_foro();

-- Quien apoyo a quien es publico: es lo que deja enseñar "12 personas apoyaron
-- este tema" sin una consulta privilegiada.
create policy apoyos_lectura on public.apoyos_tema for select using (true);

create policy apoyos_crea_propio on public.apoyos_tema
  for insert with check (
    usuario_id = (select auth.uid())
    and public.es_cliente()
  );

-- Sin politica de DELETE a proposito: una moneda regalada no se devuelve. Si
-- se pudiera, habria que decidir que pasa cuando el autor ya la gasto.

-- ---------------------------------------------------------------------------
-- El conteo, ya hecho
-- ---------------------------------------------------------------------------

-- security_invoker para que respete la politica de los comentarios: los
-- ocultos no deben contar para quien no los puede ver.
create view public.temas_foro_resumen
  with (security_invoker = true)
  as select t.id as tema_id,
            (select count(*) from public.comentarios_foro c where c.tema_id = t.id) as comentarios,
            (select count(*) from public.apoyos_tema a where a.tema_id = t.id) as apoyos
       from public.temas_foro t;

grant select on public.temas_foro_resumen to anon, authenticated;
