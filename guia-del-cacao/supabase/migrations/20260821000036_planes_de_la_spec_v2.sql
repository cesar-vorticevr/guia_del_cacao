-- Los planes de la spec v2.
--
-- La escalera cambia de forma. Antes cada plan se distinguia por cuantas
-- sucursales dejaba tener; ahora se distingue por lo que la sucursal puede
-- hacer, y el cobro es por sucursal:
--
--   Tier 1  $99   aparecer en el directorio, catalogo y datos de contacto
--   Tier 2  $199  + puede recibir resenas y responderlas
--   Tier 3  $299  + puede publicar eventos y noticias, y sale en el banner
--
-- Sale de la encuesta a 19 negocios de septiembre (Anexo A de la spec): 37%
-- solo usaria la plataforma si es gratis y pone su techo de "esto ya es caro"
-- en $200. Con la escalera anterior -199/299/399- ese tercio del mercado no
-- tenia por donde entrar. El Tier 1 a $99 es la puerta para ellos.

-- ---------------------------------------------------------------------------
-- Resenas: dejan de ser de todos
-- ---------------------------------------------------------------------------
--
-- Es la bandera que hace que el Tier 2 valga cien pesos mas que el Tier 1. Sin
-- ella la escalera no se sostiene: entre "apareces" y "apareces y ademas
-- publicas eventos" no habia un escalon intermedio que alguien quisiera pagar.
alter table public.tiers
  add column if not exists permite_resenas boolean not null default false;

comment on column public.tiers.permite_resenas is
  'Si su micrositio ensena resenas y acepta nuevas. Es lo unico que separa al Tier 1 del Tier 2 (spec v2 §5.1).';

-- ---------------------------------------------------------------------------
-- Los tres planes
-- ---------------------------------------------------------------------------
update public.tiers set precio_mensual = 99.00,  permite_resenas = false, puede_publicar_contenido = false where id = 1;
update public.tiers set precio_mensual = 199.00, permite_resenas = true,  puede_publicar_contenido = false where id = 2;
update public.tiers set precio_mensual = 299.00, permite_resenas = true,  puede_publicar_contenido = true  where id = 3;

-- Publicar eventos vuelve al Tier 3.
--
-- En la migracion 000035 se bajo a los tres planes, y era lo correcto entonces:
-- con el Tier 3 a $399 se estaba cobrando el plan mas caro por anunciar una
-- cata, por encima del techo que declaro el unico negocio que eligio los
-- eventos como su unica funcion. La v2 lo arregla por la raiz bajando el Tier 3
-- a $299, que cae dentro de ese rango, asi que el escalon vuelve a su sitio.
comment on column public.tiers.puede_publicar_contenido is
  'Permite publicar eventos y noticias. Solo Tier 3 (spec v2 §5.3). Estuvo en los tres planes entre las migraciones 000035 y 000036, mientras el Tier 3 costaba $399.';

-- Las mazorcas se eliminan del producto, no solo se apagan en la interfaz. La
-- columna se queda para no romper lo que la lee, pero ningun plan las incluye:
-- asi, si alguien enciende `FUNCIONES.mazorcas` por error, no aparecen solas.
update public.tiers set puede_dar_puntos = false;

comment on column public.tiers.puede_dar_puntos is
  'Sin uso desde la spec v2, que elimina el sistema de puntos del producto. Se queda en false en los tres planes.';

-- ---------------------------------------------------------------------------
-- Se acaba el tope de sucursales por plan
-- ---------------------------------------------------------------------------
--
-- "El cobro es por sucursal. Una marca con 3 sucursales paga 3 suscripciones
-- independientes, cada una con su propio tier" (spec v2 §5.1). Con eso, un tope
-- por plan no tiene sentido: cobrarle a alguien por su cuarta sucursal y
-- ademas impedirsela seria cobrar dos veces por lo mismo.
--
-- El trigger se va; la funcion `tope_de_sucursales` se queda porque todavia la
-- consulta el panel, y devolver un numero grande es mas seguro que borrarla y
-- que la pantalla reviente.
drop trigger if exists al_crear_sucursal_3_tope on public.sucursales;

update public.tiers set max_sucursales = 999;

comment on column public.tiers.max_sucursales is
  'Sin uso desde la spec v2: el cobro es por sucursal y no hay tope por plan. Se deja en 999 para que lo que todavia lo consulte no encuentre un limite.';
