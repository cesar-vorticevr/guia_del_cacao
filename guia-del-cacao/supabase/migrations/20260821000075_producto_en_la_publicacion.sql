-- Un negocio etiqueta un producto de su catalogo en lo que publica.
--
-- La publicacion lo muestra con su foto y su precio, y lleva a la tienda del
-- negocio, donde se puede pedir. Solo un producto, y solo **de la marca que
-- firma** la publicacion (`sucursal_id`): una persona no firma con sucursal, asi
-- que no etiqueta, y un negocio no puede anunciar lo de otro.
--
-- Si el negocio borra el producto, la etiqueta se cae sola (`on delete set
-- null`) y la publicacion se queda como estaba.

alter table public.publicaciones
  add column if not exists producto_id uuid
  references public.productos_servicios (id) on delete set null;

comment on column public.publicaciones.producto_id is
  'El producto del catalogo que el negocio etiqueto en la publicacion. Solo de la marca que la firma. Ver migracion 000075.';

create index if not exists publicaciones_producto_idx on public.publicaciones (producto_id);

create or replace function public.revisar_producto_de_publicacion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.producto_id is null then
    return new;
  end if;

  if new.sucursal_id is null or not exists (
    select 1
      from public.productos_servicios p
      join public.sucursales s on s.marca_id = p.marca_id
     where p.id = new.producto_id
       and s.id = new.sucursal_id
  ) then
    raise exception 'Ese producto no es del catálogo del negocio que publica.';
  end if;

  return new;
end;
$$;

drop trigger if exists al_guardar_producto_de_publicacion on public.publicaciones;
create trigger al_guardar_producto_de_publicacion
  before insert or update of producto_id, sucursal_id on public.publicaciones
  for each row execute function public.revisar_producto_de_publicacion();
