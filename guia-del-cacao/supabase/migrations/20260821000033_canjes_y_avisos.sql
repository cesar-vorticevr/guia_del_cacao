-- Canjear un cupon, y los avisos que faltaban.
--
-- Hasta aqui el mercado era un escaparate sin caja: el negocio publicaba cupones
-- y nadie podia llevarselos. Con el canje se cierra el circulo de las mazorcas —
-- visito, junto, canjeo, vuelvo— y de paso se conectan dos avisos que estaban a
-- medias: el de las solicitudes de mazorcas (el tipo ya existia en la
-- restriccion, sin nadie que lo escribiera) y el del propio canje.

-- ------------------------------------------------------------------- canjes
create table public.canjes (
  id uuid primary key default gen_random_uuid(),
  cupon_id uuid not null references public.cupones(id) on delete restrict,
  usuario_id uuid not null references public.perfiles(id) on delete cascade,
  -- Lo que costo, copiado al canjear. El cupon puede borrarse y el precio no
  -- puede cambiar despues: es lo que la persona pago, no lo que hoy vale.
  costo_mazorcas smallint not null,
  fecha timestamptz not null default now(),
  -- Cuando lo presento en el mostrador. Nulo mientras no lo use.
  usado_en timestamptz
);

-- `on delete restrict` en el cupon: si alguien lo canjeo, el negocio ya no puede
-- borrarlo de un plumazo y dejar a esa persona con un vale que no apunta a nada.

create unique index canje_uno_por_persona on public.canjes (cupon_id, usuario_id);
create index canjes_usuario_idx on public.canjes (usuario_id, fecha desc);
create index canjes_cupon_idx on public.canjes (cupon_id);

alter table public.canjes enable row level security;

comment on table public.canjes is
  'Cupones que alguien ya cambio por sus mazorcas. Uno por persona y cupon: la oferta es para probar el negocio, no para vaciarla entre dos.';

-- Cobrar las mazorcas y avisar al negocio, en la misma transaccion que el canje:
-- si el cobro fallara despues, habria un cupon regalado.
create or replace function public.cobrar_canje()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  anio_actual smallint := extract(year from (now() at time zone 'America/Mexico_City'))::smallint;
  saldo integer;
  cupon record;
  duenio uuid;
  quien text;
begin
  select c.nombre, c.costo_mazorcas, c.vigencia, c.sucursal_id
    into cupon
    from public.cupones c
   where c.id = new.cupon_id;

  if cupon is null then
    raise exception 'Ese cupon ya no existe';
  end if;

  if cupon.vigencia < (now() at time zone 'America/Mexico_City')::date then
    raise exception 'Ese cupon ya caduco';
  end if;

  -- El precio lo pone el cupon, no quien canjea: mandarlo desde fuera dejaria
  -- elegir cuanto pagar.
  new.costo_mazorcas := cupon.costo_mazorcas;

  select puntos_acumulados into saldo
    from public.rangos_usuario
   where usuario_id = new.usuario_id and anio = anio_actual
     for update;

  if coalesce(saldo, 0) < cupon.costo_mazorcas then
    raise exception 'Te faltan mazorcas para este cupon: cuesta % y tienes %',
      cupon.costo_mazorcas, coalesce(saldo, 0);
  end if;

  update public.rangos_usuario
     set puntos_acumulados = puntos_acumulados - cupon.costo_mazorcas,
         rango_actual = public.calcular_rango(puntos_acumulados - cupon.costo_mazorcas)
   where usuario_id = new.usuario_id and anio = anio_actual;

  select m.perfil_id into duenio
    from public.sucursales s
    join public.marcas m on m.id = s.marca_id
   where s.id = cupon.sucursal_id;

  select p.nombre into quien from public.perfiles p where p.id = new.usuario_id;

  if duenio is not null then
    insert into public.notificaciones (perfil_id, tipo, titulo, detalle, enlace)
    values (
      duenio,
      'canje',
      coalesce(quien, 'Alguien') || ' canjeó «' || cupon.nombre || '»',
      'Te lo va a presentar en el mostrador. Ya pagó sus ' ||
        cupon.costo_mazorcas || ' mazorcas.',
      '/negocio/panel/cupones'
    );
  end if;

  return new;
end;
$$;

create trigger cobrar_al_canjear
  before insert on public.canjes
  for each row execute function public.cobrar_canje();

-- Cada quien ve los suyos; el negocio ve los de sus cupones, que es como sabe
-- quien va a aparecer con un vale.
create policy canjes_lectura on public.canjes
  for select
  using (
    usuario_id = (select auth.uid())
    or exists (
      select 1 from public.cupones c
       where c.id = cupon_id and public.posee_sucursal(c.sucursal_id)
    )
    or public.es_admin()
  );

create policy canjes_crea_propio on public.canjes
  for insert
  with check (usuario_id = (select auth.uid()) and public.es_cliente());

-- Marcarlo usado es del negocio: es quien lo tiene delante en el mostrador.
create policy canjes_marca_el_negocio on public.canjes
  for update
  using (
    exists (
      select 1 from public.cupones c
       where c.id = cupon_id and public.posee_sucursal(c.sucursal_id)
    )
    or public.es_admin()
  )
  with check (
    exists (
      select 1 from public.cupones c
       where c.id = cupon_id and public.posee_sucursal(c.sucursal_id)
    )
    or public.es_admin()
  );

-- No hay DELETE: un canje es un recibo. Borrarlo dejaria a alguien sin lo que
-- pago y sin rastro de haberlo pagado.

-- ----------------------------------------------------------- los dos avisos
alter table public.notificaciones drop constraint notificaciones_tipo_check;

alter table public.notificaciones
  add constraint notificaciones_tipo_check
  check (tipo in ('resena', 'solicitud', 'canje'));

-- El de solicitudes llevaba declarado desde el principio y nadie lo escribia:
-- el panel se enteraba de una solicitud nueva solo si el negocio entraba a
-- mirar. Ahora le llega como le llega una resena.
create or replace function public.avisar_de_solicitud()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  duenio uuid;
  quien text;
  sucursal text;
begin
  select m.perfil_id, s.nombre_sucursal
    into duenio, sucursal
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
    'solicitud',
    coalesce(quien, 'Alguien') || ' pide mazorcas en ' || coalesce(sucursal, 'tu sucursal'),
    'Resuélvela para que se las lleve hoy.',
    '/negocio/panel/monedas'
  );

  return new;
end;
$$;

create trigger avisar_al_pedir_mazorcas
  after insert on public.solicitudes_puntos
  for each row execute function public.avisar_de_solicitud();

-- Los avisos los escriben los triggers, nunca la aplicacion: no hay politica de
-- INSERT en `notificaciones`, y eso no cambia aqui.
