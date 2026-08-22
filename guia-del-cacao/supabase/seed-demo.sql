-- Guía del Cacao — población de demostración
--
-- Diez clientes y diez negocios con micrositio completo, catálogo con fotos,
-- eventos, noticias, reseñas y un foro con conversación. Existe para poder ver
-- la plataforma llena: con dos negocios y una reseña, la mitad de las
-- decisiones de diseño no se pueden juzgar.
--
-- Las contrasenas son todas `cacao12345`. La lista legible de cuentas vive en
-- CUENTAS-DE-PRUEBA.md, en la raiz de la app.
--
-- Las imagenes NO se crean aqui: las dibuja y sube `scripts/imagenes-de-demo.mjs`
-- sobre rutas fijas (`{sucursal_id}/logo.png`, `producto-1.png`, ...), que es a
-- lo que apuntan las columnas de abajo. Despues de un `db reset` hay que
-- volver a correr ese script o los micrositios saldran sin fotos.
--
-- Todo va con `on conflict do nothing` para poder correrlo tambien contra una
-- base que ya tiene datos, sin pisarle nada a nadie.

-- ---------------------------------------------------------------------------
-- Las cuentas
-- ---------------------------------------------------------------------------

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  email_change_token_current
)
select
  ('c0000000-0000-4000-a000-' || lpad(n::text, 12, '0'))::uuid,
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'cliente' || lpad(n::text, 2, '0') || '@guiadelcacao.mx',
  extensions.crypt('cacao12345', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  jsonb_build_object('nombre', 'Cliente ' || lpad(n::text, 2, '0'), 'rol', 'cliente'),
  now(), now(), '', '', '', '', ''
from generate_series(1, 10) n
on conflict (id) do nothing;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  email_change_token_current
)
select
  ('b0000000-0000-4000-a000-' || lpad(n::text, 12, '0'))::uuid,
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'negocio' || lpad(n::text, 2, '0') || '@guiadelcacao.mx',
  extensions.crypt('cacao12345', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  jsonb_build_object('nombre', 'Negocio ' || lpad(n::text, 2, '0'), 'rol', 'negocio'),
  now(), now(), '', '', '', '', ''
from generate_series(1, 10) n
on conflict (id) do nothing;

-- GoTrue espera una identidad por proveedor; sin esto el login por correo
-- puede no encontrar la cuenta.
insert into auth.identities (
  id, user_id, provider_id, provider, identity_data, created_at, updated_at
)
select u.id, u.id, u.id::text, 'email',
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       now(), now()
  from auth.users u
 where u.email like '%@guiadelcacao.mx'
   and not exists (select 1 from auth.identities i where i.user_id = u.id);

-- ---------------------------------------------------------------------------
-- Marcas y micrositios
-- ---------------------------------------------------------------------------

-- El numero de cada negocio es el que enlaza cuenta, marca, sucursal e
-- imagenes: negocio 03 -> marca ...03 -> sucursal 5a...03 -> sus fotos.
create temporary table negocios_demo (
  n integer primary key,
  marca text,
  categoria text,
  tier smallint,
  sucursal text,
  slug text,
  acerca text
);

insert into negocios_demo values
  (1,  'Hacienda La Luz',        'productora-finca', 3, 'Finca Comalcalco',      'hacienda-la-luz-finca-comalcalco',
       'Finca de cacao criollo con 90 anos de historia. Recorridos guiados y venta directa.'),
  (2,  'Chocolate Wolter',       'chocolateria',     3, 'Taller Villahermosa',   'chocolate-wolter-taller-villahermosa',
       'Chocolate de origen hecho en pequenos lotes. Barras, bombones y talleres de temperado.'),
  (3,  'Cacao Grijalva',         'comercializadora', 2, 'Bodega Centro',         'cacao-grijalva-bodega-centro',
       'Acopio y venta de grano seleccionado de la Chontalpa. Volumen y menudeo.'),
  (4,  'Museo del Cacao',        'museo',            3, 'Sede Comalcalco',       'museo-del-cacao-sede-comalcalco',
       'La historia del cacao en Tabasco, de los mayas a la barra moderna. Cata incluida.'),
  (5,  'Chocolateria Zurita',    'chocolateria',     1, 'Local Galerias',        'chocolateria-zurita-local-galerias',
       'Bombones artesanales y chocolate de mesa, receta de la abuela.'),
  (6,  'Finca Chontalpa',        'productora-finca', 2, 'Casa Grande',           'finca-chontalpa-casa-grande',
       'Cacao de sombra bajo arboles nativos. Fermentacion en cajas de madera.'),
  (7,  'Artesanias Cacao Vivo',  'artesanias',       1, 'Taller Nacajuca',       'artesanias-cacao-vivo-taller-nacajuca',
       'Jicaras, molinillos y utensilios de chocolate tallados a mano.'),
  (8,  'Ruta del Cacao',         'otros-servicios',  2, 'Oficina Villahermosa',  'ruta-del-cacao-oficina-villahermosa',
       'Tours de un dia por fincas, museos y chocolaterias de la region.'),
  (9,  'Chocolates Comalcalco',  'chocolateria',     3, 'Matriz Comalcalco',     'chocolates-comalcalco-matriz',
       'Tres generaciones haciendo chocolate de mesa. Tambien barras finas de origen.'),
  (10, 'Finca Jalapa',           'productora-finca', 1, 'Casa Jalapa',           'finca-jalapa-casa-jalapa',
       'Cacao de altura en la sierra. Visitas con cita previa.');

insert into public.marcas (id, perfil_id, nombre_comercial, categoria_id)
select ('ba000000-0000-4000-a000-' || lpad(d.n::text, 12, '0'))::uuid,
       ('b0000000-0000-4000-a000-' || lpad(d.n::text, 12, '0'))::uuid,
       d.marca,
       c.id
  from negocios_demo d
  join public.categorias c on c.slug = d.categoria
on conflict (id) do nothing;

insert into public.sucursales (
  id, marca_id, nombre_sucursal, slug, logo, imagen_fondo, acerca_de,
  ubicacion_maps_url, whatsapp, telefono, correo_contacto,
  tier_id, estado, fecha_publicacion, galeria
)
select
  ('5a000000-0000-4000-a000-' || lpad(d.n::text, 12, '0'))::uuid,
  ('ba000000-0000-4000-a000-' || lpad(d.n::text, 12, '0'))::uuid,
  d.sucursal,
  d.slug,
  '5a000000-0000-4000-a000-' || lpad(d.n::text, 12, '0') || '/logo.png',
  '5a000000-0000-4000-a000-' || lpad(d.n::text, 12, '0') || '/fondo.png',
  d.acerca,
  'https://maps.google.com/?q=Comalcalco+Tabasco',
  '9931' || lpad((100000 + d.n)::text, 6, '0'),
  '993' || lpad((1000000 + d.n * 7)::text, 7, '0'),
  'negocio' || lpad(d.n::text, 2, '0') || '@guiadelcacao.mx',
  d.tier,
  'publicado',
  now() - (d.n || ' days')::interval,
  array[
    '5a000000-0000-4000-a000-' || lpad(d.n::text, 12, '0') || '/galeria-1.png',
    '5a000000-0000-4000-a000-' || lpad(d.n::text, 12, '0') || '/galeria-2.png'
  ]
from negocios_demo d
on conflict (id) do nothing;

-- Publicado quiere decir pagado: sin la suscripcion, el micrositio no podria
-- volver al directorio si el negocio lo pausa (migracion 000012).
insert into public.suscripciones (sucursal_id, tier_id, monto_mensual, fecha_proximo_cobro, metodo_pago_stub)
select s.id, s.tier_id, t.precio_mensual, now() + interval '1 month', 'simulado-demo'
  from public.sucursales s
  join public.tiers t on t.id = s.tier_id
 where s.id::text like '5a000000-0000-4000-a000-%'
   and not exists (select 1 from public.suscripciones x where x.sucursal_id = s.id);

-- ---------------------------------------------------------------------------
-- Catalogo
-- ---------------------------------------------------------------------------

-- Cada sucursal toma cinco del catalogo, empezando en un punto distinto, para
-- que dos micrositios seguidos no se vean identicos.
create temporary table catalogo_demo (pos integer primary key, nombre text, descripcion text, precio numeric(10,2));

insert into catalogo_demo values
  (1,  'Barra 70% cacao',        'Origen Comalcalco, tostado medio',        85.00),
  (2,  'Barra con chile amashito','Amarga, con picor al final',             95.00),
  (3,  'Cacao en polvo 500 g',   'Sin azucar, molido fino',                120.00),
  (4,  'Chocolate de mesa',      'Tablilla para batir, receta de la casa',  70.00),
  (5,  'Bombones surtidos',      'Caja de 12 piezas',                      180.00),
  (6,  'Nibs tostados 250 g',    'Para reposteria o para picar',            90.00),
  (7,  'Recorrido guiado',       'Una hora, con degustacion al final',     250.00),
  (8,  'Taller de temperado',    'Tres horas, cupo de 8 personas',         650.00),
  (9,  'Molinillo de madera',    'Tallado a mano en Nacajuca',             240.00),
  (10, 'Jicara pintada',         'Pieza unica, pintada a mano',            190.00);

insert into public.productos_servicios (sucursal_id, nombre, descripcion, precio, imagen)
select s.id,
       c.nombre,
       c.descripcion,
       c.precio + (s.n * 5),
       s.id::text || '/producto-' || k || '.png'
  from (
    select id, (right(id::text, 2))::integer as n
      from public.sucursales
     where id::text like '5a000000-0000-4000-a000-%'
  ) s
  cross join generate_series(1, 5) k
  join catalogo_demo c on c.pos = ((s.n + k - 2) % 10) + 1
 where not exists (
   select 1 from public.productos_servicios p where p.sucursal_id = s.id
 );

-- ---------------------------------------------------------------------------
-- Monedas de los clientes
-- ---------------------------------------------------------------------------

-- El reparto no es al azar: hace falta gente en cada escalon para poder ver la
-- escalera funcionando. El 01 llega a Maestro (3 temas), el 02 y el 03 a
-- Conocedor (1 tema), y el resto va subiendo.
insert into public.rangos_usuario (usuario_id, anio, puntos_acumulados, rango_actual)
select ('c0000000-0000-4000-a000-' || lpad(m.n::text, 12, '0'))::uuid,
       extract(year from (now() at time zone 'America/Mexico_City'))::smallint,
       m.monedas,
       public.calcular_rango(m.monedas)
  from (values (1,120),(2,70),(3,55),(4,45),(5,30),(6,22),(7,15),(8,8),(9,3),(10,0)) as m(n, monedas)
on conflict (usuario_id, anio) do nothing;

-- ---------------------------------------------------------------------------
-- Eventos y noticias (solo Tier 3 puede publicarlos)
-- ---------------------------------------------------------------------------

insert into public.eventos (id, sucursal_id, titulo, subtitulo, contenido, imagenes, fecha_evento, rango_exclusivo)
values
  ('e0e0e0e0-0000-4000-a000-000000000001',
   '5a000000-0000-4000-a000-000000000001',
   'Cosecha abierta en la finca',
   'Corta tu propia mazorca',
   'Un sabado al mes abrimos la finca para que vengan a cortar mazorca, partirla y probar la pulpa fresca. Incluye desayuno y recorrido por los cajones de fermentacion.',
   array['5a000000-0000-4000-a000-000000000001/galeria-1.png'],
   now() + interval '9 days', null),
  ('e0e0e0e0-0000-4000-a000-000000000002',
   '5a000000-0000-4000-a000-000000000002',
   'Taller de temperado para principiantes',
   'Tres horas, ocho lugares',
   'Aprende a templar chocolate sin marmol ni termometro de laboratorio. Te llevas lo que hagas.',
   array['5a000000-0000-4000-a000-000000000002/galeria-2.png'],
   now() + interval '16 days', null),
  ('e0e0e0e0-0000-4000-a000-000000000003',
   '5a000000-0000-4000-a000-000000000004',
   'Cata a ciegas de origenes',
   'Solo para quienes ya saben',
   'Seis muestras de distintas fincas de la Chontalpa, sin etiqueta. Al final se revela cual era cual.',
   array['5a000000-0000-4000-a000-000000000004/galeria-1.png'],
   now() + interval '23 days', 4),
  ('e0e0e0e0-0000-4000-a000-000000000004',
   '5a000000-0000-4000-a000-000000000009',
   'Feria del chocolate de mesa',
   'Tres dias en el centro',
   'Nos juntamos con otros diez productores en la plaza. Habra molienda en vivo y venta directa.',
   array['5a000000-0000-4000-a000-000000000009/galeria-2.png'],
   now() + interval '31 days', null)
on conflict (id) do nothing;

insert into public.noticias (id, sucursal_id, titulo, subtitulo, contenido, imagenes, fecha_publicacion)
values
  ('40040040-0000-4000-a000-000000000001',
   '5a000000-0000-4000-a000-000000000001',
   'Cerramos la fermentacion de la temporada',
   'Casi dos toneladas este ano',
   'Terminamos de fermentar el ultimo lote. En dos semanas empieza el secado y en un mes ya hay grano nuevo a la venta.',
   array['5a000000-0000-4000-a000-000000000001/galeria-2.png'],
   now() - interval '4 days'),
  ('40040040-0000-4000-a000-000000000002',
   '5a000000-0000-4000-a000-000000000002',
   'Nueva barra con cacao de Jalapa',
   'Setenta y cinco por ciento, edicion corta',
   'Trabajamos con la gente de Finca Jalapa para sacar una barra de un solo origen. Son 400 piezas.',
   array['5a000000-0000-4000-a000-000000000002/galeria-1.png'],
   now() - interval '11 days'),
  ('40040040-0000-4000-a000-000000000003',
   '5a000000-0000-4000-a000-000000000009',
   'Ampliamos horario los domingos',
   'Ahora hasta las seis',
   'A partir de este mes abrimos los domingos hasta las seis de la tarde.',
   array['5a000000-0000-4000-a000-000000000009/galeria-1.png'],
   now() - interval '19 days')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Resenas y calificaciones
-- ---------------------------------------------------------------------------

-- Una calificacion de cada cliente a varias sucursales, para que el directorio
-- no salga todo "sin calificaciones".
insert into public.calificaciones (usuario_id, sucursal_id, estrellas)
select ('c0000000-0000-4000-a000-' || lpad(cli::text, 12, '0'))::uuid,
       ('5a000000-0000-4000-a000-' || lpad(suc::text, 12, '0'))::uuid,
       estrellas
  from (values
    (1,1,5),(2,1,4),(3,1,5),(4,1,4),
    (1,2,5),(2,2,5),(5,2,4),
    (3,3,3),(4,3,4),
    (1,4,5),(6,4,5),(7,4,4),
    (2,5,3),(8,5,4),
    (5,6,4),(9,6,3),
    (6,7,5),
    (7,8,2),(10,8,3),
    (1,9,5),(3,9,4),(8,9,5),(9,9,4),
    (4,10,3)
  ) as v(cli, suc, estrellas)
on conflict (usuario_id, sucursal_id) do nothing;

insert into public.resenas (id, usuario_id, sucursal_id, texto, fecha)
values
  ('4e5e4a00-0000-4000-a000-000000000001',
   'c0000000-0000-4000-a000-000000000001',
   '5a000000-0000-4000-a000-000000000001',
   'Fuimos en familia y valio cada peso. El recorrido no se siente turistico, te dejan meter la mano en todo.',
   now() - interval '6 days'),
  ('4e5e4a00-0000-4000-a000-000000000002',
   'c0000000-0000-4000-a000-000000000002',
   '5a000000-0000-4000-a000-000000000001',
   'El cacao fresco no se parece en nada a lo que uno cree. Lleven sombrero, no hay mucha sombra en el patio de secado.',
   now() - interval '13 days'),
  ('4e5e4a00-0000-4000-a000-000000000003',
   'c0000000-0000-4000-a000-000000000001',
   '5a000000-0000-4000-a000-000000000002',
   'La barra con chile es de otro mundo. Me llevaron a un taller y ahora hago mis propios bombones.',
   now() - interval '3 days'),
  ('4e5e4a00-0000-4000-a000-000000000004',
   'c0000000-0000-4000-a000-000000000003',
   '5a000000-0000-4000-a000-000000000009',
   'El chocolate de mesa de aqui es el que usaba mi abuela. No le cambien la receta.',
   now() - interval '8 days'),
  ('4e5e4a00-0000-4000-a000-000000000005',
   'c0000000-0000-4000-a000-000000000007',
   '5a000000-0000-4000-a000-000000000008',
   'El tour esta bien armado pero se sintio apurado. Nos faltó tiempo en la ultima finca.',
   now() - interval '15 days')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- El foro
-- ---------------------------------------------------------------------------

-- Quien abre cada tema no es casual: el 01 llego a Maestro y puede tres; el 02
-- y el 03 apenas a Conocedor y pueden uno; los negocios que abren tema son los
-- del Tier 3, que es lo que ese plan desbloqueo.
insert into public.temas_foro (id, autor_id, titulo, contenido, fecha)
values
  ('7e000000-0000-4000-a000-000000000001',
   'c0000000-0000-4000-a000-000000000001',
   'Rutas de cacao para un fin de semana',
   'Vengo de fuera y quiero armar dos dias completos: finca en la manana, museo en la tarde y chocolateria al final. Que orden recomiendan y cuanto tiempo dejo entre una y otra?',
   now() - interval '12 days'),
  ('7e000000-0000-4000-a000-000000000002',
   'c0000000-0000-4000-a000-000000000001',
   'Como guardan el chocolate en esta humedad',
   'Compre seis barras y en tres dias ya estaban blancas por fuera. Refrigerador si o no? Alguien tiene un truco que funcione en Villahermosa?',
   now() - interval '7 days'),
  ('7e000000-0000-4000-a000-000000000003',
   'c0000000-0000-4000-a000-000000000001',
   'Mi primer ano juntando monedas',
   'Llevo 120 monedas y todavia no me acostumbro a que pedirlas sea parte del paseo. Cuento lo que aprendi por si le sirve a alguien que va empezando.',
   now() - interval '2 days'),
  ('7e000000-0000-4000-a000-000000000004',
   'c0000000-0000-4000-a000-000000000002',
   'Lugares para ir con ninos',
   'Buscamos algo donde no se aburran a los diez minutos. Que fincas o museos tienen algo que puedan tocar o hacer ellos?',
   now() - interval '9 days'),
  ('7e000000-0000-4000-a000-000000000005',
   'c0000000-0000-4000-a000-000000000003',
   'Chocolate para reposteria: cual usan?',
   'Necesito algo que funde parejo para un pastel de cumpleanos. Cual me recomiendan sin que se me vaya el presupuesto?',
   now() - interval '5 days'),
  ('7e000000-0000-4000-a000-000000000006',
   'b0000000-0000-4000-a000-000000000001',
   'Como se seca el cacao en temporada de lluvia',
   'Nos preguntan seguido que hacemos cuando llueve tres dias seguidos. Aqui va como lo resolvemos nosotros, por si alguien mas anda con el mismo problema.',
   now() - interval '10 days'),
  ('7e000000-0000-4000-a000-000000000007',
   'b0000000-0000-4000-a000-000000000002',
   'Dudas frecuentes del taller de temperado',
   'Juntamos las preguntas que mas nos hacen antes de cada taller. Si tienen otra, dejenla aqui y la contestamos.',
   now() - interval '6 days'),
  ('7e000000-0000-4000-a000-000000000008',
   'b0000000-0000-4000-a000-000000000009',
   'Buscamos productores para la temporada',
   'Vamos a necesitar grano de la Chontalpa a partir del mes que entra. Si tienen fermentado propio, escribannos por aqui.',
   now() - interval '4 days')
on conflict (id) do nothing;

insert into public.comentarios_foro (tema_id, usuario_id, texto, fecha)
select ('7e000000-0000-4000-a000-' || lpad(v.tema::text, 12, '0'))::uuid,
       case when v.quien like 'b%'
            then ('b0000000-0000-4000-a000-' || lpad(substring(v.quien from 2)::text, 12, '0'))::uuid
            else ('c0000000-0000-4000-a000-' || lpad(substring(v.quien from 2)::text, 12, '0'))::uuid
       end,
       v.texto,
       now() - (v.hace || ' days')::interval
  from (values
    (1, 'c4', 'Finca en la manana sin duda, el patio de secado se ve mejor con sol.', 11),
    (1, 'c5', 'Deja al menos hora y media entre finca y museo, el camino no es rapido.', 10),
    (1, 'b1', 'Si vienen entre semana los recibimos sin cita. Fin de semana si conviene avisar.', 9),
    (1, 'c7', 'Nosotros lo hicimos al reves y funciono igual. El museo cierra temprano, ojo.', 8),
    (2, 'c6', 'A mi me sirvio guardarlas en un tupper con arroz. Suena raro pero jala.', 6),
    (2, 'b2', 'Lo blanco es la manteca que sube, no es que se echo a perder. Con 18 grados y sin cambios bruscos aguanta.', 6),
    (2, 'c9', 'Refrigerador no, se llena de humedad al sacarlo.', 5),
    (3, 'c4', 'Gracias por escribirlo, justo ando empezando y no sabia que se podia pedir en cada visita.', 1),
    (3, 'c8', 'Lo del tope de tres por dia no lo sabia, me hubiera ahorrado un viaje.', 1),
    (4, 'b4', 'En el museo tienen una parte donde muelen ellos mismos, a los ninos les encanta.', 8),
    (4, 'c6', 'La finca los deja partir mazorca, eso vale mas que cualquier explicacion.', 7),
    (4, 'c10', 'Nosotros fuimos con dos de seis y siete y salieron felices.', 6),
    (5, 'b9', 'El de mesa no sirve para eso, se corta. Busca uno de cobertura aunque suba un poco el precio.', 4),
    (5, 'c2', 'Yo uso el de 70 y me funciona, pero hay que templarlo bien.', 4),
    (6, 'c1', 'Muy util. Nunca me habia preguntado que pasaba cuando llueve toda la semana.', 9),
    (6, 'b6', 'Nosotros usamos secadora de gas los ultimos dos dias, aunque cambia un poco el perfil.', 8),
    (7, 'c3', 'Puedo llevar mis propios moldes?', 5),
    (7, 'b2', 'Si, mientras sean de policarbonato. Los de silicon no dan buen brillo.', 5),
    (7, 'c5', 'Apartado para el del mes que entra.', 4),
    (8, 'b6', 'Nosotros tenemos fermentado propio, les escribimos.', 3),
    (8, 'b10', 'Cuanto volumen estan buscando por entrega?', 3)
  ) as v(tema, quien, texto, hace)
 where not exists (
   select 1 from public.comentarios_foro c
    where c.tema_id = ('7e000000-0000-4000-a000-' || lpad(v.tema::text, 12, '0'))::uuid
 );

-- Unos cuantos apoyos. Ojo: el trigger mueve la moneda de verdad, asi que
-- estas filas cambian los saldos de arriba —quien apoya baja uno y el autor
-- sube uno—. Es lo que se quiere ver.
insert into public.apoyos_tema (tema_id, usuario_id)
select ('7e000000-0000-4000-a000-' || lpad(v.tema::text, 12, '0'))::uuid,
       ('c0000000-0000-4000-a000-' || lpad(v.cliente::text, 12, '0'))::uuid
  from (values (1,4),(1,5),(1,7),(3,2),(3,8),(4,6),(5,2)) as v(tema, cliente)
on conflict do nothing;

drop table negocios_demo;
drop table catalogo_demo;
