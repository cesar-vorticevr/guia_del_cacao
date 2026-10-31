-- El buzon: conversaciones entre cuentas.
--
-- Cada cuenta —cliente, negocio, administrador, ventas— tiene un buzon donde
-- le escribe a otra y la otra contesta. Cuatro reglas que decide la base:
--
-- 1. **Nada se borra.** No hay politica de DELETE en ninguna de las tablas y
--    ademas se les quita el permiso: la ausencia es la regla, como en
--    `canjes` o `calificaciones`. Tampoco se editan: un mensaje es lo que se
--    dijo. Si algo amerita moderacion, se reporta.
-- 2. **Cada quien ve solo sus conversaciones.** El administrador las puede
--    leer para moderar, pero no escribir en las ajenas. Y como RLS autoriza
--    y no acota, el buzon del administrador filtra las suyas a mano
--    (`mis_conversaciones()` lo hace por el).
-- 3. **A quien se le puede escribir primero** lo decide `puede_escribirle`:
--    a un negocio, a la administracion y a un asesor de ventas, cualquiera;
--    el administrador, a cualquiera. A un cliente nadie le escribe en frio:
--    contestarle si, siempre que el haya escrito. Un buscador de toda la
--    gente del sitio es por donde entra el spam (AGENTS.md lo dice de las
--    menciones, y aqui vale igual).
-- 4. **El aviso de mensaje nuevo lo escribe un trigger**, porque en
--    `notificaciones` no hay politica de INSERT, y solo a quien lo pidio
--    (`perfiles.avisar_mensajes`, que el negocio enciende en su cuenta).
--
-- **Las llaves apuntan a `auth.users`, no a `perfiles`**, igual que `giros` y
-- `reportes_resena`: una llave a perfiles abriria otro camino de embeds hacia
-- `perfiles_publicos` y PostgREST responderia PGRST201. Los nombres salen por
-- funciones (`mis_conversaciones`, `participantes_de`).

-- ---------------------------------------------------------------- preferencia
alter table public.perfiles
  add column if not exists avisar_mensajes boolean not null default false;

comment on column public.perfiles.avisar_mensajes is
  'Si se le deja un aviso en notificaciones cuando le llega un mensaje al buzon. Ver migracion 000069.';

alter table public.notificaciones drop constraint notificaciones_tipo_check;
alter table public.notificaciones
  add constraint notificaciones_tipo_check
  check (tipo in ('resena', 'solicitud', 'canje', 'mensaje'));

-- ---------------------------------------------------------------- tablas
create table if not exists public.conversaciones (
  id                uuid primary key default gen_random_uuid(),
  iniciada_por      uuid not null references auth.users (id) on delete cascade,
  para              uuid not null references auth.users (id) on delete cascade,
  creada_en         timestamptz not null default now(),
  ultimo_mensaje_en timestamptz not null default now(),
  check (iniciada_por <> para)
);

comment on table public.conversaciones is
  'Una conversacion entre dos cuentas. Una por pareja: escribir otra vez retoma la misma. No se borra. Ver migracion 000069.';

-- Una por pareja, sin importar quien empezo: si el negocio le contesta a un
-- cliente desde «Nuevo mensaje», cae en la que ya tenian.
create unique index if not exists conversaciones_pareja_idx
  on public.conversaciones (least(iniciada_por, para), greatest(iniciada_por, para));
create index if not exists conversaciones_para_idx on public.conversaciones (para);

create table if not exists public.mensajes (
  id              uuid primary key default gen_random_uuid(),
  conversacion_id uuid not null references public.conversaciones (id) on delete cascade,
  autor_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  texto           text not null check (char_length(btrim(texto)) between 1 and 2000),
  creado_en       timestamptz not null default now()
);

create index if not exists mensajes_conversacion_idx
  on public.mensajes (conversacion_id, creado_en);

comment on table public.mensajes is
  'Los mensajes del buzon. No se editan ni se borran. Ver migracion 000069.';

-- Hasta cuando leyo cada quien cada conversacion. «Sin leer» se deriva de
-- aqui —los mensajes ajenos posteriores—, no de un contador: un contador
-- habria que corregirlo en cada mensaje y en cada visita, y basta con que
-- falle una vez para que mienta para siempre (como `vistas_publicacion`).
create table if not exists public.lecturas_conversacion (
  conversacion_id uuid not null references public.conversaciones (id) on delete cascade,
  usuario_id      uuid not null references auth.users (id) on delete cascade,
  leida_en        timestamptz not null default now(),
  primary key (conversacion_id, usuario_id)
);

