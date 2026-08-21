-- Guía del Cacao — datos de catalogo
--
-- Categorias (spec §3 del documento de estructura) y tiers (spec-tecnica §5.1).
-- Van en una migracion, no en seed.sql, porque produccion tambien los necesita:
-- sin tiers no se puede publicar un micrositio.

insert into public.categorias (nombre, slug, orden) values
  ('Productora / Finca', 'productora-finca', 1),
  ('Comercializadora', 'comercializadora', 2),
  ('Chocolatería', 'chocolateria', 3),
  ('Museo', 'museo', 4),
  ('Artesanías', 'artesanias', 5),
  ('Otros servicios', 'otros-servicios', 6);

insert into public.tiers (id, nombre, precio_mensual, puede_dar_puntos, puede_publicar_contenido, en_banner_principal) values
  (1, 'Tier 1',  99.00, false, false, false),
  (2, 'Tier 2', 199.00, true,  false, false),
  (3, 'Tier 3', 299.00, true,  true,  true);
