-- Un negocio puede ser varias cosas a la vez.
--
-- `marcas.categoria_id` obligaba a elegir una, y en este giro casi nadie es una
-- sola cosa. Lo dijo un encuestado sin que nadie le preguntara, al describir a
-- que se dedica: "Cultivo de cacao, transformacion Bean to bar, Museo, taller,
-- capacitacion, experiencia turistica, venta de chocolates propios y de otras
-- marcas. Todas las anteriores".
--
-- Con una sola categoria, ese negocio se quedaba fuera de cinco filtros de los
-- seis en los que deberia salir.

create table if not exists public.marcas_categorias (
  marca_id uuid not null references public.marcas (id) on delete cascade,
  categoria_id smallint not null references public.categorias (id),
  primary key (marca_id, categoria_id)
);

comment on table public.marcas_categorias is
  'A que se dedica una marca, que puede ser a varias cosas. `marcas.categoria_id` se queda como la principal -da el color de la ficha y el orden- y aqui viven todas, incluida esa.';

create index if not exists marcas_categorias_por_categoria_idx
  on public.marcas_categorias (categoria_id);

-- La que ya tenian entra como primera. No se pierde nada y nadie cambia de
-- cajon al migrar: lo que hoy es una chocolateria sigue siendo una
-- chocolateria, y desde ahora puede ser tambien museo.
insert into public.marcas_categorias (marca_id, categoria_id)
select m.id, m.categoria_id
  from public.marcas m
 where m.categoria_id is not null
on conflict do nothing;

comment on column public.marcas.categoria_id is
  'La categoria principal: la que pinta el color de la ficha y ordena. Las demas estan en `marcas_categorias`, que tambien contiene esta. Se conserva a proposito en vez de normalizar del todo, porque la ficha necesita **un** color y el directorio **un** orden, y eso hay que decidirlo con un dato y no con un conjunto.';

alter table public.marcas_categorias enable row level security;

-- A que se dedica un negocio es tan publico como su nombre: se lee sin sesion,
-- igual que `categorias` y que las marcas del directorio.
create policy marcas_categorias_lectura on public.marcas_categorias
  for select to anon, authenticated
  using (true);

create policy marcas_categorias_edita_su_dueno on public.marcas_categorias
  for all to authenticated
  using (public.posee_marca(marca_id) or public.es_admin())
  with check (public.posee_marca(marca_id) or public.es_admin());
