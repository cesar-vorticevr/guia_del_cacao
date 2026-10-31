-- Pedidos con pago por transferencia, directo al negocio.
--
-- Una persona con cuenta arma un pedido desde el catalogo de un micrositio y
-- el negocio lo ve en su panel. La conversacion entre los dos es la del buzon
-- (000069): el pedido se cuelga de ella y cada paso deja ahi su mensaje.
--
-- **La Guia no cobra ni guarda dinero.** El pago es una transferencia del
-- cliente al negocio, con los datos que el negocio anota aqui. Lo que la
-- plataforma no puede asegurar —que el producto exista— lo resuelve el orden
-- de los pasos:
--
-- 1. `nuevo`: el cliente pide. Todavia no ve a donde pagar.
-- 2. `confirmado`: el negocio dice que si lo tiene y fija el total (con envio
--    o sin el). **Solo entonces** el cliente ve la CLABE, y le llega al chat.
-- 3. `pagado`: el negocio vio la transferencia en su banco. El cliente puede
--    avisar antes («Ya transferi»), pero eso no lo marca pagado: lo marca
--    quien recibe el dinero.
-- 4. `entregado`. Un pedido para recoger puede pasar de `confirmado` a
--    `entregado` si se pago en el mostrador.
-- `cancelado`: el cliente, mientras no este pagado; el negocio, hasta
-- entregarlo, y siempre con un motivo.
--
-- **Vende quien paga.** Recibir pedidos exige que la sucursal este publicada,
-- con una suscripcion `activo` en un plan con precio —la prueba Gratis no
-- vende—, que no sea de demostracion, y que la marca haya anotado sus datos de
-- pago con «Recibir pedidos» encendido. Una tarjeta cobrada por Stripe es,
-- ademas, la unica identidad que la plataforma tiene del negocio. Se deriva
-- (`sucursal_vende`), no se guarda: al vencer o cancelar el plan deja de
-- vender solo, como todo lo que cuelga del plan.
--
-- Igual que el buzon: las llaves de personas van a `auth.users` y no a
-- `perfiles` (PGRST201), y nada de esto se escribe desde la API: todo cambio
-- pasa por funciones que comprueban quien llama.

-- ---------------------------------------------------------------- datos de pago
create table if not exists public.datos_de_pago (
  marca_id       uuid primary key references public.marcas (id) on delete cascade,
  banco          text not null check (char_length(btrim(banco)) between 2 and 60),
  titular        text not null check (char_length(btrim(titular)) between 3 and 120),
  clabe          text not null check (clabe ~ '^[0-9]{18}$'),
  instrucciones  text check (char_length(instrucciones) <= 500),
  recibe_pedidos boolean not null default true,
  actualizado_en timestamptz not null default now()
);

comment on table public.datos_de_pago is
  'A donde le transfieren a un negocio por sus pedidos. Solo lo ve su dueno, y el cliente de un pedido ya confirmado. Ver migracion 000071.';

/**
 * Si una CLABE es valida: 18 digitos y el ultimo es el digito de control
 * (pesos 3, 7, 1 sobre los 17 primeros). Un digito mal copiado manda el dinero
 * a ninguna parte, o a otra cuenta: mejor que lo diga al guardarla.
 */
