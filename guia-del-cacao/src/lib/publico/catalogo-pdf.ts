import { cargarImagen, enCuadroJpeg, encogida } from "@/lib/descargas";
import type { DatoDeContacto } from "@/lib/redes";
import { pesos } from "@/lib/tipos";

/**
 * El catálogo de una sucursal, en un PDF que cualquiera puede bajarse.
 *
 * Se arma en el navegador, igual que el cartel del mostrador y por el mismo
 * motivo: las fotos pesan lo que el negocio haya subido —hasta 5 MB cada una—
 * y hacerlo en el servidor obligaría a descargarlas todas en cada visita al
 * micrositio, la pulse alguien o no. Aquí se piden una sola vez, y solo cuando
 * alguien pulsa el botón. De paso el navegador ya tiene en caché las que se
 * están viendo en la cuadrícula.
 *
 * `jspdf` se importa dinámicamente dentro de la función: son 350 KB que no
 * tienen por qué viajar en el paquete de un micrositio que casi nadie va a
 * imprimir.
 *
 * **Lleva la identidad de la guía: selva de noche y oro, con su brillo.** El
 * encabezado y el pie son la misma noche del sitio —un degradado del violeta a
 * la selva, con el halo violeta de arriba y las tres auroras de color— y el
 * oro brilla: halos detrás de los logos, estrellas con resplandor, el filo que
 * deja una luz dorada sobre la hoja y el precio en la píldora de `boton-oro`.
 * Los títulos van en serif (Times, la que trae jsPDF y más se parece a
 * Fraunces). Hasta octubre de 2026 la noche era un azul plano con una franja
 * verde pegada abajo, y se leía forzada: el sitio nunca enseña un color liso.
 * El centro de la hoja se queda claro a propósito: un
 * catálogo con precios se imprime, y una hoja entera de noche gasta un
 * cartucho por copia y sale con marco blanco en cuanto la impresora impone su
 * margen. La noche va donde se reconoce la marca, no debajo de los precios.
 */

/** Un producto, ya con la URL de su foto resuelta por el servidor. */
export type ProductoDelPdf = {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio: number | null;
  /** URL pública, o null si no tiene foto. */
  foto: string | null;
};

export type CatalogoParaPdf = {
  marca: string;
  sucursal: string;
  /** "Villahermosa, Tabasco" o solo la entidad. Null si no hay ni eso. */
  lugar: string | null;
  /** URL pública del logo del negocio, o null. */
  logo: string | null;
  /** La dirección del micrositio, para que el PDF sepa volver a su origen. */
  url: string;
  /**
   * Teléfono, correo, ubicación y redes, ya resueltos por `listaDeContacto`.
   *
   * Es lo que vuelve útil a un catálogo que salió de la plataforma: quien lo
   * abre en su teléfono, o lo recibe impreso, no tiene de dónde sacar el número
   * del negocio si no va en la hoja.
   */
  contacto: DatoDeContacto[];
  productos: ProductoDelPdf[];
};

/* A4 vertical, en milímetros. */
const ANCHO_HOJA = 210;
const ALTO_HOJA = 297;
const MARGEN = 14;
const ANCHO_UTIL = ANCHO_HOJA - MARGEN * 2;

/*
  Tres columnas y la foto cuadrada, como en la cuadrícula del micrositio: un
  producto suele estar centrado en su foto y el cuadro es lo que más se le
  parece a la retícula de un catálogo. Con cuatro columnas cabían doce por hoja,
  pero la descripción bajaba a un cuerpo que ya no se lee en papel.
*/
const COLUMNAS = 3;
const HUECO = 6;
const ANCHO_TARJETA = (ANCHO_UTIL - HUECO * (COLUMNAS - 1)) / COLUMNAS;

/*
  El bloque de texto mide lo mismo en todas las tarjetas aunque unas
  descripciones ocupen dos renglones y otras ninguno: así el precio queda a la
  misma altura en toda la fila, que es lo que hace comparable una retícula.
*/
// 26 y no 23: con dos renglones de nombre y dos de descripción, la última
// línea se montaba sobre la píldora del precio.
const ALTO_TEXTO = 26;
const ALTO_TARJETA = ANCHO_TARJETA + ALTO_TEXTO;
const HUECO_FILA = 7;

/*
  Dos columnas para el contacto, no tres: son pocos datos y en tres quedaban
  tan cortas que `instagram.com/chocolateria-la-mazorca` no cabía sin recortarse
  justo en la parte que hay que teclear.
*/
const COLUMNAS_CONTACTO = 2;
const ALTO_FILA_CONTACTO = 6;