create table if not exists public.reportes_conversacion (
  id              uuid primary key default gen_random_uuid(),
  conversacion_id uuid not null references public.conversaciones (id) on delete cascade,
  -- Null = se reporta la conversacion entera; si no, ese mensaje.
  mensaje_id      uuid references public.mensajes (id) on delete cascade,
  usuario_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  motivo          text not null check (motivo in ('ofensivo', 'acoso', 'spam', 'fraude', 'otro')),
  detalle         text check (char_length(detalle) <= 500),
  creado_en       timestamptz not null default now(),
  -- Lo marca el administrador al revisarlo. No se borra: queda la constancia
  -- de que alguien lo señalo y de que se miro.
  atendido_en     timestamptz,
  atendido_por    uuid references auth.users (id) on delete set null
);

comment on table public.reportes_conversacion is
  'Reportes de conversaciones o mensajes del buzon para el administrador. Ver migracion 000069.';

-- Uno pendiente por persona y por cosa reportada. Ya atendido, se puede
-- volver a reportar: si sigue pasando, vuelve a la cola.
create unique index if not exists reportes_conversacion_pendiente_idx
  on public.reportes_conversacion (
    usuario_id, conversacion_id,
    coalesce(mensaje_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where atendido_en is null;

-- ---------------------------------------------------------------- permisos
-- Sin DELETE ni UPDATE para nadie desde la API: lo que se escribe aqui se
-- queda. Lo que cambia (la hora del ultimo mensaje, la lectura, atender un
-- reporte) lo hacen triggers y funciones security definer.
revoke all on public.conversaciones, public.mensajes,
              public.lecturas_conversacion, public.reportes_conversacion
  from anon, authenticated;
grant select on public.conversaciones, public.mensajes,
                public.lecturas_conversacion, public.reportes_conversacion
  to authenticated;
grant insert on public.mensajes, public.reportes_conversacion to authenticated;

alter table public.conversaciones enable row level security;
alter table public.mensajes enable row level security;
alter table public.lecturas_conversacion enable row level security;
alter table public.reportes_conversacion enable row level security;

/** Si quien mira es una de las dos partes. Definer para no recursar en RLS. */
create or replace function public.en_conversacion(p_conversacion uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.conversaciones c
     where c.id = p_conversacion
       and (select auth.uid()) in (c.iniciada_por, c.para)
  );
$$;

revoke all on function public.en_conversacion(uuid) from public, anon;
grant execute on function public.en_conversacion(uuid) to authenticated;

drop policy if exists conversaciones_lectura on public.conversaciones;
create policy conversaciones_lectura on public.conversaciones
  for select to authenticated
  using ((select auth.uid()) in (iniciada_por, para) or public.es_admin());

drop policy if exists mensajes_lectura on public.mensajes;
create policy mensajes_lectura on public.mensajes
  for select to authenticated
  using (public.en_conversacion(conversacion_id) or public.es_admin());

-- Escribe una de las dos partes y a su nombre. El administrador lee las
-- ajenas para moderar, pero no habla por nadie en ellas.
drop policy if exists mensajes_escribe_participante on public.mensajes;
create policy mensajes_escribe_participante on public.mensajes
  for insert to authenticated
  with check (autor_id = (select auth.uid()) and public.en_conversacion(conversacion_id));

drop policy if exists lecturas_propias on public.lecturas_conversacion;
create policy lecturas_propias on public.lecturas_conversacion
  for select to authenticated
  using (usuario_id = (select auth.uid()));

-- Lo ve quien reporto y el administrador. La otra parte no sabe que la
-- reportaron, igual que con las resenas.
drop policy if exists reportes_conversacion_lectura on public.reportes_conversacion;
create policy reportes_conversacion_lectura on public.reportes_conversacion
  for select to authenticated
  using (usuario_id = (select auth.uid()) or public.es_admin());

drop policy if exists reportes_conversacion_crea on public.reportes_conversacion;
create policy reportes_conversacion_crea on public.reportes_conversacion
  for insert to authenticated
  with check (usuario_id = (select auth.uid()) and public.en_conversacion(conversacion_id));

-- ---------------------------------------------------------------- quien es quien
/**
 * Como se presenta una cuenta en el buzon: el negocio con el nombre de su
 * marca (primero la marca, como en todo el sitio), el administrador como «Guia
 * del Cacao», un asesor de ventas con su nombre y su cargo, y una persona con
 * su nombre. Interna: la usan las funciones de abajo.
 */
create or replace function public.cuenta_en_buzon(p_usuario uuid, out nombre text, out tipo text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  rol text;
  persona text;
  marca text;
begin
  select p.rol::text, p.nombre into rol, persona from public.perfiles p where p.id = p_usuario;

  if rol = 'admin' then
    nombre := 'Guía del Cacao';
    tipo := 'guia';
    return;
  end if;

  if rol = 'negocio' then
    select m.nombre_comercial into marca
      from public.marcas m where m.perfil_id = p_usuario
     order by m.fecha_registro nulls last limit 1;
    if marca is not null then
      nombre := marca;
      tipo := 'negocio';
      return;
    end if;
  end if;

  if exists (
    select 1 from public.embajadores e
     where e.perfil_id = p_usuario and e.estado in ('activo', 'pausado')
  ) then
    nombre := coalesce(persona, 'Asesor');
    tipo := 'ventas';
    return;
  end if;

  nombre := coalesce(persona, 'Alguien');
  tipo := case when rol = 'negocio' then 'negocio' else 'persona' end;
end;
$$;

revoke all on function public.cuenta_en_buzon(uuid) from public, anon, authenticated;

/**
 * Si quien mira puede abrirle una conversacion nueva a esta cuenta.
 *
 * Contestar no pasa por aqui: una conversacion que ya existe se retoma
 * siempre. Esto es solo para escribir en frio.
 */
create or replace function public.puede_escribirle(p_destino uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
     and p_destino <> (select auth.uid())
     and exists (select 1 from public.perfiles p where p.id = p_destino)
     and (
       public.es_admin()
       or exists (
         select 1 from public.perfiles p
          where p.id = p_destino and p.rol in ('admin', 'negocio')
       )
       or exists (
         select 1 from public.embajadores e
          where e.perfil_id = p_destino and e.estado in ('activo', 'pausado')
       )
     );
$$;

revoke all on function public.puede_escribirle(uuid) from public, anon;
grant execute on function public.puede_escribirle(uuid) to authenticated;

-- ---------------------------------------------------------------- abrir
/**
 * Abre (o retoma) la conversacion con una cuenta y devuelve su id. Es la
 * unica manera de crear una: no hay politica de INSERT en `conversaciones`.
 */
create or replace function public.abrir_conversacion(p_destino uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  yo uuid := (select auth.uid());
  conversacion uuid;
begin
  if yo is null then
    raise exception 'Entra a tu cuenta para escribir.';
  end if;

  if p_destino is null or p_destino = yo then
    raise exception 'No puedes escribirte a ti mismo.';
  end if;

  select c.id into conversacion
    from public.conversaciones c
   where least(c.iniciada_por, c.para) = least(yo, p_destino)
     and greatest(c.iniciada_por, c.para) = greatest(yo, p_destino);

  if conversacion is not null then
    return conversacion;
  end if;

  if not public.puede_escribirle(p_destino) then
    raise exception 'A esta cuenta no se le puede escribir primero: solo contestar si te escribe.';
  end if;

  insert into public.conversaciones (iniciada_por, para)
  values (yo, p_destino)
  on conflict do nothing
  returning id into conversacion;

  -- Dos clics a la vez: el segundo choca con el indice y se queda con la del
  -- primero.
  if conversacion is null then
    select c.id into conversacion
      from public.conversaciones c
     where least(c.iniciada_por, c.para) = least(yo, p_destino)
       and greatest(c.iniciada_por, c.para) = greatest(yo, p_destino);
  end if;

  return conversacion;
end;
$$;

revoke all on function public.abrir_conversacion(uuid) from public, anon;
grant execute on function public.abrir_conversacion(uuid) to authenticated;

/** «Escribir al negocio» desde su micrositio: le escribe al dueno de la marca. */
create or replace function public.abrir_conversacion_con_marca(p_marca uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  duenio uuid;
begin
  select m.perfil_id into duenio from public.marcas m where m.id = p_marca;

  if duenio is null then
    raise exception 'Ese negocio no existe.';
  end if;

  if duenio = (select auth.uid()) then
    raise exception 'Es tu propio negocio.';
  end if;

  return public.abrir_conversacion(duenio);
end;
$$;

revoke all on function public.abrir_conversacion_con_marca(uuid) from public, anon;
grant execute on function public.abrir_conversacion_con_marca(uuid) to authenticated;

-- ---------------------------------------------------------------- al escribir
create or replace function public.al_escribir_mensaje()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- La hora la pone la base: mandarla desde fuera dejaria escribir en el
  -- pasado y desordenar la conversacion. `clock_timestamp()` y no `now()`:
  -- `now()` es la hora de la transaccion, y dos mensajes (o un mensaje y la
  -- lectura de quien contesta) empatarian y «sin leer» se perderia.
  new.creado_en := clock_timestamp();
  new.texto := btrim(new.texto);
  return new;
end;
$$;

drop trigger if exists al_escribir_mensaje_1_hora on public.mensajes;
create trigger al_escribir_mensaje_1_hora
  before insert on public.mensajes
  for each row execute function public.al_escribir_mensaje();

create or replace function public.despues_de_escribir_mensaje()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  destino uuid;
  quiere boolean;
  quien text;
begin
  update public.conversaciones
     set ultimo_mensaje_en = new.creado_en
   where id = new.conversacion_id
  returning case when iniciada_por = new.autor_id then para else iniciada_por end
    into destino;

  -- Quien escribe ya leyo hasta aqui.
  insert into public.lecturas_conversacion (conversacion_id, usuario_id, leida_en)
  values (new.conversacion_id, new.autor_id, new.creado_en)
  on conflict (conversacion_id, usuario_id) do update set leida_en = excluded.leida_en;

  select p.avisar_mensajes into quiere from public.perfiles p where p.id = destino;

  -- Un aviso por conversacion mientras no lo lea: diez mensajes seguidos no
  -- son diez avisos.
  if coalesce(quiere, false) and not exists (
    select 1 from public.notificaciones n
     where n.perfil_id = destino
       and n.tipo = 'mensaje'
       and n.enlace = '/buzon/' || new.conversacion_id
       and not n.leida
  ) then
    select b.nombre into quien from public.cuenta_en_buzon(new.autor_id) b;

    insert into public.notificaciones (perfil_id, tipo, titulo, detalle, enlace)
    values (
      destino,
      'mensaje',
      coalesce(quien, 'Alguien') || ' te escribió',
      left(new.texto, 140),
      '/buzon/' || new.conversacion_id
    );
  end if;

  return new;
end;
$$;

drop trigger if exists al_escribir_mensaje_2_aviso on public.mensajes;
create trigger al_escribir_mensaje_2_aviso
  after insert on public.mensajes
  for each row execute function public.despues_de_escribir_mensaje();

-- ---------------------------------------------------------------- leer
/** Deja constancia de que quien mira ya leyo la conversacion, y apaga su aviso. */
create or replace function public.marcar_conversacion_leida(p_conversacion uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  yo uuid := (select auth.uid());
begin
  if not public.en_conversacion(p_conversacion) then
    return;
  end if;

  insert into public.lecturas_conversacion (conversacion_id, usuario_id, leida_en)
  values (p_conversacion, yo, clock_timestamp())
  on conflict (conversacion_id, usuario_id) do update set leida_en = excluded.leida_en;

  update public.notificaciones
     set leida = true
   where perfil_id = yo
     and tipo = 'mensaje'
     and enlace = '/buzon/' || p_conversacion
     and not leida;
end;
$$;

revoke all on function public.marcar_conversacion_leida(uuid) from public, anon;
grant execute on function public.marcar_conversacion_leida(uuid) to authenticated;

/**
 * El buzon de quien mira: sus conversaciones con al menos un mensaje, la mas
 * reciente arriba, con quien es la otra parte y cuantos mensajes no ha leido.
 *
 * Filtra por `auth.uid()` aunque RLS deje pasar mas: el administrador puede
 * leerlas todas, y su buzon no debe enseñarle las de los demas.
 */
create or replace function public.mis_conversaciones()
returns table (
  id uuid,
  otro_id uuid,
  otro_nombre text,
  otro_tipo text,
  ultimo_texto text,
  ultimo_es_mio boolean,
  ultimo_mensaje_en timestamptz,
  sin_leer integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with mias as (
    select c.id,
           case when c.iniciada_por = (select auth.uid()) then c.para else c.iniciada_por end as otro,
           c.ultimo_mensaje_en
      from public.conversaciones c
     where (select auth.uid()) in (c.iniciada_por, c.para)
  )
  select m.id,
         m.otro,
         b.nombre,
         b.tipo,
         u.texto,
         u.autor_id = (select auth.uid()),
         m.ultimo_mensaje_en,
         (select count(*)::integer
            from public.mensajes x
           where x.conversacion_id = m.id
             and x.autor_id <> (select auth.uid())
             and x.creado_en > coalesce(
               (select l.leida_en from public.lecturas_conversacion l
                 where l.conversacion_id = m.id and l.usuario_id = (select auth.uid())),
               '-infinity'::timestamptz))
    from mias m
    join lateral (
      select x.texto, x.autor_id from public.mensajes x
       where x.conversacion_id = m.id
       order by x.creado_en desc, x.id desc
       limit 1
    ) u on true
    cross join lateral public.cuenta_en_buzon(m.otro) b
   order by m.ultimo_mensaje_en desc;
$$;

revoke all on function public.mis_conversaciones() from public, anon;
grant execute on function public.mis_conversaciones() to authenticated;

/** Cuantos mensajes ajenos sin leer tiene quien mira, para el contador del buzon. */
create or replace function public.mensajes_sin_leer()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
    from public.mensajes x
    join public.conversaciones c on c.id = x.conversacion_id
    left join public.lecturas_conversacion l
      on l.conversacion_id = c.id and l.usuario_id = (select auth.uid())
   where (select auth.uid()) in (c.iniciada_por, c.para)
     and x.autor_id <> (select auth.uid())
     and x.creado_en > coalesce(l.leida_en, '-infinity'::timestamptz);
$$;

revoke all on function public.mensajes_sin_leer() from public, anon;
grant execute on function public.mensajes_sin_leer() to authenticated;

/** Las dos partes de una conversacion con su nombre, para una de ellas o el administrador. */
create or replace function public.participantes_de(p_conversacion uuid)
returns table (usuario_id uuid, nombre text, tipo text, inicio boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (public.en_conversacion(p_conversacion) or public.es_admin()) then
    return;
  end if;

  return query
    select q.usuario_id, b.nombre, b.tipo, q.inicio
      from public.conversaciones c
     cross join lateral (values (c.iniciada_por, true), (c.para, false)) as q (usuario_id, inicio)
     cross join lateral public.cuenta_en_buzon(q.usuario_id) b
     where c.id = p_conversacion;
end;
$$;

revoke all on function public.participantes_de(uuid) from public, anon;
grant execute on function public.participantes_de(uuid) to authenticated;

/**
 * A quien se le puede escribir, buscando por nombre. Solo devuelve cuentas que
 * `puede_escribirle` deja: negocios (por el nombre de su marca), asesores de
 * ventas y la administracion; el administrador ademas encuentra a cualquiera
 * por nombre o correo.
 *
 * Un negocio en borrador no es publico: solo lo encuentran el administrador y
 * los asesores, que son quienes lo dan de alta.
 */
create or replace function public.buscar_destinatarios(p_texto text)
returns table (id uuid, nombre text, tipo text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  yo uuid := (select auth.uid());
  patron text := '%' || coalesce(btrim(p_texto), '') || '%';
  amplio boolean := public.es_admin() or public.es_vendedor();
begin
  if yo is null then
    return;
  end if;

  return query
    select d.id, d.nombre, d.tipo
      from (
    select distinct on (r.id) r.id, b.nombre, b.tipo, r.orden
      from (
        -- La administracion sale siempre: es a quien se le escribe si no se
        -- sabe a quien. Una sola cuenta, la mas antigua: todas se presentan
        -- como «Guia del Cacao» y repetirla confundiria.
        (select p.id, 0 as orden from public.perfiles p
          where p.rol = 'admin' order by p.fecha_registro, p.id limit 1)
        union all
        select m.perfil_id, 1
          from public.marcas m
          join public.perfiles p on p.id = m.perfil_id and p.rol = 'negocio'
         where btrim(coalesce(p_texto, '')) <> ''
           and m.nombre_comercial ilike patron
           and (amplio or public.marca_con_micrositio_publicado(m.id))
        union all
        select e.perfil_id, 2
          from public.embajadores e
          join public.perfiles p on p.id = e.perfil_id
         where btrim(coalesce(p_texto, '')) <> ''
           and e.estado in ('activo', 'pausado')
           and p.nombre ilike patron
        union all
        select p.id, 3
          from public.perfiles p
         where public.es_admin()
           and btrim(coalesce(p_texto, '')) <> ''
           and (p.nombre ilike patron or p.correo ilike patron)
      ) r
     cross join lateral public.cuenta_en_buzon(r.id) b
     where r.id <> yo
     order by r.id, r.orden
      ) d
     order by d.orden, d.nombre
     limit 20;
end;
$$;

revoke all on function public.buscar_destinatarios(text) from public, anon;
grant execute on function public.buscar_destinatarios(text) to authenticated;

-- ---------------------------------------------------------------- reportar
/**
 * Lo que no se puede reportar: un mensaje propio, un mensaje de otra
 * conversacion, o una conversacion donde la otra parte no ha dicho nada (ahi
 * solo hablaste tu). Y un reporte nace pendiente.
 */
create or replace function public.revisar_reporte_de_conversacion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  autor uuid;
  conversacion uuid;
begin
  new.atendido_en := null;
  new.atendido_por := null;
  new.creado_en := clock_timestamp();

  if new.mensaje_id is not null then
    select x.autor_id, x.conversacion_id into autor, conversacion
      from public.mensajes x where x.id = new.mensaje_id;

    if conversacion is distinct from new.conversacion_id then
      raise exception 'Ese mensaje no es de esta conversación.';
    end if;

    if autor = new.usuario_id then
      raise exception 'Es tu propio mensaje: no se reporta.';
    end if;
  elsif not exists (
    select 1 from public.mensajes x
     where x.conversacion_id = new.conversacion_id
       and x.autor_id <> new.usuario_id
  ) then
    raise exception 'La otra persona todavía no te ha escrito nada que reportar.';
  end if;

  return new;
end;
$$;

drop trigger if exists al_reportar_conversacion on public.reportes_conversacion;
create trigger al_reportar_conversacion
  before insert on public.reportes_conversacion
  for each row execute function public.revisar_reporte_de_conversacion();

/** La cola del administrador: conversaciones con reportes pendientes. */
create or replace function public.conversaciones_reportadas()
returns table (
  conversacion_id uuid,
  reportes integer,
  motivos text[],
  detalles text[],
  mensajes_reportados uuid[],
  quienes text[],
  ultimo timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.es_admin() then
    raise exception 'Solo el administrador ve los reportes.';
  end if;

  return query
    select r.conversacion_id,
           count(*)::integer,
           array_agg(distinct r.motivo),
           array_remove(array_agg(r.detalle order by r.creado_en desc), null),
           array_remove(array_agg(distinct r.mensaje_id), null),
           array_agg(distinct b.nombre),
           max(r.creado_en)
      from public.reportes_conversacion r
     cross join lateral public.cuenta_en_buzon(r.usuario_id) b
     where r.atendido_en is null
     group by r.conversacion_id
     order by max(r.creado_en) desc;
end;
$$;

revoke all on function public.conversaciones_reportadas() from public, anon;
grant execute on function public.conversaciones_reportadas() to authenticated;

/** El administrador da por revisados los reportes pendientes de una conversacion. */
create or replace function public.atender_reportes_de_conversacion(p_conversacion uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.es_admin() then
    raise exception 'Solo el administrador atiende los reportes.';
  end if;

  update public.reportes_conversacion
     set atendido_en = now(), atendido_por = (select auth.uid())
   where conversacion_id = p_conversacion
     and atendido_en is null;
end;
$$;

revoke all on function public.atender_reportes_de_conversacion(uuid) from public, anon;
grant execute on function public.atender_reportes_de_conversacion(uuid) to authenticated;
