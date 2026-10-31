-- Cupones de descuento propios de cada vendedor.
--
-- Ademas de sus dos codigos fijos (000070), cada cuenta de ventas arma sus
-- propios cupones: el codigo que quiera y el porcentaje que quiera, **de 1 a
-- 50%**, en el primer pago del negocio. **Tres activos a la vez**: para
-- estrenar otro, desactiva uno.
--
-- - **Un cupon no se edita**, como los cupones de los negocios (000032): un
--   negocio pudo ponerlo ya, y cambiarle el porcentaje seria cambiarle el
--   trato. Se desactiva y se crea otro. Tampoco se borra: un negocio vinculado
--   apunta a el.
-- - **El descuento se guarda en el vinculo** (`referidos.descuento`) al poner
--   el codigo. Desactivar el cupon despues no se lo quita a quien ya lo puso.
-- - La comision no cambia: 25% de lo que Stripe cobro, ya con el descuento.
--   Regalar mas es ganar menos de ese primer cobro, y eso lo decide el vendedor.
-- - El cupon cuenta como codigo de descuento (`referidos.tipo = 'descuento'`):
--   todo lo demas —una marca que ya pago no estrena, un solo vendedor por
--   marca, nunca el propio— sigue igual.

create table if not exists public.cupones_de_vendedor (
  id             uuid primary key default gen_random_uuid(),
  embajador_id   uuid not null default auth.uid() references public.embajadores (perfil_id) on delete cascade,
  codigo         text not null,
  porcentaje     integer not null check (porcentaje between 1 and 50),
  activo         boolean not null default true,
  creado_en      timestamptz not null default now(),
  desactivado_en timestamptz
);

comment on table public.cupones_de_vendedor is
  'Cupones de descuento que arma cada vendedor: 1 a 50% en el primer pago, tres activos a la vez. No se editan ni se borran. Ver migracion 000073.';

create unique index if not exists cupones_de_vendedor_codigo_unico
  on public.cupones_de_vendedor (public.normalizar_codigo(codigo));
create index if not exists cupones_de_vendedor_embajador_idx
  on public.cupones_de_vendedor (embajador_id, creado_en desc);

/** Cuantos cupones activos puede tener un vendedor. `lib/precios.ts` lo repite. */
create or replace function public.tope_de_cupones_de_vendedor()
returns integer language sql immutable set search_path = '' as $$ select 3; $$;

create or replace function public.revisar_cupon_de_vendedor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  normal text;
begin
  if tg_op = 'UPDATE' then
    if new.codigo is distinct from old.codigo
       or new.porcentaje is distinct from old.porcentaje
       or new.embajador_id is distinct from old.embajador_id
       or new.creado_en is distinct from old.creado_en then
      raise exception 'Un cupón no se edita: desactívalo y crea otro.';
    end if;

    if new.activo = old.activo then
      return new;
    end if;

    new.desactivado_en := case when new.activo then null else now() end;
  else
    new.creado_en := now();
    new.desactivado_en := case when new.activo then null else now() end;
    new.codigo := upper(btrim(coalesce(new.codigo, '')));
    normal := public.normalizar_codigo(new.codigo);

    if new.codigo !~ '^[A-Z0-9][A-Z0-9-]{2,18}[A-Z0-9]$' then
      raise exception 'El código lleva de 4 a 20 letras o números, y puede llevar guiones en medio.';
    end if;

    -- Que no choque con ningun otro codigo del sitio: los del vendedor, los
    -- destacados ni los convenios. Al escribirlo en «¿Tienes un código?» no
    -- habria forma de saber cual era.
    if exists (
      select 1 from public.embajadores e
       where public.normalizar_codigo(e.codigo) = normal
          or public.normalizar_codigo(e.codigo_destacado) = normal
    ) or exists (
      select 1 from public.convenios c where public.normalizar_codigo(c.codigo) = normal
    ) or exists (
      select 1 from public.cupones_de_vendedor x where public.normalizar_codigo(x.codigo) = normal
    ) then
      raise exception 'Ese código ya existe. Elige otro.';
    end if;
  end if;

  -- Estrenar o volver a encender: solo un vendedor activo, y hasta tres.
  if new.activo then
    if not exists (
      select 1 from public.embajadores e
       where e.perfil_id = new.embajador_id and e.estado = 'activo'
    ) then
      raise exception 'Tu cuenta de ventas está en pausa: no puedes activar cupones.';
    end if;

    if (select count(*) from public.cupones_de_vendedor x
         where x.embajador_id = new.embajador_id and x.activo and x.id <> new.id)
       >= public.tope_de_cupones_de_vendedor() then
      raise exception 'Ya tienes tres cupones activos. Desactiva uno para estrenar otro.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists al_guardar_cupon_de_vendedor on public.cupones_de_vendedor;