/**
 * Lo que mide la caja del contacto con `filas` renglones.
 *
 * Está aquí y no repetida en los dos sitios que la necesitan —`cierre`, que
 * decide si cabe, y `bloqueDeContacto`, que la dibuja— porque la primera vez
 * estuvo escrita dos veces: cambiar el alto de la fila en una y no en la otra
 * habría dejado la caja midiendo una cosa y ocupando otra, sin que nada fallara
 * hasta verlo impreso.
 */
function altoDeLaCaja(filas: number) {
  return filas * ALTO_FILA_CONTACTO + 6;
}

/**
 * Cómo se reparte el contacto: el mapa a lo ancho y lo demás en dos columnas.
 *
 * El enlace de Maps es el único que puede ser largo de verdad
 * (`google.com/maps/place/…/@18.26,-93.2,17z/data=…`) y en media caja salía
 * recortado con puntos suspensivos. Un teléfono cortado se nota; una dirección
 * cortada parece entera y no lleva a ningún sitio, que es peor. Los demás
 * —un correo, un `@usuario`, diez dígitos— caben de sobra en media caja.
 */
function repartoDelContacto(contacto: DatoDeContacto[]) {
  const mapa = contacto.find((dato) => dato.clave === "maps") ?? null;
  const resto = contacto.filter((dato) => dato.clave !== "maps");
  const filasResto = Math.ceil(resto.length / COLUMNAS_CONTACTO);

  return { mapa, resto, filasResto, filas: (mapa ? 1 : 0) + filasResto };
}

/** Hasta dónde puede llegar el contenido antes de chocar con el pie. */
const TOPE_ABAJO = ALTO_HOJA - 16;

/* La paleta de la selva de noche (`globals.css`), escrita en RGB. */
type Rgb = [number, number, number];
const NOCHE: Rgb = [28, 18, 54];
/**
 * La noche de arriba abajo, con las mismas paradas que el fondo del sitio
 * (`#1c1236` → `#0f2a22` → `#0b1f16`), un poco más violeta arriba porque ahí
 * le cae el halo. Cada parada es [dónde, color].
 */
const CIELO: [number, Rgb][] = [
  [0, [38, 22, 70]],
  [0.45, [28, 18, 54]],
  [0.8, [15, 42, 34]],
  [1, [11, 31, 22]],
];
const VIOLETA: Rgb = [120, 70, 170];
const GUAYABA: Rgb = [255, 93, 115];
const LIMA: Rgb = [168, 217, 74];
/** El degradado de `boton-oro`: de oro claro a mango. */
const BOTON_ORO: [number, Rgb][] = [
  [0, [255, 224, 138]],
  [0.5, [255, 183, 3]],
  [1, [255, 159, 67]],
];
const INK: Rgb = [34, 21, 14];
const ORO: Rgb = [255, 183, 3];
const ORO_CLARO: Rgb = [255, 209, 102];
/** Oro oscuro: el dorado de verdad no se lee como texto sobre papel blanco. */
const ORO_TINTA: Rgb = [150, 100, 6];
const CREMA: Rgb = [255, 247, 232];
const CREMA_ORO: Rgb = [255, 244, 214];
const FILO: Rgb = [236, 205, 135];
const CACAO: Rgb = [74, 44, 29];

/**
 * Estrellas doradas sobre una banda de noche, en sitios fijos y no al azar:
 * dos catálogos del mismo negocio tienen que salir iguales.
 */
const ESTRELLAS: [number, number, number][] = [
  [0.04, 0.22, 0.5], [0.13, 0.78, 0.35], [0.27, 0.12, 0.3], [0.38, 0.86, 0.45],
  [0.49, 0.3, 0.25], [0.58, 0.72, 0.4], [0.66, 0.16, 0.3], [0.74, 0.9, 0.3],
  [0.83, 0.42, 0.25], [0.92, 0.12, 0.45], [0.97, 0.7, 0.3], [0.33, 0.5, 0.2],
];

/** La foto se guarda a 480 px: a 57 mm de ancho eso son ~215 ppp, de sobra. */
const LADO_FOTO = 480;

