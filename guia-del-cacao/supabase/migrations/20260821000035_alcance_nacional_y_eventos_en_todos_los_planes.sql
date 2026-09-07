-- La guia deja de ser de Tabasco y pasa a ser de Mexico.
--
-- Mientras todo estaba en Tabasco la pregunta "donde?" no existia: bastaba con
-- el enlace de Google Maps. En cuanto entran negocios de Chiapas y Oaxaca esa
-- pregunta es la primera que hace quien busca, y el directorio no la sabe
-- contestar. Sin entidad no hay filtro, y un directorio nacional sin filtro por
-- estado es una lista que nadie termina de leer.
--
-- La columna no se puede llamar `estado`: ese nombre ya lo ocupa el enum de
-- publicacion (borrador / publicado / pausado) desde la migracion 000001.
alter table public.sucursales
  add column if not exists entidad text,
  add column if not exists ciudad text;

-- Todo lo que existe hoy es de Tabasco, asi que el relleno no inventa nada.
update public.sucursales set entidad = 'Tabasco' where entidad is null;

alter table public.sucursales
  alter column entidad set not null;

-- Las 32 entidades, escritas como las escribe el INEGI. Se valida con un check
-- y no con una tabla de catalogo porque la lista no cambia nunca y el
-- directorio filtra por esta columna en cada carga: un join por consulta seria
-- pagar un peaje permanente por una lista que lleva un siglo igual.
alter table public.sucursales
  drop constraint if exists sucursales_entidad_check;

alter table public.sucursales
  add constraint sucursales_entidad_check check (entidad in (
    'Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche',
    'Chiapas', 'Chihuahua', 'Ciudad de México', 'Coahuila', 'Colima',
    'Durango', 'Estado de México', 'Guanajuato', 'Guerrero', 'Hidalgo',
    'Jalisco', 'Michoacán', 'Morelos', 'Nayarit', 'Nuevo León', 'Oaxaca',
    'Puebla', 'Querétaro', 'Quintana Roo', 'San Luis Potosí', 'Sinaloa',
    'Sonora', 'Tabasco', 'Tamaulipas', 'Tlaxcala', 'Veracruz', 'Yucatán',
    'Zacatecas'
  ));

-- La ciudad se queda opcional a proposito: de las sucursales que ya existen no
-- se puede deducir sin inventarla. El formulario la pide, y hasta que su dueno
-- la escriba la ficha se muestra solo con la entidad.
comment on column public.sucursales.entidad is
  'Entidad federativa donde esta la sucursal. Es el filtro principal del directorio nacional.';

comment on column public.sucursales.ciudad is
  'Ciudad o municipio. Opcional: las sucursales anteriores al alcance nacional no la tenian.';

-- El directorio publico lista por entidad dentro de lo publicado.
create index if not exists sucursales_entidad_idx
  on public.sucursales (entidad)
  where estado = 'publicado';

-- ---------------------------------------------------------------------------
-- Publicar eventos deja de ser del plan mas caro
-- ---------------------------------------------------------------------------
--
-- `puede_publicar_contenido` gobernaba dos cosas distintas con una sola
-- bandera: publicar en la comunidad y anunciar eventos. Al apagarse la
-- comunidad solo le queda la segunda, y dejarla en Premier significaba cobrar
-- $399 por publicar una cata.
--
-- En el sondeo a chocolateras, el unico negocio que eligio "anunciar mis catas
-- y talleres" como su unica funcion dijo que pagaria entre $150 y $300. El plan
-- que se lo permitia costaba mas que su techo declarado.
--
-- Los planes se siguen distinguiendo por `max_sucursales` (1 / 3 / 20) y por el
-- banner de la portada, que es lo que de verdad escala con el tamano del
-- negocio.
update public.tiers set puede_publicar_contenido = true;

comment on column public.tiers.puede_publicar_contenido is
  'Permite anunciar eventos. Hoy la tienen los tres planes: publicar una cata no es un privilegio de plan caro. Mientras la comunidad estuvo activa esta bandera tambien la gobernaba.';