create trigger al_guardar_cupon_de_vendedor
  before insert or update on public.cupones_de_vendedor
  for each row execute function public.revisar_cupon_de_vendedor();

revoke all on public.cupones_de_vendedor from anon, authenticated;
grant select, insert, update on public.cupones_de_vendedor to authenticated;

alter table public.cupones_de_vendedor enable row level security;

drop policy if exists cupones_de_vendedor_lectura on public.cupones_de_vendedor;
create policy cupones_de_vendedor_lectura on public.cupones_de_vendedor
  for select to authenticated
  using (embajador_id = (select auth.uid()) or public.es_admin());

drop policy if exists cupones_de_vendedor_crea on public.cupones_de_vendedor;
create policy cupones_de_vendedor_crea on public.cupones_de_vendedor
  for insert to authenticated
  with check (embajador_id = (select auth.uid()) and public.es_vendedor());

drop policy if exists cupones_de_vendedor_cambia on public.cupones_de_vendedor;
create policy cupones_de_vendedor_cambia on public.cupones_de_vendedor
  for update to authenticated
  using (embajador_id = (select auth.uid()) or public.es_admin())
  with check (embajador_id = (select auth.uid()) or public.es_admin());

-- ---------------------------------------------------------------- el vinculo
alter table public.referidos
  add column if not exists descuento integer check (descuento between 0 and 50),
  add column if not exists cupon_id  uuid references public.cupones_de_vendedor (id) on delete set null;

comment on column public.referidos.descuento is
  'El % que le toca a la marca en su primer pago, fijado al poner el codigo: 15 el fijo, el suyo un cupon, 0 el destacado. Ver migracion 000073.';

update public.referidos
   set descuento = case tipo when 'destacado' then 0 else 15 end
 where descuento is null;

/**
 * Que es un codigo de vendedor: de quien, de que tipo, cuanto descuenta y, si
 * es un cupon, cual. Interna: la usan `codigo_de_asesor` y `vincular_embajador`
 * para que las dos reconozcan lo mismo.
 */
