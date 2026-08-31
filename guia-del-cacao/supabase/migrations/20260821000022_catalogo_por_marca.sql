-- El catalogo deja de ser de cada sucursal y pasa a ser de la marca.
--
-- Hasta ahora cada sucursal cargaba sus productos desde cero. Una chocolateria
-- con tres locales subia la misma barra tres veces, con su foto y su precio, y
-- al cambiar el precio tenia que acordarse de los tres. El catalogo es de la
-- marca: lo que cambia una sucursal de "Chocolates Grijalva" no es un producto
-- distinto del de otra, es el mismo.
--
-- Lo que cada sucursal decide es **cuales de esos productos maneja**, y eso vive
-- en la tabla puente `productos_sucursal`. Editar o borrar en el catalogo se ve
-- en todas las sucursales sin tocar nada mas, porque no hay copias: hay una
-- fila y varias sucursales apuntando a ella.

-- ---------------------------------------------------------------------------
-- 1. Los planes, con nombres de plan
-- ---------------------------------------------------------------------------

update public.tiers set nombre = 'Básico'  where id = 1;
update public.tiers set nombre = 'Plus'    where id = 2;
update public.tiers set nombre = 'Premier' where id = 3;

-- ---------------------------------------------------------------------------
-- 2. El producto cuelga de la marca
-- ---------------------------------------------------------------------------

alter table public.productos_servicios
  add column if not exists marca_id uuid references public.marcas (id) on delete cascade,
  add column if not exists sku text;

comment on column public.productos_servicios.sku is
  'Clave interna del negocio. Opcional: sirve para cruzarlo con su inventario.';

update public.productos_servicios p
   set marca_id = s.marca_id
  from public.sucursales s
 where s.id = p.sucursal_id
   and p.marca_id is null;

-- ---------------------------------------------------------------------------
-- 3. Que productos maneja cada sucursal
-- ---------------------------------------------------------------------------

create table if not exists public.productos_sucursal (
  sucursal_id uuid not null references public.sucursales (id) on delete cascade,
  producto_id uuid not null references public.productos_servicios (id) on delete cascade,
  fecha_creacion timestamptz not null default now(),
  primary key (sucursal_id, producto_id)
);

comment on table public.productos_sucursal is
  'Que productos del catalogo de la marca maneja cada sucursal. Sin copias: el precio y la foto viven en productos_servicios.';

create index if not exists productos_sucursal_producto_idx
  on public.productos_sucursal (producto_id);

-- Lo que cada sucursal tenia cargado pasa a ser lo que maneja.
insert into public.productos_sucursal (sucursal_id, producto_id)
select p.sucursal_id, p.id
  from public.productos_servicios p
 where p.sucursal_id is not null
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 4. Juntar los duplicados que dejo el modelo viejo
-- ---------------------------------------------------------------------------

/*
  Si tres sucursales de la misma marca cargaron "Chocolate de mesa", ahora serian
  tres renglones distintos del mismo catalogo. Se conserva el mas viejo y las
  demas sucursales pasan a apuntar a el.

  El orden importa: primero se repunta todo lo que referencia al duplicado
  —incluidas las solicitudes de monedas ya cursadas, que no se pueden perder—, y
  solo despues se borra.
*/
create temporary table sobrevivientes on commit drop as
  select
    p.id as duplicado,
    first_value(p.id) over (
      partition by p.marca_id, lower(btrim(p.nombre))
      order by p.fecha_creacion, p.id
    ) as se_queda
  from public.productos_servicios p
 where p.marca_id is not null;

update public.solicitud_productos sp
   set producto_id = s.se_queda
  from sobrevivientes s
 where sp.producto_id = s.duplicado
   and s.duplicado <> s.se_queda;

insert into public.productos_sucursal (sucursal_id, producto_id)
select ps.sucursal_id, s.se_queda
  from public.productos_sucursal ps
  join sobrevivientes s on s.duplicado = ps.producto_id
 where s.duplicado <> s.se_queda
on conflict do nothing;

delete from public.productos_servicios p
 using sobrevivientes s
 where p.id = s.duplicado
   and s.duplicado <> s.se_queda;

-- ---------------------------------------------------------------------------
-- 5. Cerrar el modelo nuevo
-- ---------------------------------------------------------------------------

alter table public.productos_servicios
  alter column marca_id set not null;

