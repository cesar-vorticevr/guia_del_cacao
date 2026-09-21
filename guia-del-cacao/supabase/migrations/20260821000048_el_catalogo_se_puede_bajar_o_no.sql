-- El negocio decide si su catálogo se puede bajar en PDF.
--
-- La descarga saca de la plataforma la lista de precios del negocio en un
-- archivo que se guarda, se reenvía y se imprime, y eso no le conviene a todo
-- el mundo: quien mueve precios cada semana, quien trabaja por pedido, o quien
-- sencillamente no quiere que su lista ande circulando. Es una decisión del
-- negocio, no de la plataforma, así que se pregunta en el alta —en el paso de
-- datos, junto al contacto— y se puede cambiar después.
--
-- **Esto no es una barrera de autorización, y no debe leerse como una.** Lo
-- que va en el PDF ya está a la vista en el micrositio, que es público: quien
-- quiera la lista la copia de la pantalla. La columna decide si la plataforma
-- *ofrece* el botón, que es una cortesía hacia el negocio, no un permiso. Por
-- eso no hay política nueva ni trigger: no hay nada que proteger aquí que no
-- esté ya publicado.
--
-- Nace en `true` y no en `false` a propósito. El catálogo descargable existe
-- para que el negocio se pueda compartir —es visibilidad, que es justo lo que
-- cuatro de cinco chocolateras eligieron en el sondeo—, y estrenarlo apagado
-- para todos dejaría la función escondida detrás de una casilla que nadie sabe
-- que tiene que ir a buscar. Quien no lo quiera la desmarca.
alter table public.sucursales
  add column if not exists catalogo_descargable boolean not null default true;

comment on column public.sucursales.catalogo_descargable is
  'Si el micrositio ofrece el boton de bajar el catalogo en PDF. No es un permiso: lo que lleva el PDF ya es publico en el micrositio. Nace encendida.';
