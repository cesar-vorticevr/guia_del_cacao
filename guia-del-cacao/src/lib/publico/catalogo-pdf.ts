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
 * **La hoja va en blanco, no en crema.** Es lo único que se aparta de la
 * pantalla, y es a propósito: un catálogo con precios se imprime, y una hoja
 * entera de fondo crema gasta tinta en cada copia y sale con un marco blanco
 * en cuanto la impresora impone su propio margen. La marca la ponen el
 * logotipo, los verdes y el mango, que es donde se reconoce.
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
const ALTO_TEXTO = 23;
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

/* Los tokens de `globals.css`, que aquí hay que escribir en RGB. */
const SELVA: [number, number, number] = [16, 107, 70];
const SELVA_2: [number, number, number] = [12, 82, 54];
const CACAO: [number, number, number] = [74, 44, 29];
const CREMA_2: [number, number, number] = [253, 238, 203];
const MANGO: [number, number, number] = [255, 183, 3];
const BORDE: [number, number, number] = [223, 214, 198];

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
  const { jsPDF } = await import("jspdf");

  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
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

  /** El encabezado de la primera hoja. Devuelve dónde empieza la retícula. */
  function portada() {
    const alto = 34;

    doc.setFillColor(...CREMA_2);
    doc.roundedRect(MARGEN, 10, ANCHO_UTIL, alto, 4, 4, "F");

    // La barra de mango de la izquierda es el mismo acento que lleva el cartel
    // del mostrador: de lejos, los dos papeles se reconocen como la misma casa.
    doc.setFillColor(...MANGO);
    doc.rect(MARGEN, 14, 2.5, alto - 8, "F");

    let x = MARGEN + 9;

    if (logoNegocio) {
      doc.addImage(logoNegocio, "PNG", x, 15, 24, 24);
      x += 30;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(17);
    doc.setTextColor(...SELVA_2);
    // El nombre se recorta contra el hueco que deja el logotipo de la guía:
    // un nombre comercial largo se le metía encima.
    const anchoNombre = ANCHO_HOJA - MARGEN - 34 - x;
    doc.text(enLineas(doc, datos.marca, anchoNombre, 1)[0], x, 24);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...CACAO);
    doc.text(enLineas(doc, datos.sucursal, anchoNombre, 1)[0], x, 30.5);

    if (datos.lugar) {
      doc.setFontSize(8.5);
      doc.text(enLineas(doc, datos.lugar, anchoNombre, 1)[0], x, 36);
    }

    if (logoGuia) {
      doc.addImage(logoGuia, "PNG", ANCHO_HOJA - MARGEN - 30, 15, 24, 24);
    }

    return tituloDeSeccion(alto + 10 + 9);
  }

  /** La banda delgada de las hojas siguientes, para que no queden anónimas. */
  function encabezadoDeArriba() {
    if (logoGuia) doc.addImage(logoGuia, "PNG", MARGEN, 10, 11, 11);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...SELVA_2);
    doc.text(datos.marca, MARGEN + (logoGuia ? 14 : 0), 15.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...CACAO);
    doc.text(datos.sucursal, MARGEN + (logoGuia ? 14 : 0), 20);

    doc.setDrawColor(...BORDE);
    doc.setLineWidth(0.3);
    doc.line(MARGEN, 25, ANCHO_HOJA - MARGEN, 25);

    return 31;
  }

  /** "Catálogo", con la cuenta y la fecha a la derecha. */
  function tituloDeSeccion(arriba: number) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...SELVA_2);
    doc.text("Catálogo", MARGEN, arriba);

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

    doc.setDrawColor(...BORDE);
    doc.setLineWidth(0.3);
    doc.line(MARGEN, arriba + 3, ANCHO_HOJA - MARGEN, arriba + 3);

    return arriba + 9;
  }

  /** Una tarjeta de producto: foto, nombre, descripción y precio. */
  function tarjeta(producto: ProductoDelPdf, columna: number, arriba: number) {
    const x = MARGEN + columna * (ANCHO_TARJETA + HUECO);

    doc.setDrawColor(...BORDE);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, arriba, ANCHO_TARJETA, ALTO_TARJETA, 3, 3, "S");

    const foto = fotos.get(producto.id);

    if (foto) {
      doc.addImage(foto, "JPEG", x, arriba, ANCHO_TARJETA, ANCHO_TARJETA);
    } else {
      // Sin foto, la inicial sobre crema: lo mismo que enseña el micrositio, y
      // no un hueco en blanco que se lee como una tarjeta a medio cargar.
      doc.setFillColor(...CREMA_2);
      doc.rect(x, arriba, ANCHO_TARJETA, ANCHO_TARJETA, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(30);
      doc.setTextColor(...SELVA);
      doc.text(
        producto.nombre.charAt(0).toUpperCase(),
        x + ANCHO_TARJETA / 2,
        arriba + ANCHO_TARJETA / 2 + 5,
        { align: "center" },
      );
    }

    // La línea que separa la foto del texto: sin ella, una foto de fondo claro
    // se derrama en la ficha y la tarjeta pierde su borde de abajo.
    doc.setDrawColor(...BORDE);
    doc.line(x, arriba + ANCHO_TARJETA, x + ANCHO_TARJETA, arriba + ANCHO_TARJETA);

    const izquierda = x + 3;
    const anchoTexto = ANCHO_TARJETA - 6;
    let texto = arriba + ANCHO_TARJETA + 5;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...SELVA_2);
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
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(...SELVA);
      doc.text(pesos(producto.precio), izquierda, arriba + ALTO_TARJETA - 4);
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

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...SELVA_2);
    doc.text("Contacto", MARGEN, arriba + 4);

    doc.setDrawColor(...BORDE);
    doc.setLineWidth(0.3);
    doc.line(MARGEN, arriba + 7, ANCHO_HOJA - MARGEN, arriba + 7);

    const caja = arriba + 11;

    doc.setFillColor(...CREMA_2);
    doc.roundedRect(MARGEN, caja, ANCHO_UTIL, alto, 3, 3, "F");

    /** Un renglón: la etiqueta en negrita y el dato, que además es enlace. */
    function renglon(dato: DatoDeContacto, x: number, y: number, ancho: number) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...SELVA_2);
      doc.text(dato.etiqueta, x, y);

      /*
        El dato va un punto más grande que su etiqueta, y no al revés: la
        etiqueta se adivina por el contexto —nadie confunde un correo con un
        teléfono— y lo que hay que poder leer, copiar o dictar es el dato.
      */
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...CACAO);
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

    doc.setFillColor(...CREMA_2);
    doc.roundedRect(MARGEN, arriba, ANCHO_UTIL, alto, 3, 3, "F");

    doc.setFillColor(...MANGO);
    doc.rect(MARGEN, arriba + 3, 2.5, alto - 6, "F");

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

      doc.setDrawColor(...BORDE);
      doc.setLineWidth(0.3);
      doc.line(MARGEN, ALTO_HOJA - 13, ANCHO_HOJA - MARGEN, ALTO_HOJA - 13);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...CACAO);
      doc.text(datos.url, MARGEN, ALTO_HOJA - 8.5);

      doc.text(
        `Guía del Cacao · ${hoja} de ${total}`,
        ANCHO_HOJA - MARGEN,
        ALTO_HOJA - 8.5,
        { align: "right" },
      );
    }
  }
}