const FECHA_LARGA = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/**
 * La nota del final, la que el negocio necesita que esté ahí.
 *
 * Un PDF se guarda, se reenvía y se imprime, y seis meses después alguien llega
 * al mostrador con él en la mano pidiendo el precio que dice. El asterisco es
 * lo que separa "esto era así el día que lo bajaste" de "esto es lo que cuesta".
 */
function nota(fecha: string) {
  return [
    `* Los precios y los productos de este catálogo son los que el negocio tenía publicados en Guía del Cacao el ${fecha}.`,
    "** Pueden cambiar sin aviso, y pueden ser distintos en otras sucursales de la misma marca o en temporadas y días de promoción.",
    "*** Lo que se cobra en el mostrador es lo que vale: confirma con el negocio antes de tu visita.",
  ];
}

type Doc = import("jspdf").jsPDF;

/** El color de un degradado en `t` (0 a 1), entre sus paradas. */
function colorEn(paradas: [number, Rgb][], t: number): Rgb {
  for (let i = 1; i < paradas.length; i += 1) {
    const [hasta, b] = paradas[i];
    if (t <= hasta) {
      const [desde, a] = paradas[i - 1];
      const k = (t - desde) / (hasta - desde || 1);
      return [0, 1, 2].map((c) => Math.round(a[c] + (b[c] - a[c]) * k)) as Rgb;
    }
  }
  return paradas[paradas.length - 1][1];
}

/**
 * Las líneas de un texto que caben en `ancho`, con puntos suspensivos si sobra.
 *
 * Se recorta letra a letra y no quitando la última palabra: una palabra larga
 * —"chocolate de mesa artesanal"— dejaba la línea a media caja, con un hueco
 * que se leía como un error de maquetación.
 */
function enLineas(doc: Doc, texto: string, ancho: number, maxLineas: number) {
  const lineas: string[] = doc.splitTextToSize(texto, ancho);
  if (lineas.length <= maxLineas) return lineas;

  const cortadas = lineas.slice(0, maxLineas);
  let ultima = cortadas[maxLineas - 1];

  while (ultima.length > 1 && doc.getTextWidth(`${ultima}…`) > ancho) {
    ultima = ultima.slice(0, -1);
  }

  cortadas[maxLineas - 1] = `${ultima.trimEnd()}…`;
  return cortadas;
}

/**
 * Trae y encoge todas las fotos de una vez.
 *
 * En paralelo y no en fila: veinte productos pedidos uno tras otro son veinte
 * viajes encadenados, y el botón se queda "armando" tanto rato que parece roto.
 * La que no cargue se queda fuera del mapa y su tarjeta sale con la inicial,
 * igual que en el micrositio cuando el producto nunca tuvo foto.
 */
async function traerFotos(productos: ProductoDelPdf[]) {
  const fotos = new Map<string, string>();

  await Promise.all(
    productos
      .filter((producto) => producto.foto)
      .map(async (producto) => {
        const img = await cargarImagen(producto.foto as string);
        if (!img) return;

        const jpeg = enCuadroJpeg(img, LADO_FOTO, "#ffffff");
        if (jpeg) fotos.set(producto.id, jpeg);
      }),
  );

  return fotos;
}