-- `sucursal_id` se queda un tiempo por si hay que mirar atras, pero ya no manda
-- nada: quien lea productos de una sucursal pasa por `productos_sucursal`.
alter table public.productos_servicios
  alter column sucursal_id drop not null;

comment on column public.productos_servicios.sucursal_id is
  'EN DESUSO desde esta migracion. La relacion vive en productos_sucursal.';

create index if not exists productos_marca_idx
  on public.productos_servicios (marca_id);

-- ---------------------------------------------------------------------------
-- 6. RLS del modelo nuevo
-- ---------------------------------------------------------------------------

/** Si la marca tiene al menos una sucursal publicada, su catalogo es visible. */
create or replace function public.marca_con_sucursal_publicada(p_marca uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select exists (
    select 1 from public.sucursales s
     where s.marca_id = p_marca and s.estado = 'publicado'
  );
$fn$;

drop policy if exists productos_lectura on public.productos_servicios;
drop policy if exists productos_escritura on public.productos_servicios;

create policy productos_lectura on public.productos_servicios
  for select using (
    public.marca_con_sucursal_publicada(marca_id)
    or public.posee_marca(marca_id)
    or public.es_admin()
  );

create policy productos_escritura on public.productos_servicios
  for all using (public.posee_marca(marca_id) or public.es_admin())
  with check (public.posee_marca(marca_id) or public.es_admin());

alter table public.productos_sucursal enable row level security;

create policy productos_sucursal_lectura on public.productos_sucursal
  for select using (
    public.sucursal_publicada(sucursal_id)
    or public.posee_sucursal(sucursal_id)
    or public.es_admin()
  );

create policy productos_sucursal_escritura on public.productos_sucursal
  for all using (public.posee_sucursal(sucursal_id) or public.es_admin())
  with check (public.posee_sucursal(sucursal_id) or public.es_admin());

grant select, insert, update, delete on public.productos_sucursal to authenticated;
grant select on public.productos_sucursal to anon;

-- ---------------------------------------------------------------------------
-- 7. Publicar exige productos elegidos, no productos cargados
-- ---------------------------------------------------------------------------

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
      select 2, 'la descripción (el "acerca de")'
        from public.sucursales s
       where s.id = p_sucursal and coalesce(btrim(s.acerca_de), '') = ''
      union all
      select 3, 'el logo'
        from public.sucursales s
       where s.id = p_sucursal and coalesce(btrim(s.logo), '') = ''
      union all
      select 4, 'elegir al menos un producto del catálogo'
       where not exists (
         select 1 from public.productos_sucursal ps where ps.sucursal_id = p_sucursal
       )
    ) pendientes;
$fn$;

-- ---------------------------------------------------------------------------
-- 8. Sin catalogo no hay sucursal
-- ---------------------------------------------------------------------------

/*
  Una sucursal sin nada que ofrecer no se puede publicar, y armarla antes de
  tener el catalogo obliga a ir y volver. Con el catalogo hecho, montar la
  segunda sucursal es elegir de una lista.
*/
create or replace function public.exigir_catalogo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  if public.es_admin() then
    return new;
  end if;

  if not exists (
    select 1 from public.productos_servicios p where p.marca_id = new.marca_id
  ) then
    raise exception 'Agrega al menos un producto a tu catálogo antes de crear una sucursal';
  end if;

  return new;
end;
$fn$;

/*
  Los tres triggers de alta corren en orden alfabetico, asi que van numerados:
  primero lo que se resuelve sin pagar (confirmar el correo, armar el catalogo)
  y al final el tope del plan. Al reves, a quien le falta todo se le pediria
  dinero antes que lo gratis.
*/
drop trigger if exists al_crear_sucursal_exigir_correo on public.sucursales;
drop trigger if exists al_crear_sucursal_exigir_tope on public.sucursales;
drop trigger if exists al_crear_sucursal_1_correo on public.sucursales;
drop trigger if exists al_crear_sucursal_2_catalogo on public.sucursales;
drop trigger if exists al_crear_sucursal_3_tope on public.sucursales;

create trigger al_crear_sucursal_1_correo
  before insert on public.sucursales
  for each row execute function public.exigir_correo_verificado();

create trigger al_crear_sucursal_2_catalogo
  before insert on public.sucursales
  for each row execute function public.exigir_catalogo();

create trigger al_crear_sucursal_3_tope
  before insert on public.sucursales
  for each row execute function public.exigir_tope_de_sucursales();
