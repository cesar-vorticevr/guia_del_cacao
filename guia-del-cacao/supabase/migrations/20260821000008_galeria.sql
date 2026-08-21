-- Guía del Cacao — carrusel de fotos del micrositio
--
-- El documento de estructura (§4) pide un carrusel de fotos por micrositio.
-- La especificacion tecnica §6 no lo listaba entre los campos de Sucursal, asi
-- que se agrega aqui.
--
-- Se guarda como arreglo de rutas y no como tabla aparte porque son pocas, van
-- ordenadas y siempre se leen junto con la sucursal: una tabla obligaria a un
-- join en cada visita al micrositio para no ganar nada.

alter table public.sucursales
  add column galeria text[] not null default '{}';

comment on column public.sucursales.galeria is
  'Rutas en el bucket micrositios, en el orden en que se muestran.';

-- PENDIENTE (§10): el limite por tier esta sin definir. Mientras tanto rige un
-- tope parejo de 8, suficiente para que el carrusel se vea bien y no tan alto
-- como para volver pesada la pagina en celular.
alter table public.sucursales
  add constraint galeria_maximo_8 check (cardinality(galeria) <= 8);