export async function armarCatalogoPdf(datos: CatalogoParaPdf): Promise<Blob> {
  const { jsPDF, GState } = await import("jspdf");

  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const opaco = new GState({ opacity: 1 });
  const fecha = FECHA_LARGA.format(new Date());

  const [fotos, logoNegocio, logoGuia] = await Promise.all([
    traerFotos(datos.productos),
    datos.logo
      ? cargarImagen(datos.logo).then((img) => (img ? encogida(img, 300) : null))
      : Promise.resolve(null),
    cargarImagen("/marca/logotipo.png").then((img) =>
      img ? encogida(img, 300) : null,
    ),
  ]);

  doc.setProperties({
    title: `Catálogo · ${datos.marca} · ${datos.sucursal}`,
    subject: `Catálogo al ${fecha}`,
    creator: "Guía del Cacao",
  });

  let y = portada();

  for (let i = 0; i < datos.productos.length; i += COLUMNAS) {
    // Se pregunta fila por fila en vez de repartir un número fijo por hoja: la
    // primera trae el encabezado del negocio y le caben menos que a las demás.
    if (y + ALTO_TARJETA > TOPE_ABAJO) {
      doc.addPage();
      y = encabezadoDeArriba();
    }

    datos.productos
      .slice(i, i + COLUMNAS)
      .forEach((producto, columna) => tarjeta(producto, columna, y));

    y += ALTO_TARJETA + HUECO_FILA;
  }

  cierre(y);
  pies();

  return doc.output("blob");

  /* ----------------------------------------------------------------- */

  /*
    El brillo. jsPDF no pinta degradados ni desenfoques, así que se hacen a
    mano: un degradado son franjas finas de color que va cambiando, y un halo
    son elipses concéntricas casi transparentes que se suman hacia el centro.
    Lo que se pinta dentro de una banda se recorta a ella (`recortado`) para que
    el halo no se derrame sobre la parte clara de la hoja.
  */

  function transparencia(opacidad: number) {
    doc.setGState(opacidad >= 1 ? opaco : new GState({ opacity: opacidad }));
  }

  /** Dibuja `pintar` recortado al rectángulo (redondeado si `radio`). */
  function recortado(x: number, y: number, ancho: number, alto: number, radio: number, pintar: () => void) {
    doc.saveGraphicsState();
    if (radio > 0) doc.roundedRect(x, y, ancho, alto, radio, radio, null);
    else doc.rect(x, y, ancho, alto, null);
    doc.clip();
    doc.discardPath();
    pintar();
    doc.restoreGraphicsState();
  }

  /** Un degradado de arriba abajo (o de izquierda a derecha con `horizontal`). */
  function degradado(
    x: number,
    y: number,
    ancho: number,
    alto: number,
    paradas: [number, Rgb][],
    horizontal = false,
  ) {
    const largo = horizontal ? ancho : alto;
    const pasos = Math.max(2, Math.ceil(largo / 0.4));
    const paso = largo / pasos;
    for (let i = 0; i < pasos; i += 1) {
      doc.setFillColor(...colorEn(paradas, (i + 0.5) / pasos));
      // Cada franja se pasa un poco sobre la siguiente: sin eso el visor deja
      // ver rayitas claras entre ellas al acercar.
      if (horizontal) doc.rect(x + i * paso, y, paso + 0.15, alto, "F");
      else doc.rect(x, y + i * paso, ancho, paso + 0.15, "F");
    }
  }

  /** Un resplandor suave: elipses que se van sumando hacia el centro. */
  function halo(cx: number, cy: number, rx: number, ry: number, color: Rgb, fuerza: number) {
    const capas = 14;
    doc.setFillColor(...color);
    transparencia(fuerza / capas);
    for (let i = 0; i < capas; i += 1) {
      const k = 1 - i / capas;
      doc.ellipse(cx, cy, rx * k, ry * k, "F");
    }
    transparencia(1);
  }

  /** El aura de una caja: rectángulos redondeados que crecen y se apagan. */
  function aura(x: number, y: number, ancho: number, alto: number, radio: number, color: Rgb, fuerza: number, extension = 2.4) {
    const capas = 6;
    doc.setFillColor(...color);
    transparencia(fuerza / capas);
    for (let i = capas; i >= 1; i -= 1) {
      const e = (extension * i) / capas;
      doc.roundedRect(x - e, y - e, ancho + e * 2, alto + e * 2, radio + e, radio + e, "F");
    }
    transparencia(1);
  }

  /** Una estrella que brilla: el punto, su resplandor y, si `destello`, la cruz. */
  function estrella(x: number, y: number, r: number, destello: boolean) {
    halo(x, y, r * 4.5, r * 4.5, ORO_CLARO, 0.45);
    doc.setFillColor(...ORO_CLARO);
    if (destello) {
      doc.ellipse(x, y, r * 3.6, r * 0.32, "F");
      doc.ellipse(x, y, r * 0.32, r * 3.6, "F");
    }
    doc.setFillColor(255, 246, 214);
    doc.circle(x, y, r * 0.75, "F");
  }

  /**
   * El filo de oro de una banda y la luz que deja: unas franjas doradas que se
   * apagan hacia `hacia` (1 = hacia abajo, -1 = hacia arriba).
   */
  function filoQueBrilla(y: number, hacia: 1 | -1) {
    const pasos = 10;
    doc.setFillColor(...ORO);
    for (let i = 0; i < pasos; i += 1) {
      transparencia(0.22 * (1 - i / pasos));
      doc.rect(0, hacia === 1 ? y + i * 0.35 : y - (i + 1) * 0.35, ANCHO_HOJA, 0.36, "F");
    }
    transparencia(1);
    degradado(0, hacia === 1 ? y - 0.9 : y, ANCHO_HOJA, 0.9, [
      [0, ORO],
      [0.5, ORO_CLARO],
      [1, ORO],
    ], true);
  }

  /** La píldora de `boton-oro`: el degradado, su brillo de arriba y su aura. */
  function pildoraDeOro(x: number, y: number, ancho: number, alto: number) {
    const radio = alto / 2;
    aura(x, y, ancho, alto, radio, [255, 159, 67], 0.35, 1.6);
    recortado(x, y, ancho, alto, radio, () => {
      degradado(x, y, ancho, alto, BOTON_ORO, true);
      // El filo claro de arriba que tiene el botón en el sitio.
      doc.setFillColor(255, 255, 255);
      transparencia(0.3);
      doc.rect(x, y, ancho, alto * 0.42, "F");
      transparencia(1);
    });
  }

  /** El encabezado de la primera hoja. Devuelve dónde empieza la retícula. */
  function portada() {
    // La banda va de orilla a orilla, como el encabezado del sitio.
    const alto = 50;
    bandaDeNoche(0, alto);

    let x = MARGEN;

    if (logoNegocio) {
      // El logo del negocio, en su medallón crema con filo de oro: sobre la
      // noche, un logo de fondo oscuro se perdía sin él. Detrás, el halo
      // dorado lo enciende como a las tarjetas del sitio.
      recortado(0, 0, ANCHO_HOJA, alto, 0, () => halo(x + 15, 24, 30, 26, ORO, 0.55));
      aura(x, 9, 30, 30, 5, ORO, 0.5, 2);
      doc.setFillColor(...CREMA);
      doc.setDrawColor(...ORO);
      doc.setLineWidth(0.8);
      doc.roundedRect(x, 9, 30, 30, 5, 5, "FD");
      doc.addImage(logoNegocio, "PNG", x + 2.5, 11.5, 25, 25);
      x += 37;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...ORO);
    doc.text("CATÁLOGO", x, 15, { charSpace: 0.8 });

    doc.setFont("times", "bold");
    doc.setFontSize(22);
    doc.setTextColor(...CREMA);
    // El nombre se recorta contra el hueco que deja el logotipo de la guía:
    // un nombre comercial largo se le metía encima.
    const anchoNombre = ANCHO_HOJA - MARGEN - 34 - x;
    doc.text(enLineas(doc, datos.marca, anchoNombre, 1)[0], x, 25);

    doc.setFont("times", "italic");
    doc.setFontSize(12);
    doc.setTextColor(...ORO_CLARO);
    doc.text(enLineas(doc, datos.sucursal, anchoNombre, 1)[0], x, 31.5);

    if (datos.lugar) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...CREMA);
      doc.text(enLineas(doc, datos.lugar, anchoNombre, 1)[0], x, 37);
    }

    if (logoGuia) {
      recortado(0, 0, ANCHO_HOJA, alto, 0, () =>
        halo(ANCHO_HOJA - MARGEN - 14, 23, 26, 22, ORO, 0.5),
      );
      doc.addImage(logoGuia, "PNG", ANCHO_HOJA - MARGEN - 28, 9, 28, 28);
    }

    return tituloDeSeccion(alto + 12);
  }

  /**
   * Una banda de noche a todo lo ancho: el degradado del cielo, el halo violeta
   * y las auroras del sitio, estrellas que brillan y el filo de oro con su luz.
   * La comparten la portada, el encabezado de las demás hojas y el pie; el pie
   * lleva el filo arriba (`filoArriba`) y su luz sube hacia la hoja.
   */
  function bandaDeNoche(arriba: number, alto: number, filoArriba = false) {
    recortado(0, arriba, ANCHO_HOJA, alto, 0, () => {
      degradado(0, arriba, ANCHO_HOJA, alto, CIELO);

      // El halo violeta de arriba y las tres auroras, como `body` y
      // `.aurora` en globals.css. Se escalan con la banda para que el pie,
      // que es delgado, no quede todo rosa.
      const k = Math.min(1, alto / 50);
      halo(ANCHO_HOJA / 2, arriba, ANCHO_HOJA * 0.55, alto * 1.1, VIOLETA, 0.75);
      halo(ANCHO_HOJA * 0.18, arriba + alto * 0.4, 50 * k + 10, alto * 0.75, GUAYABA, 0.22);
      halo(ANCHO_HOJA * 0.82, arriba + alto * 0.35, 50 * k + 10, alto * 0.75, LIMA, 0.17);
      halo(ANCHO_HOJA * 0.5, arriba + alto * 0.95, 60 * k + 10, alto * 0.6, ORO, 0.2);

      // En el pie, que mide 12 mm, no caben estrellas sin caer encima del texto.
      if (alto > 15) {
        ESTRELLAS.forEach(([fx, fy, r], i) => {
          estrella(fx * ANCHO_HOJA, arriba + fy * alto, r, i % 3 === 0);
        });
      }
    });

    filoQueBrilla(filoArriba ? arriba : arriba + alto, filoArriba ? -1 : 1);
  }

  /** La banda delgada de las hojas siguientes, para que no queden anónimas. */
  function encabezadoDeArriba() {
    bandaDeNoche(0, 22);

    if (logoGuia) doc.addImage(logoGuia, "PNG", MARGEN, 4, 13, 13);

    const x = MARGEN + (logoGuia ? 16 : 0);

    doc.setFont("times", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...CREMA);
    doc.text(datos.marca, x, 10.5);

    doc.setFont("times", "italic");
    doc.setFontSize(9);
    doc.setTextColor(...ORO_CLARO);
    doc.text(datos.sucursal, x, 15.5);

    return 31;
  }

  /** "Catálogo", con la cuenta y la fecha a la derecha. */
  function tituloDeSeccion(arriba: number) {
    // «Nuestros *productos*»: la palabra clave en itálica dorada, como los
    // títulos del sitio.
    doc.setFont("times", "bold");
    doc.setFontSize(16);
    doc.setTextColor(...NOCHE);
    doc.text("Nuestros", MARGEN, arriba);
    const sangria = doc.getTextWidth("Nuestros ");
    doc.setFont("times", "bolditalic");
    doc.setTextColor(...ORO_TINTA);
    doc.text("productos", MARGEN + sangria, arriba);

    const cuantos = datos.productos.length;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...CACAO);
    doc.text(
      `${cuantos} ${cuantos === 1 ? "producto" : "productos"} · precios al ${fecha}`,
      ANCHO_HOJA - MARGEN,
      arriba,
      { align: "right" },
    );

    filoDeOro(arriba + 3);

    return arriba + 9;
  }

  /** La raya bajo un título: un tramo de oro pleno y luego un filo fino. */
  function filoDeOro(y: number) {
    doc.setDrawColor(...FILO);
    doc.setLineWidth(0.3);
    doc.line(MARGEN, y, ANCHO_HOJA - MARGEN, y);
    pildoraDeOro(MARGEN, y - 0.7, 20, 1.4);
  }

  /** Una tarjeta de producto: foto, nombre, descripción y precio. */
  function tarjeta(producto: ProductoDelPdf, columna: number, arriba: number) {
    const x = MARGEN + columna * (ANCHO_TARJETA + HUECO);
    const RADIO = 3.5;

    // El aura dorada de la tarjeta: la luz que en el sitio tienen las tarjetas
    // al pasar el dedo, y lo que las despega de la hoja sin una sombra gris.
    aura(x, arriba, ANCHO_TARJETA, ALTO_TARJETA, RADIO, ORO, 0.28, 2.2);

    const foto = fotos.get(producto.id);

    // Todo lo de dentro se recorta a la tarjeta: la foto respeta sus esquinas
    // redondeadas en vez de asomarse por encima del filo.
    recortado(x, arriba, ANCHO_TARJETA, ALTO_TARJETA, RADIO, () => {
      // La ficha va en crema, el color de fondo del sitio, y no en blanco de
      // papel: es lo que la hace parecer una tarjeta de la guía.
      doc.setFillColor(...CREMA);
      doc.rect(x, arriba, ANCHO_TARJETA, ALTO_TARJETA, "F");

      if (foto) {
        doc.addImage(foto, "JPEG", x, arriba, ANCHO_TARJETA, ANCHO_TARJETA);
      } else {
        // Sin foto, la inicial dorada sobre la noche: lo mismo que enseña el
        // micrositio, y no un hueco en blanco que se lee como una tarjeta a
        // medio cargar.
        degradado(x, arriba, ANCHO_TARJETA, ANCHO_TARJETA, CIELO);
        halo(x + ANCHO_TARJETA / 2, arriba + ANCHO_TARJETA / 2, ANCHO_TARJETA * 0.5, ANCHO_TARJETA * 0.5, ORO, 0.4);

        doc.setFont("times", "bolditalic");
        doc.setFontSize(34);
        doc.setTextColor(...ORO_CLARO);
        doc.text(
          producto.nombre.charAt(0).toUpperCase(),
          x + ANCHO_TARJETA / 2,
          arriba + ANCHO_TARJETA / 2 + 5,
          { align: "center" },
        );
      }

      // La línea que separa la foto del texto: sin ella, una foto de fondo
      // claro se derrama en la ficha y la tarjeta pierde su borde de abajo.
      degradado(x, arriba + ANCHO_TARJETA - 0.5, ANCHO_TARJETA, 1, BOTON_ORO, true);
    });

    doc.setDrawColor(...FILO);
    doc.setLineWidth(0.5);
    doc.roundedRect(x, arriba, ANCHO_TARJETA, ALTO_TARJETA, RADIO, RADIO, "S");

    const izquierda = x + 3;
    const anchoTexto = ANCHO_TARJETA - 6;
    let texto = arriba + ANCHO_TARJETA + 5;

    doc.setFont("times", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...NOCHE);
    for (const linea of enLineas(doc, producto.nombre, anchoTexto, 2)) {
      doc.text(linea, izquierda, texto);
      texto += 3.6;
    }

    if (producto.descripcion) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...CACAO);
      for (const linea of enLineas(doc, producto.descripcion, anchoTexto, 2)) {
        doc.text(linea, izquierda, texto + 0.8);
        texto += 3;
      }
    }

    /*
      El precio se cuelga del borde de abajo de la tarjeta, no del final de lo
      que haya escrito encima: encadenado, un producto sin descripción dejaba su
      precio cuatro milímetros más arriba que el de al lado y la fila se leía
      torcida.

      Y va aquí, aunque en el directorio se quitó: dentro de un catálogo de un
      solo negocio no hay con quién comparar, y el precio es justo lo que
      alguien quiere saber antes de ir hasta allá.
    */
    if (producto.precio !== null) {
      // En la píldora de `boton-oro`, con la tinta oscura que lleva el botón.
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      const precio = pesos(producto.precio);
      const anchoPrecio = doc.getTextWidth(precio) + 6;
      const base = arriba + ALTO_TARJETA - 4;
      pildoraDeOro(izquierda - 0.5, base - 3.9, anchoPrecio, 5.4);
      doc.setTextColor(...INK);
      doc.text(precio, izquierda + 2.5, base);
    } else {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...CACAO);
      doc.text("Precio a consultar", izquierda, arriba + ALTO_TARJETA - 4);
    }
  }

  /**
   * Dónde encontrar al negocio, después del catálogo.
   *
   * Va al final y no en el encabezado por lo mismo que en el micrositio: quien
   * mira un catálogo primero mira qué hay, y pregunta cómo llegar cuando ya vio
   * algo que quiere. En cada hoja queda además la dirección del micrositio, al
   * pie, para quien se quede solo con una página suelta.
   *
   * Los datos se escriben con `textWithLink`: en la pantalla se pulsan —el
   * teléfono marca, el correo abre el correo, la red abre la red— y en papel
   * siguen siendo lo que hay que teclear, porque se lee la dirección y no un
   * "pulsa aquí" que impreso no lleva a ningún sitio.
   */
  function bloqueDeContacto(arriba: number) {
    const RELLENO = 8;
    const ANCHO_ETIQUETA = 24;

    const { mapa, resto, filasResto, filas } = repartoDelContacto(datos.contacto);
    const alto = altoDeLaCaja(filas);
    const anchoColumna = (ANCHO_UTIL - RELLENO * 2 - 6) / COLUMNAS_CONTACTO;

    doc.setFont("times", "bold");
    doc.setFontSize(16);
    doc.setTextColor(...NOCHE);
    doc.text("Visítanos", MARGEN, arriba + 4);

    filoDeOro(arriba + 7);

    const caja = arriba + 11;

    // La caja va de noche, como el pie del sitio: es lo que se busca al final,
    // y así se encuentra de un vistazo. Con su cielo, su halo y su aura de oro.
    aura(MARGEN, caja, ANCHO_UTIL, alto, 4, ORO, 0.4, 2.2);
    recortado(MARGEN, caja, ANCHO_UTIL, alto, 4, () => {
      degradado(MARGEN, caja, ANCHO_UTIL, alto, CIELO);
      halo(MARGEN + ANCHO_UTIL * 0.3, caja, ANCHO_UTIL * 0.5, alto * 1.2, VIOLETA, 0.6);
      halo(MARGEN + ANCHO_UTIL * 0.85, caja + alto, ANCHO_UTIL * 0.3, alto, ORO, 0.18);
    });
    doc.setDrawColor(...ORO);
    doc.setLineWidth(0.5);
    doc.roundedRect(MARGEN, caja, ANCHO_UTIL, alto, 4, 4, "S");

    /** Un renglón: la etiqueta en negrita y el dato, que además es enlace. */
    function renglon(dato: DatoDeContacto, x: number, y: number, ancho: number) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...ORO);
      doc.text(dato.etiqueta, x, y);

      /*
        El dato va un punto más grande que su etiqueta, y no al revés: la
        etiqueta se adivina por el contexto —nadie confunde un correo con un
        teléfono— y lo que hay que poder leer, copiar o dictar es el dato.
      */
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...CREMA);
      doc.textWithLink(
        enLineas(doc, dato.texto, ancho - ANCHO_ETIQUETA, 1)[0],
        x + ANCHO_ETIQUETA,
        y,
        { url: dato.enlace },
      );
    }

    const izquierda = MARGEN + RELLENO;
    let y = caja + 6.5;

    if (mapa) {
      renglon(mapa, izquierda, y, ANCHO_UTIL - RELLENO * 2);
      y += ALTO_FILA_CONTACTO;
    }

    resto.forEach((dato, i) => {
      // Se llena una columna entera antes de pasar a la siguiente: la lista se
      // lee de arriba abajo, y repartida en zigzag el teléfono quedaba encima
      // del TikTok.
      const columna = Math.floor(i / filasResto);
      const fila = i % filasResto;

      renglon(
        dato,
        izquierda + columna * (anchoColumna + 6),
        y + fila * ALTO_FILA_CONTACTO,
        anchoColumna,
      );
    });

    return caja + alto + 6;
  }

  /**
   * El contacto y los asteriscos, que cierran el catálogo.
   *
   * Los dos se miden antes de dibujar nada y se mueven juntos a la hoja
   * siguiente si no caben. Cada uno comprobando por su cuenta si cabía, salía
   * una hoja entera ocupada solo por la nota —el contacto apuraba el final de
   * la anterior y empujaba los asteriscos él solo—, y una página con tres
   * renglones de letra chica se lee como un error de impresión.
   */
  function cierre(arriba: number) {
    const altoContacto =
      datos.contacto.length > 0
        ? 11 + altoDeLaCaja(repartoDelContacto(datos.contacto).filas) + 6
        : 0;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    const partidas = nota(fecha).flatMap((linea) =>
      doc.splitTextToSize(linea, ANCHO_UTIL - 12) as string[],
    );
    const altoNota = partidas.length * 3.4 + 9;

    if (arriba + altoContacto + altoNota > TOPE_ABAJO) {
      doc.addPage();
      arriba = encabezadoDeArriba();
    }

    if (datos.contacto.length > 0) arriba = bloqueDeContacto(arriba);

    notaFinal(arriba, partidas, altoNota);
  }

  /** Los asteriscos del final, en su propia caja. */
  function notaFinal(arriba: number, partidas: string[], alto: number) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);

    doc.setFillColor(...CREMA_ORO);
    doc.roundedRect(MARGEN, arriba, ANCHO_UTIL, alto, 3, 3, "F");

    pildoraDeOro(MARGEN + 2.5, arriba + 3, 2.2, alto - 6);

    doc.setTextColor(...CACAO);
    let y = arriba + 6.5;

    for (const linea of partidas) {
      doc.text(linea, MARGEN + 8, y);
      y += 3.4;
    }

    return arriba + alto;
  }

  /**
   * El pie de todas las hojas, al final y de una vez.
   *
   * No se puede escribir al cerrar cada página porque "de 4" no se sabe hasta
   * que se dibujó la última tarjeta.
   */
  function pies() {
    const total = doc.getNumberOfPages();

    for (let hoja = 1; hoja <= total; hoja += 1) {
      doc.setPage(hoja);

      bandaDeNoche(ALTO_HOJA - 12, 12, true);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...CREMA);
      doc.textWithLink(datos.url, MARGEN, ALTO_HOJA - 5, { url: datos.url });

      doc.setTextColor(...ORO_CLARO);
      doc.text(
        `Guía del Cacao · ${hoja} de ${total}`,
        ANCHO_HOJA - MARGEN,
        ALTO_HOJA - 5,
        { align: "right" },
      );
    }
  }
}