create or replace function public.clabe_valida(p_clabe text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  suma integer := 0;
  pesos integer[] := array[3, 7, 1];
begin
  if p_clabe is null or p_clabe !~ '^[0-9]{18}$' then
    return false;
  end if;

  for i in 1..17 loop
    suma := suma + (substr(p_clabe, i, 1)::integer * pesos[((i - 1) % 3) + 1]) % 10;
  end loop;

  return (10 - suma % 10) % 10 = substr(p_clabe, 18, 1)::integer;
end;
$$;

create or replace function public.revisar_datos_de_pago()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.banco := btrim(new.banco);
  new.titular := btrim(new.titular);
  new.clabe := regexp_replace(coalesce(new.clabe, ''), '[^0-9]', '', 'g');
  new.instrucciones := nullif(btrim(coalesce(new.instrucciones, '')), '');
  new.actualizado_en := now();

  if not public.clabe_valida(new.clabe) then
    raise exception 'Esa CLABE no es válida: revisa los 18 dígitos.';
  end if;

  return new;
end;
$$;

drop trigger if exists al_guardar_datos_de_pago on public.datos_de_pago;
create trigger al_guardar_datos_de_pago
  before insert or update on public.datos_de_pago
  for each row execute function public.revisar_datos_de_pago();

revoke all on public.datos_de_pago from anon, authenticated;
grant select, insert, update on public.datos_de_pago to authenticated;

alter table public.datos_de_pago enable row level security;

-- Solo el dueno. El cliente los recibe por `mis_pedidos`, y solo con el pedido
-- confirmado: una politica de lectura para clientes los dejaria leer la CLABE
-- de cualquier negocio al que alguna vez le pidieron algo.
drop policy if exists datos_de_pago_dueno on public.datos_de_pago;
create policy datos_de_pago_dueno on public.datos_de_pago
  for select to authenticated
  using (public.posee_marca(marca_id) or public.es_admin());

drop policy if exists datos_de_pago_dueno_crea on public.datos_de_pago;
create policy datos_de_pago_dueno_crea on public.datos_de_pago
  for insert to authenticated
  with check (public.posee_marca(marca_id));

drop policy if exists datos_de_pago_dueno_edita on public.datos_de_pago;
create policy datos_de_pago_dueno_edita on public.datos_de_pago
  for update to authenticated
  using (public.posee_marca(marca_id))
  with check (public.posee_marca(marca_id));

-- ---------------------------------------------------------------- quien vende
/**
 * Por que esta sucursal no recibe pedidos, o null si si los recibe. Texto y no
 * booleano, como `que_le_falta_al_micrositio`: el panel lo ensena tal cual y
 * no reimplementa la regla.
 */
create or replace function public.por_que_no_vende(p_sucursal uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s record;
begin
  select su.estado, su.marca_id, m.es_demo
    into s
    from public.sucursales su
    join public.marcas m on m.id = su.marca_id
   where su.id = p_sucursal;

  if not found then
    return 'Esa sucursal no existe.';
  end if;

  if s.es_demo then
    return 'Es un negocio de demostración.';
  end if;

  if s.estado <> 'publicado' then
    return 'La sucursal no está publicada.';
  end if;

  if not exists (
    select 1 from public.suscripciones x
      join public.tiers t on t.id = x.tier_id
     where x.sucursal_id = p_sucursal
       and x.estado = 'activo'
       and t.precio_mensual > 0
  ) then
    return 'Recibir pedidos es del plan Pro pagado: con el Gratis no se vende.';
  end if;

  if not exists (
    select 1 from public.datos_de_pago d
     where d.marca_id = s.marca_id and d.recibe_pedidos
  ) then
    return 'Falta anotar tus datos de pago y encender «Recibir pedidos».';
  end if;

  return null;
end;
$$;

revoke all on function public.por_que_no_vende(uuid) from public;
grant execute on function public.por_que_no_vende(uuid) to anon, authenticated;

/** Si esta sucursal recibe pedidos. La pregunta el micrositio para ensenar el carrito. */
create or replace function public.sucursal_vende(p_sucursal uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.por_que_no_vende(p_sucursal) is null;
$$;

revoke all on function public.sucursal_vende(uuid) from public;
grant execute on function public.sucursal_vende(uuid) to anon, authenticated;

-- ---------------------------------------------------------------- pedidos
create table if not exists public.pedidos (
  id               uuid primary key default gen_random_uuid(),
  -- El numero que se dicen el cliente y el negocio: «el pedido 14».
  folio            bigint generated always as identity,
  comprador_id     uuid not null references auth.users (id) on delete cascade,
  marca_id         uuid not null references public.marcas (id) on delete cascade,
  sucursal_id      uuid not null references public.sucursales (id) on delete cascade,
  conversacion_id  uuid not null references public.conversaciones (id) on delete cascade,
  estado           text not null default 'nuevo'
                   check (estado in ('nuevo', 'confirmado', 'pagado', 'entregado', 'cancelado')),
  entrega          text not null check (entrega in ('recoger', 'envio')),
  direccion        text check (char_length(direccion) <= 300),
  nota             text check (char_length(nota) <= 500),
  -- La suma de lo que tiene precio en el catalogo. El total lo fija el
  -- negocio al confirmar: puede haber productos sin precio y envio.
  subtotal         numeric(10, 2) not null default 0,
  total            numeric(10, 2) check (total >= 0),
  motivo_cancelado text check (char_length(motivo_cancelado) <= 300),
  aviso_de_pago_en timestamptz,
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now(),
  check (entrega <> 'envio' or char_length(btrim(coalesce(direccion, ''))) >= 10)
);

create index if not exists pedidos_marca_idx on public.pedidos (marca_id, creado_en desc);
create index if not exists pedidos_comprador_idx on public.pedidos (comprador_id, creado_en desc);
create index if not exists pedidos_conversacion_idx on public.pedidos (conversacion_id);

comment on table public.pedidos is
  'Pedidos de un cliente a un negocio. El pago es por transferencia directa, fuera de la plataforma. Solo cambian por funciones. Ver migracion 000071.';

create table if not exists public.pedido_productos (
  id          uuid primary key default gen_random_uuid(),
  pedido_id   uuid not null references public.pedidos (id) on delete cascade,
  -- Si el negocio borra el producto, el renglon se queda con su nombre y su
  -- precio de ese dia: es lo que se pidio.
  producto_id uuid references public.productos_servicios (id) on delete set null,
  nombre      text not null,
  precio      numeric(10, 2),
  cantidad    integer not null check (cantidad between 1 and 99)
);

create index if not exists pedido_productos_pedido_idx on public.pedido_productos (pedido_id);

revoke all on public.pedidos, public.pedido_productos from anon, authenticated;
grant select on public.pedidos, public.pedido_productos to authenticated;

alter table public.pedidos enable row level security;
alter table public.pedido_productos enable row level security;

/** Si quien mira es el cliente o el dueno del negocio de este pedido. */
create or replace function public.ve_pedido(p_pedido uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.pedidos p
     where p.id = p_pedido
       and (p.comprador_id = (select auth.uid()) or public.posee_marca(p.marca_id))
  );
$$;

revoke all on function public.ve_pedido(uuid) from public, anon;
grant execute on function public.ve_pedido(uuid) to authenticated;

drop policy if exists pedidos_lectura on public.pedidos;
create policy pedidos_lectura on public.pedidos
  for select to authenticated
  using (comprador_id = (select auth.uid()) or public.posee_marca(marca_id) or public.es_admin());

drop policy if exists pedido_productos_lectura on public.pedido_productos;
create policy pedido_productos_lectura on public.pedido_productos
  for select to authenticated
  using (public.ve_pedido(pedido_id) or public.es_admin());

-- ---------------------------------------------------------------- textos
/** «$1,250.00». Interna: la usan los mensajes que dejan los pedidos en el chat. */
create or replace function public.pesos_texto(p numeric)
returns text
language sql
immutable
set search_path = ''
as $$
  select '$' || to_char(coalesce(p, 0), 'FM999,999,990.00');
$$;

/** Los datos de pago de una marca como mensaje del chat. Interna. */
create or replace function public.datos_de_pago_texto(p_marca uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select 'Banco: ' || d.banco
      || E'\nTitular: ' || d.titular
      || E'\nCLABE: ' || d.clabe
      || coalesce(E'\n\n' || d.instrucciones, '')
    from public.datos_de_pago d
   where d.marca_id = p_marca;
$$;

revoke all on function public.pesos_texto(numeric) from public, anon, authenticated;
revoke all on function public.datos_de_pago_texto(uuid) from public, anon, authenticated;

/** Deja un mensaje en el chat del pedido a nombre de quien hizo el cambio. Interna. */
create or replace function public.mensaje_de_pedido(p_conversacion uuid, p_autor uuid, p_texto text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.mensajes (conversacion_id, autor_id, texto)
  values (p_conversacion, p_autor, left(p_texto, 2000));
$$;

revoke all on function public.mensaje_de_pedido(uuid, uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------- hacer un pedido
/**
 * El cliente pide. `p_productos` es `[{"producto_id": "…", "cantidad": 2}, …]`
 * con productos que esa sucursal maneja. Abre (o retoma) la conversacion con
 * el negocio y deja ahi el pedido escrito. Devuelve el id del pedido.
 */
create or replace function public.hacer_pedido(
  p_sucursal  uuid,
  p_productos jsonb,
  p_entrega   text,
  p_direccion text default null,
  p_nota      text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  yo uuid := (select auth.uid());
  marca uuid;
  motivo text;
  conversacion uuid;
  pedido uuid;
  numero bigint;
  suma numeric(10, 2);
  sin_precio boolean;
  renglones text;
  lineas jsonb;
  sucursal_nombre text;
begin
  if yo is null then
    raise exception 'Entra a tu cuenta para hacer un pedido.';
  end if;

  select s.marca_id, s.nombre_sucursal into marca, sucursal_nombre
    from public.sucursales s where s.id = p_sucursal;

  if marca is null then
    raise exception 'Ese negocio no existe.';
  end if;

  if public.posee_marca(marca) then
    raise exception 'Es tu propio negocio.';
  end if;

  motivo := public.por_que_no_vende(p_sucursal);
  if motivo is not null then
    raise exception 'Este negocio no está recibiendo pedidos.';
  end if;

  if p_entrega not in ('recoger', 'envio') then
    raise exception 'Elige si lo recoges o te lo envían.';
  end if;

  if p_entrega = 'envio' and char_length(btrim(coalesce(p_direccion, ''))) < 10 then
    raise exception 'Escribe a dónde te lo envían.';
  end if;

  if jsonb_typeof(p_productos) <> 'array' or jsonb_array_length(p_productos) = 0 then
    raise exception 'Tu pedido está vacío.';
  end if;

  if jsonb_array_length(p_productos) > 30 then
    raise exception 'Un pedido lleva hasta treinta productos distintos.';
  end if;

  -- Un cliente no apila pedidos sin contestar en el mismo negocio: tres
  -- esperando respuesta ya son suficientes para que lo atiendan.
  if (select count(*) from public.pedidos p
       where p.comprador_id = yo and p.marca_id = marca and p.estado = 'nuevo') >= 3 then
    raise exception 'Ya tienes tres pedidos esperando respuesta de este negocio. Escríbeles por el chat.';
  end if;

  if exists (
    select 1 from jsonb_to_recordset(p_productos) as r (producto_id uuid, cantidad integer)
     where r.producto_id is null or r.cantidad is null or r.cantidad not between 1 and 99
  ) then
    raise exception 'Cada producto va de 1 a 99 piezas.';
  end if;

  -- Los renglones con el nombre y el precio de hoy, juntando un producto
  -- repetido, y solo con lo que la sucursal maneja.
  select coalesce(jsonb_agg(jsonb_build_object(
           'producto_id', pr.id, 'nombre', pr.nombre,
           'precio', pr.precio, 'cantidad', c.cantidad)), '[]'::jsonb)
    into lineas
    from (
      select r.producto_id, least(sum(r.cantidad), 99)::integer as cantidad
        from jsonb_to_recordset(p_productos) as r (producto_id uuid, cantidad integer)
       group by r.producto_id
    ) c
    join public.productos_sucursal ps
      on ps.producto_id = c.producto_id and ps.sucursal_id = p_sucursal
    join public.productos_servicios pr on pr.id = c.producto_id;

  if jsonb_array_length(lineas) <> (
    select count(distinct e ->> 'producto_id') from jsonb_array_elements(p_productos) e
  ) then
    raise exception 'Algún producto ya no está en el catálogo. Recarga la página y vuelve a pedir.';
  end if;

  select coalesce(sum(r.precio * r.cantidad), 0), bool_or(r.precio is null)
    into suma, sin_precio
    from jsonb_to_recordset(lineas) as r (precio numeric, cantidad integer);

  conversacion := public.abrir_conversacion_con_marca(marca);

  insert into public.pedidos (comprador_id, marca_id, sucursal_id, conversacion_id,
                              entrega, direccion, nota, subtotal)
  values (yo, marca, p_sucursal, conversacion, p_entrega,
          case when p_entrega = 'envio' then btrim(p_direccion) end,
          nullif(btrim(coalesce(p_nota, '')), ''), suma)
  returning id, folio into pedido, numero;

  insert into public.pedido_productos (pedido_id, producto_id, nombre, precio, cantidad)
  select pedido, r.producto_id, r.nombre, r.precio, r.cantidad
    from jsonb_to_recordset(lineas) as r (producto_id uuid, nombre text, precio numeric, cantidad integer);

  select string_agg(
           r.cantidad || ' × ' || r.nombre || ' — '
             || case when r.precio is null then 'precio por confirmar'
                     else public.pesos_texto(r.precio * r.cantidad) end,
           E'\n' order by r.nombre)
    into renglones
    from jsonb_to_recordset(lineas) as r (nombre text, precio numeric, cantidad integer);

  perform public.mensaje_de_pedido(conversacion, yo,
    'Pedido #' || numero || E'\n\n' || renglones
    || E'\n\nSubtotal: ' || public.pesos_texto(suma)
    || case when sin_precio then ' (más lo que no tiene precio)' else '' end
    || E'\nEntrega: '
    || case when p_entrega = 'envio' then 'envío a ' || btrim(p_direccion)
            else 'lo recojo en ' || sucursal_nombre end
    || coalesce(E'\nNota: ' || nullif(btrim(coalesce(p_nota, '')), ''), '')
    || E'\n\n¿Lo tienen? Espero su confirmación para pagar.');

  return pedido;
end;
$$;

revoke all on function public.hacer_pedido(uuid, jsonb, text, text, text) from public, anon;
grant execute on function public.hacer_pedido(uuid, jsonb, text, text, text) to authenticated;

-- ---------------------------------------------------------------- cambiar de estado
/**
 * Mueve un pedido al siguiente paso y lo dice en el chat. Quien puede que
 * esta arriba, en el encabezado. `p_total` lo pide confirmar cuando hay
 * productos sin precio; si no, vale el subtotal. `p_motivo` lo pide cancelar
 * al negocio.
 */
create or replace function public.cambiar_estado_pedido(
  p_pedido uuid,
  p_estado text,
  p_total  numeric default null,
  p_motivo text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  yo uuid := (select auth.uid());
  p public.pedidos%rowtype;
  vendedor boolean;
  sin_precio boolean;
  total_final numeric(10, 2);
  motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  texto text;
begin
  select * into p from public.pedidos where id = p_pedido for update;

  if not found or yo is null then
    raise exception 'Ese pedido no existe.';
  end if;

  vendedor := public.posee_marca(p.marca_id);

  if not vendedor and p.comprador_id <> yo then
    raise exception 'Ese pedido no es tuyo.';
  end if;

  if p_estado = 'confirmado' then
    if not vendedor or p.estado <> 'nuevo' then
      raise exception 'Solo el negocio confirma, y solo un pedido nuevo.';
    end if;

    if not exists (select 1 from public.datos_de_pago d where d.marca_id = p.marca_id) then
      raise exception 'Anota tus datos de pago antes de confirmar.';
    end if;

    select bool_or(x.precio is null) into sin_precio
      from public.pedido_productos x where x.pedido_id = p.id;

    total_final := coalesce(p_total, case when sin_precio then null else p.subtotal end);

    if total_final is null or total_final < 0 then
      raise exception 'Escribe el total del pedido: hay productos sin precio.';
    end if;

    update public.pedidos
       set estado = 'confirmado', total = total_final, actualizado_en = now()
     where id = p.id;

    texto := 'Confirmo el pedido #' || p.folio || ': sí lo tenemos.'
      || E'\nTotal a pagar: ' || public.pesos_texto(total_final)
      || case when total_final <> p.subtotal then ' (incluye envío o ajustes)' else '' end
      || E'\n\nPara pagar, transfiere a:\n' || public.datos_de_pago_texto(p.marca_id)
      || coalesce(E'\n\n' || motivo, '')
      || E'\n\nCuando transfieras, avísanos con «Ya transferí».';

  elsif p_estado = 'pagado' then
    if not vendedor or p.estado <> 'confirmado' then
      raise exception 'Solo el negocio marca pagado un pedido confirmado: es quien ve llegar el dinero.';
    end if;

    update public.pedidos set estado = 'pagado', actualizado_en = now() where id = p.id;
    texto := 'Recibimos tu pago del pedido #' || p.folio || '. ¡Gracias!'
      || case when p.entrega = 'envio' then ' Te avisamos cuando salga.'
              else ' Ya puedes pasar por él.' end;

  elsif p_estado = 'entregado' then
    if not vendedor or p.estado not in ('confirmado', 'pagado') then
      raise exception 'Solo el negocio entrega, y solo un pedido confirmado o pagado.';
    end if;

    update public.pedidos set estado = 'entregado', actualizado_en = now() where id = p.id;
    texto := 'Pedido #' || p.folio || ' entregado. ¡Que lo disfrutes!';

  elsif p_estado = 'cancelado' then
    if vendedor then
      if p.estado not in ('nuevo', 'confirmado', 'pagado') then
        raise exception 'Ese pedido ya no se puede cancelar.';
      end if;
      if motivo is null then
        raise exception 'Dile al cliente por qué lo cancelas.';
      end if;
    elsif p.estado not in ('nuevo', 'confirmado') then
      raise exception 'Un pedido pagado ya no se cancela desde aquí: escríbele al negocio.';
    end if;

    update public.pedidos
       set estado = 'cancelado', motivo_cancelado = motivo, actualizado_en = now()
     where id = p.id;

    texto := 'Cancelé el pedido #' || p.folio || '.'
      || coalesce(E'\nMotivo: ' || motivo, '')
      || case when p.estado = 'pagado' then E'\nTe devolvemos tu pago por el mismo medio.' else '' end;

  else
    raise exception 'Ese paso no existe.';
  end if;

  perform public.mensaje_de_pedido(p.conversacion_id, yo, texto);
end;
$$;

revoke all on function public.cambiar_estado_pedido(uuid, text, numeric, text) from public, anon;
grant execute on function public.cambiar_estado_pedido(uuid, text, numeric, text) to authenticated;

/**
 * El cliente avisa que ya transfirio. No marca el pedido pagado —eso lo hace
 * el negocio al ver el dinero—: deja la hora y el aviso en el chat.
 */
create or replace function public.avisar_pago_de_pedido(p_pedido uuid, p_referencia text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.pedidos%rowtype;
  referencia text := left(nullif(btrim(coalesce(p_referencia, '')), ''), 120);
begin
  select * into p from public.pedidos where id = p_pedido for update;

  if not found or p.comprador_id <> (select auth.uid()) then
    raise exception 'Ese pedido no es tuyo.';
  end if;

  if p.estado <> 'confirmado' then
    raise exception 'Se avisa el pago de un pedido confirmado y sin pagar.';
  end if;

  update public.pedidos set aviso_de_pago_en = now(), actualizado_en = now() where id = p.id;

  perform public.mensaje_de_pedido(p.conversacion_id, p.comprador_id,
    'Ya transferí ' || public.pesos_texto(p.total) || ' del pedido #' || p.folio || '.'
    || coalesce(E'\nReferencia o clave de rastreo: ' || referencia, '')
    || E'\n¿Me confirman cuando lo vean?');
end;
$$;

revoke all on function public.avisar_pago_de_pedido(uuid, text) from public, anon;
grant execute on function public.avisar_pago_de_pedido(uuid, text) to authenticated;

/**
 * El negocio manda sus datos de pago a una conversacion, cuando se lo piden
 * fuera de un pedido. Solo a una donde es parte.
 */
create or replace function public.mandar_datos_de_pago(p_conversacion uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  yo uuid := (select auth.uid());
  marca uuid;
begin
  if not public.en_conversacion(p_conversacion) then
    raise exception 'Esa conversación no es tuya.';
  end if;

  select d.marca_id into marca
    from public.datos_de_pago d
    join public.marcas m on m.id = d.marca_id
   where m.perfil_id = yo
   order by m.fecha_registro nulls last
   limit 1;

  if marca is null then
    raise exception 'Todavía no anotas tus datos de pago.';
  end if;

  perform public.mensaje_de_pedido(p_conversacion, yo,
    E'Mis datos para transferir:\n' || public.datos_de_pago_texto(marca));
end;
$$;

revoke all on function public.mandar_datos_de_pago(uuid) from public, anon;
grant execute on function public.mandar_datos_de_pago(uuid) to authenticated;

-- ---------------------------------------------------------------- leer
/**
 * Los pedidos de quien mira, con todo lo que pinta una tarjeta: renglones,
 * quien es la otra parte, y los datos de pago **solo si ya se confirmo** (o si
 * quien mira es el negocio).
 *
 * `p_lado`: 'compras' (lo que pedi), 'ventas' (lo que me piden) o null (los
 * dos). `p_conversacion` acota a los de un chat. Filtra por `auth.uid()`
 * aunque RLS deje pasar mas: el administrador no tiene pedidos aqui.
 */
create or replace function public.mis_pedidos(p_lado text default null, p_conversacion uuid default null)
returns table (
  id uuid,
  folio bigint,
  soy_vendedor boolean,
  estado text,
  entrega text,
  direccion text,
  nota text,
  subtotal numeric,
  total numeric,
  motivo_cancelado text,
  aviso_de_pago_en timestamptz,
  creado_en timestamptz,
  actualizado_en timestamptz,
  conversacion_id uuid,
  otro_nombre text,
  marca_nombre text,
  sucursal_nombre text,
  sucursal_slug text,
  renglones jsonb,
  pago jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.folio, v.vendedor, p.estado, p.entrega, p.direccion, p.nota,
         p.subtotal, p.total, p.motivo_cancelado, p.aviso_de_pago_en,
         p.creado_en, p.actualizado_en, p.conversacion_id,
         case when v.vendedor then b.nombre else m.nombre_comercial end,
         m.nombre_comercial, s.nombre_sucursal, s.slug,
         (select coalesce(jsonb_agg(jsonb_build_object(
                    'nombre', x.nombre, 'precio', x.precio, 'cantidad', x.cantidad)
                  order by x.nombre), '[]'::jsonb)
            from public.pedido_productos x where x.pedido_id = p.id),
         case when v.vendedor or p.estado in ('confirmado', 'pagado', 'entregado') then
           (select jsonb_build_object('banco', d.banco, 'titular', d.titular,
                                      'clabe', d.clabe, 'instrucciones', d.instrucciones)
              from public.datos_de_pago d where d.marca_id = p.marca_id)
         end
    from public.pedidos p
    join public.marcas m on m.id = p.marca_id
    join public.sucursales s on s.id = p.sucursal_id
   cross join lateral (select m.perfil_id = (select auth.uid()) as vendedor) v
   cross join lateral public.cuenta_en_buzon(p.comprador_id) b
   where (select auth.uid()) is not null
     and (
       (coalesce(p_lado, 'compras') = 'compras' and p.comprador_id = (select auth.uid()))
       or (coalesce(p_lado, 'ventas') = 'ventas' and m.perfil_id = (select auth.uid()))
     )
     and (p_conversacion is null or p.conversacion_id = p_conversacion)
   order by case when p.estado in ('entregado', 'cancelado') then 1 else 0 end,
            p.creado_en desc
   limit 200;
$$;

revoke all on function public.mis_pedidos(text, uuid) from public, anon;
grant execute on function public.mis_pedidos(text, uuid) to authenticated;

/** Cuantos pedidos nuevos, sin confirmar, tiene el negocio de quien mira: el numero de la pestana. */
create or replace function public.pedidos_por_atender()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
    from public.pedidos p
    join public.marcas m on m.id = p.marca_id
   where m.perfil_id = (select auth.uid())
     and p.estado = 'nuevo';
$$;

revoke all on function public.pedidos_por_atender() from public, anon;
grant execute on function public.pedidos_por_atender() to authenticated;
