-- Guía del Cacao — un micrositio no sale a medias, y al negocio se le avisa
--
-- Dos cosas que faltaban del lado del negocio.
--
-- 1. PUBLICAR EXIGE ESTAR COMPLETO. Desde que publicar lo autoriza el pago
--    (migracion 000012) ya nadie revisa antes, y empezaron a poder salir al
--    directorio micrositios sin logo, sin catalogo y sin una linea que diga de
--    que es el negocio. Una ficha asi no le sirve a quien busca ni al negocio
--    que pago por ella.
--
--    El minimo es: nombre de la sucursal, "acerca de", logo y al menos un
--    producto. Va en la base y no solo en el boton porque el pago ya se hizo:
--    si la comprobacion viviera nada mas en la pantalla, un micrositio a medias
--    con suscripcion activa se quedaria en un limbo raro.
--
-- 2. AVISOS. Cuando alguien deja una resena, el negocio se enteraba solo si se
--    le ocurria ir a ver su propio micrositio. Ahora le llega el aviso a su
--    panel.

-- ---------------------------------------------------------------------------
-- Publicar exige micrositio completo
-- ---------------------------------------------------------------------------

/**
 * Que le falta a un micrositio para poder salir. Cadena vacia si no le falta
 * nada.
 *
 * Devuelve texto y no un booleano a proposito: lo usa el trigger para explicar
 * el rechazo y la pantalla para poner la lista de pendientes antes de cobrar.
 * Con un booleano, la pantalla tendria que reimplementar la misma regla para
 * decir cual falta, y las dos versiones se separarian.
 */
create or replace function public.que_le_falta_al_micrositio(p_sucursal uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $fn$
  select string_agg(falta, ', ' order by orden)
    from (
      select 1 as orden, 'el nombre de la sucursal' as falta
        from public.sucursales s
       where s.id = p_sucursal and coalesce(btrim(s.nombre_sucursal), '') = ''
      union all
      select 2, 'la descripcion (acerca de)'
        from public.sucursales s
       where s.id = p_sucursal and coalesce(btrim(s.acerca_de), '') = ''
      union all
      select 3, 'el logo'
        from public.sucursales s
       where s.id = p_sucursal and coalesce(btrim(s.logo), '') = ''
      union all
      select 4, 'al menos un producto en el catalogo'
       where not exists (
         select 1 from public.productos_servicios p where p.sucursal_id = p_sucursal
       )
    ) pendientes;
$fn$;

create or replace function public.exigir_micrositio_completo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  faltante text;
begin
  if new.estado <> 'publicado' or old.estado = 'publicado' then
    return new;
  end if;

  faltante := public.que_le_falta_al_micrositio(new.id);

  if faltante is not null then
    raise exception 'Al micrositio le falta %', faltante;
  end if;

  return new;
end;
$fn$;

-- Antes que proteger_estado_sucursal por el nombre: si le falta algo, mas vale
-- decir que falta que decir que no pago.
create trigger al_publicar_exigir_completo
  before update on public.sucursales
  for each row execute function public.exigir_micrositio_completo();

-- ---------------------------------------------------------------------------
-- Avisos
-- ---------------------------------------------------------------------------

create table public.notificaciones (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references public.perfiles (id) on delete cascade,
  -- 'solicitud' queda declarado aunque todavia nadie lo escriba: es el otro
  -- aviso que este panel va a querer, y agregarlo despues obligaria a tocar
  -- la restriccion.
  tipo text not null check (tipo in ('resena', 'solicitud')),
  titulo text not null,
  detalle text,
  enlace text not null,
  leida boolean not null default false,
  fecha timestamptz not null default now()
);

-- El indice es el de la consulta real: los avisos de una persona, los sin leer
-- primero y los recientes arriba.
create index notificaciones_perfil_idx
  on public.notificaciones (perfil_id, leida, fecha desc);

alter table public.notificaciones enable row level security;

grant select, update on public.notificaciones to authenticated;

-- Los avisos son de quien los recibe. Ni siquiera se insertan desde la
-- aplicacion: los escribe el trigger, que corre como definer.
create policy notificaciones_lectura on public.notificaciones
  for select using (perfil_id = (select auth.uid()));

-- Lo unico que se puede cambiar es marcarlo leido, y eso lo acota el trigger
-- de abajo: la politica sola dejaria reescribir el texto del aviso.
create policy notificaciones_marca_leida on public.notificaciones
  for update using (perfil_id = (select auth.uid()))
  with check (perfil_id = (select auth.uid()));

create or replace function public.proteger_notificacion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  if (select auth.uid()) is not null
     and (new.titulo, new.detalle, new.enlace, new.tipo, new.perfil_id)
         is distinct from (old.titulo, old.detalle, old.enlace, old.tipo, old.perfil_id)
  then
    raise exception 'Un aviso solo se puede marcar como leido';
  end if;

  return new;
end;
$fn$;

create trigger al_actualizar_notificacion
  before update on public.notificaciones
  for each row execute function public.proteger_notificacion();

/**
 * Le avisa al negocio que le dejaron resena.
 *
 * Solo al crearla, no al corregirla: desde la migracion 000017 la resena se
 * actualiza, y avisar de cada correccion volveria el panel un ruido. Tampoco
 * al responder, que tambien es un update de esa fila.
 */
create or replace function public.avisar_de_resena()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  duenio uuid;
  quien text;
  donde text;
begin
  select m.perfil_id, s.slug
    into duenio, donde
    from public.sucursales s
    join public.marcas m on m.id = s.marca_id
   where s.id = new.sucursal_id;

  if duenio is null then
    return new;
  end if;

  select p.nombre into quien from public.perfiles p where p.id = new.usuario_id;

  insert into public.notificaciones (perfil_id, tipo, titulo, detalle, enlace)
  values (
    duenio,
    'resena',
    coalesce(quien, 'Alguien') || ' te dejo una resena',
    left(new.texto, 140),
    '/marca/' || donde
  );

  return new;
end;
$fn$;

create trigger avisar_al_dejar_resena
  after insert on public.resenas
  for each row execute function public.avisar_de_resena();