create or replace function public.buscar_codigo_de_vendedor(p_codigo text)
returns table (embajador_id uuid, nombre text, tipo text, porcentaje integer, cupon_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  with normal as (select public.normalizar_codigo(p_codigo) as c)
  select e.perfil_id, coalesce(p.nombre, 'un asesor'), q.tipo, q.porcentaje, q.cupon
    from public.embajadores e
    join public.perfiles p on p.id = e.perfil_id
    cross join normal n
    cross join lateral (
      select 'descuento'::text as tipo, public.descuento_de_embajador() as porcentaje, null::uuid as cupon
       where e.codigo is not null and public.normalizar_codigo(e.codigo) = n.c
      union all
      select 'destacado', 0, null
       where e.codigo_destacado is not null and public.normalizar_codigo(e.codigo_destacado) = n.c
      union all
      select 'descuento', x.porcentaje, x.id
        from public.cupones_de_vendedor x
       where x.embajador_id = e.perfil_id and x.activo
         and public.normalizar_codigo(x.codigo) = n.c
    ) q
   where e.estado = 'activo'
     and n.c <> ''
   limit 1;
$$;

revoke all on function public.buscar_codigo_de_vendedor(text) from public, anon, authenticated;

-- Devuelve ademas el porcentaje: «¿Tienes un código?» enseña el precio con el
-- descuento de ese cupon. Cambia lo que devuelve, asi que se recrea.
drop function if exists public.codigo_de_asesor(text);

create function public.codigo_de_asesor(p_codigo text)
returns table (nombre text, tipo text, porcentaje integer)
language sql
stable
security definer
set search_path = ''
as $$
  select b.nombre, b.tipo, b.porcentaje from public.buscar_codigo_de_vendedor(p_codigo) b;
$$;

revoke all on function public.codigo_de_asesor(text) from public, anon;
grant execute on function public.codigo_de_asesor(text) to authenticated;

-- Igual que en la 000070, pero reconoce los cupones y guarda el descuento.
create or replace function public.vincular_embajador(p_marca uuid, p_codigo text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v record;
  v_actual uuid;
  v_tipo_actual text;
begin
  if not public.posee_marca(p_marca) then
    raise exception 'Ese negocio no es tuyo.';
  end if;

  select * into v from public.buscar_codigo_de_vendedor(p_codigo);

  if v.embajador_id is null then
    return null;
  end if;

  if v.embajador_id = (select auth.uid()) then
    raise exception 'Es tu propio código de embajador: compártelo con otros negocios.';
  end if;

  select r.embajador_id, r.tipo into v_actual, v_tipo_actual
    from public.referidos r where r.marca_id = p_marca;

  -- Volver a poner un codigo del mismo vendedor y del mismo tipo no cambia
  -- nada: el descuento ya quedo fijado la primera vez.
  if v_actual = v.embajador_id and v_tipo_actual = v.tipo then
    return v.nombre;
  elsif v_actual = v.embajador_id then
    raise exception 'Tu negocio ya tiene el otro código de este asesor. Es uno u otro: descuento o destacado.';
  elsif v_actual is not null then
    raise exception 'Tu negocio ya tiene un código de embajador.';
  end if;

  if public.marca_ya_pago(p_marca) then
    raise exception 'El código de embajador es para negocios que todavía no pagan, y tu negocio ya pagó antes.';
  end if;

  insert into public.referidos (marca_id, embajador_id, tipo, descuento, cupon_id)
  values (p_marca, v.embajador_id, v.tipo, v.porcentaje, v.cupon_id);
  return v.nombre;
end;
$$;

-- Lo que le pone el cupon de Stripe al primer pago: ahora con su porcentaje.
drop function if exists public.codigo_de_embajador_de(uuid);

create function public.codigo_de_embajador_de(p_marca uuid)
returns table (codigo text, embajador text, embajador_id uuid, descuento integer)
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(x.codigo, e.codigo), coalesce(p.nombre, 'un embajador'), e.perfil_id,
         coalesce(r.descuento, public.descuento_de_embajador())
    from public.referidos r
    join public.embajadores e on e.perfil_id = r.embajador_id
    join public.perfiles p on p.id = e.perfil_id
    left join public.cupones_de_vendedor x on x.id = r.cupon_id
   where r.marca_id = p_marca
     and r.tipo = 'descuento'
     and coalesce(r.descuento, 1) > 0
     and r.monto_pagado is null
     and e.estado = 'activo'
     and (public.posee_marca(p_marca) or public.es_admin() or (select auth.uid()) is null);
$$;

revoke all on function public.codigo_de_embajador_de(uuid) from public, anon;
grant execute on function public.codigo_de_embajador_de(uuid) to authenticated, service_role;

/** Los cupones de quien mira, con cuantos negocios puso cada uno. */
create or replace function public.mis_cupones_de_vendedor()
returns table (
  id uuid,
  codigo text,
  porcentaje integer,
  activo boolean,
  creado_en timestamptz,
  desactivado_en timestamptz,
  negocios integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select x.id, x.codigo, x.porcentaje, x.activo, x.creado_en, x.desactivado_en,
         (select count(*)::integer from public.referidos r where r.cupon_id = x.id)
    from public.cupones_de_vendedor x
   where x.embajador_id = (select auth.uid())
   order by x.activo desc, x.creado_en desc;
$$;

revoke all on function public.mis_cupones_de_vendedor() from public, anon;
grant execute on function public.mis_cupones_de_vendedor() to authenticated;

-- ---------------------------------------------------------------- el tablero
-- Lo de la 000070 mas cuanto descuento se llevo cada negocio y con que codigo.
drop function if exists public.mis_referidos();

create function public.mis_referidos()
returns table (
  marca text,
  vinculado_en timestamptz,
  cobros integer,
  total_pagado numeric,
  total_comision numeric,
  por_cobrar numeric,
  ultimo_cobro timestamptz,
  sigue_pagando boolean,
  tipo text,
  descuento integer,
  cupon text
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.nombre_comercial,
         r.vinculado_en,
         count(c.id)::integer,
         coalesce(sum(c.monto_pagado), 0),
         coalesce(sum(c.comision), 0),
         coalesce(sum(c.comision) filter (where c.pago_id is null), 0),
         max(c.cobrado_en),
         exists (
           select 1 from public.suscripciones su
             join public.sucursales s on s.id = su.sucursal_id
            where s.marca_id = r.marca_id and su.estado = 'activo' and su.monto_por_cobro > 0
         ),
         r.tipo,
         r.descuento,
         x.codigo
    from public.referidos r
    join public.marcas m on m.id = r.marca_id
    left join public.cupones_de_vendedor x on x.id = r.cupon_id
    left join public.comisiones c on c.marca_id = r.marca_id and c.embajador_id = r.embajador_id
   where r.embajador_id = (select auth.uid())
   group by m.nombre_comercial, r.vinculado_en, r.marca_id, r.tipo, r.descuento, x.codigo
   order by r.vinculado_en desc;
$$;

revoke all on function public.mis_referidos() from public, anon;
grant execute on function public.mis_referidos() to authenticated;
