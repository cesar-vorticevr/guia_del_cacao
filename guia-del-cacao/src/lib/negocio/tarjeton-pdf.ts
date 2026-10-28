import { cargarImagen, encogida } from "@/lib/descargas";

/**
 * El tarjetón del mostrador: una hoja carta para imprimir y pegar en el
 * negocio, con un QR grande que lleva al micrositio. Si el negocio tiene la
 * Ruleta Mágica, el tarjetón invita a girarla; si no, a ver el catálogo.
 *
 * Es **tamaño carta** y no A4 porque es el papel que hay en cualquier
 * papelería de México: se manda a imprimir tal cual, sin escalar, y el QR
 * sale del tamaño con que se diseñó.
 *
 * **Claro y de oro** (28 de octubre de 2026). Fue entero de noche y en la
 * impresora de color de una papelería salía como un rectángulo casi negro, con
 * el oro apagado. Ahora la hoja es crema, el oro es metálico —un degradado con
 * reflejos, que impreso se lee como dorado y no como mostaza— y lo primero que
 * se ve es **el logo del negocio, grande**: el tarjetón es suyo, la guía va
 * al pie. El QR va sobre su cuadro blanco, que es lo único que no se negocia:
 * un código sin contraste no lo lee ninguna cámara.
 *
 * Se arma en el navegador por lo mismo que el catálogo: el logo pesa lo que el
 * negocio haya subido y no tiene por qué viajar en cada visita al panel.
 */

export type DatosDelTarjeton = {
  marca: string;
  sucursal: string;
  /** URL pública del logo del negocio, o null. */
  logo: string | null;
  /** A dónde lleva el QR: el micrositio de la sucursal. */
  destino: string;
  /** Si la sucursal tiene la ruleta encendida, el tarjetón la anuncia. */
  conRuleta: boolean;
  /** Los premios de la ruleta, sin repetir ni «Suerte para la próxima». */
  premios: string[];
  /** «Una vez por persona», «Una vez al día»… o null. */
  frecuencia: string | null;
};

type Rgb = [number, number, number];
const CREMA: Rgb = [255, 251, 240];
const CREMA_2: Rgb = [255, 241, 207];
const CACAO: Rgb = [74, 44, 29];
const TINTA: Rgb = [34, 21, 14];
const ORO_HONDO: Rgb = [176, 118, 8];
const ORO: Rgb = [255, 183, 3];
const ORO_CLARO: Rgb = [255, 214, 102];

/**
 * El oro metálico: oscuro en las orillas, un reflejo casi blanco y otro más
 * suave. Es lo que hace que se lea como lámina dorada y no como amarillo.
 */
const METAL: [number, Rgb][] = [
  [0, [178, 122, 14]],
  [0.18, [240, 186, 52]],
  [0.36, [255, 244, 196]],
  [0.5, [242, 182, 38]],
  [0.68, [255, 224, 132]],
  [0.84, [222, 160, 26]],
  [1, [170, 114, 10]],
];

/* Los seis colores de la rueda del micrositio, en el mismo orden. */
const GAJOS: Rgb[] = [
  [255, 183, 3],
  [255, 93, 115],
  [18, 184, 172],
  [168, 217, 74],
  [16, 107, 70],
  [74, 44, 29],
];

/* Carta vertical, en milímetros. */
const ANCHO = 215.9;
const ALTO = 279.4;
const CENTRO = ANCHO / 2;

/** Destellos en sitios fijos: dos tarjetones del mismo negocio salen iguales. */
const DESTELLOS: [number, number, number][] = [
  [0.09, 0.07, 2.4], [0.91, 0.07, 2.4], [0.16, 0.2, 1.3], [0.84, 0.21, 1.5],
  [0.07, 0.4, 1.2], [0.93, 0.42, 1.2], [0.08, 0.78, 1.4], [0.92, 0.8, 1.6],
  [0.27, 0.05, 1], [0.73, 0.05, 1], [0.09, 0.93, 2.2], [0.91, 0.93, 2.2],
];

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

export async function armarTarjetonPdf(datos: DatosDelTarjeton): Promise<Blob> {
  const [{ jsPDF, GState }, QRCode] = await Promise.all([
    import("jspdf"),
    import("qrcode").then((m) => m.default),
  ]);

  const [qr, logoNegocio, logoGuia, mazorca] = await Promise.all([
    // Alta corrección: el código se pega en una pared donde le da el sol y se
    // raya, y aun así tiene que leerse.
    QRCode.toDataURL(datos.destino, {
      errorCorrectionLevel: "Q",
      margin: 1,
      width: 1200,
      color: { dark: "#22150e", light: "#ffffff" },
    }),
    datos.logo
      ? cargarImagen(datos.logo).then((img) => (img ? encogida(img, 700) : null))
      : Promise.resolve(null),
    cargarImagen("/marca/logotipo.png").then((img) => (img ? encogida(img, 300) : null)),
    cargarImagen("/marca/mazorca.png").then((img) => (img ? encogida(img, 300) : null)),
  ]);

  const doc = new jsPDF({ unit: "mm", format: "letter", compress: true });
  const opaco = new GState({ opacity: 1 });
  doc.setProperties({
    title: `Tarjetón · ${datos.marca} · ${datos.sucursal}`,
    creator: "Guía del Cacao",
  });

  // La hoja: crema que se calienta hacia abajo, con un sol dorado detrás del
  // logo (lo pinta `marcoDeOro` por dentro). Tinta clara: imprime bien en
  // cualquier papelería.
  marcoDeOro();
  for (const [fx, fy, r] of DESTELLOS) destello(fx * ANCHO, fy * ALTO, r);

  let y = 17;

  // El logo del negocio, grande, en su medallón de oro.
  const lado = 54;
  if (logoNegocio) {
    const x = CENTRO - lado / 2;
    aura(x, y, lado, lado, 11, ORO, 0.45, 4);
    recortado(x - 2.2, y - 2.2, lado + 4.4, lado + 4.4, 12, () =>
      degradado(x - 2.2, y - 2.2, lado + 4.4, lado + 4.4, METAL, true),
    );
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, y, lado, lado, 10, 10, "F");
    doc.addImage(logoNegocio, "PNG", x + 3, y + 3, lado - 6, lado - 6);
    y += lado + 12;
  } else {
    y += 14;
  }

  doc.setFont("times", "bold");
  doc.setFontSize(32);
  doc.setTextColor(...CACAO);
  const nombre: string[] = doc.splitTextToSize(datos.marca, ANCHO - 46).slice(0, 2);
  for (const linea of nombre) {
    doc.text(linea, CENTRO, y, { align: "center" });
    y += 11.5;
  }

  doc.setFont("times", "italic");
  doc.setFontSize(15);
  doc.setTextColor(...ORO_HONDO);
  doc.text(datos.sucursal, CENTRO, y - 3, { align: "center" });
  y += 5;

  // El titular, en una cinta de oro: lo que se lee desde la fila de la caja.
  const titular = datos.conRuleta
    ? "¡Gira la Ruleta Mágica y gana premios!"
    : "Escanea y descubre todo lo que tenemos";
  doc.setFont("times", "bolditalic");
  doc.setFontSize(21);
  const anchoCinta = Math.min(doc.getTextWidth(titular) + 22, ANCHO - 36);
  pildoraDeOro(CENTRO - anchoCinta / 2, y, anchoCinta, 15);
  doc.setTextColor(...TINTA);
  doc.text(titular, CENTRO, y + 10, { align: "center" });
  y += 21;

  // El QR, con su cuadro blanco y filo de oro metálico. Nada se le encima.
  const caja = 78;
  const izquierda = CENTRO - caja / 2;
  aura(izquierda, y, caja, caja, 7, ORO, 0.4, 3.4);
  recortado(izquierda - 2, y - 2, caja + 4, caja + 4, 8, () =>
    degradado(izquierda - 2, y - 2, caja + 4, caja + 4, METAL, true),
  );
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(izquierda, y, caja, caja, 6, 6, "F");
  doc.addImage(qr, "PNG", izquierda + 4, y + 4, caja - 8, caja - 8);

  // A los lados del QR, la mazorca y la rueda: de lejos dicen «cacao» y
  // «ruleta» antes de que nadie lea una palabra.
  const medio = y + caja / 2;
  if (mazorca) {
    halo(39, medio, 22, 22, ORO_CLARO, 0.5);
    doc.addImage(mazorca, "PNG", 22, medio - 17, 34, 34);
  }
  if (datos.conRuleta) {
    halo(ANCHO - 39, medio, 24, 24, ORO_CLARO, 0.5);
    rueda(ANCHO - 39, medio, 17);
  } else if (mazorca) {
    halo(ANCHO - 39, medio, 22, 22, ORO_CLARO, 0.5);
    doc.addImage(mazorca, "PNG", ANCHO - 56, medio - 17, 34, 34);
  }

  y += caja + 8;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...CACAO);
  doc.text("APUNTA LA CÁMARA DE TU CELULAR AL CÓDIGO", CENTRO, y, {
    align: "center",
    charSpace: 0.6,
  });
  // La dirección va aquí, en su renglón: en el pie se encimaba con el nombre de
  // la guía en cuanto la dirección era larga.
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...ORO_HONDO);
  doc.textWithLink(datos.destino.replace(/^https?:\/\//, ""), CENTRO, y + 4.6, {
    align: "center",
    url: datos.destino,
  });
  y += 14;

  // Los tres pasos, en tres columnas, con su número en una moneda de oro.
  const pasos = datos.conRuleta
    ? ["Escanea el código", "Gira la ruleta en nuestra página", "Enséñanos tu código y recibe tu premio"]
    : ["Escanea el código", "Mira el catálogo y los eventos", "Déjanos tu reseña y calificación"];
  const columna = (ANCHO - 44) / 3;
  pasos.forEach((paso, i) => {
    const cx = 22 + columna * i + columna / 2;
    monedaDeOro(cx, y, 5.4);
    doc.setFont("times", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...TINTA);
    doc.text(String(i + 1), cx, y + 1.8, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...CACAO);
    const lineas: string[] = doc.splitTextToSize(paso, columna - 8);
    lineas.slice(0, 2).forEach((linea, j) => {
      doc.text(linea, cx, y + 11 + j * 4.6, { align: "center" });
    });
  });
  y += 24;

  if (datos.conRuleta && datos.premios.length > 0) {
    doc.setFont("times", "bolditalic");
    doc.setFontSize(13);
    doc.setTextColor(...ORO_HONDO);
    const premios: string[] = doc.splitTextToSize(
      `Puedes ganar: ${datos.premios.join(" · ")}`,
      ANCHO - 50,
    );
    premios.slice(0, 2).forEach((linea, j) => {
      doc.text(linea, CENTRO, y + j * 5.4, { align: "center" });
    });
    y += premios.slice(0, 2).length * 5.4;
  }

  if (datos.conRuleta && datos.frecuencia) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...CACAO);
    doc.text(`${datos.frecuencia}. Necesitas una cuenta gratis en Guía del Cacao.`, CENTRO, y + 0.5, {
      align: "center",
    });
  }

  // El pie, centrado y colgado del borde de abajo, no de lo de arriba: un
  // nombre de dos líneas no puede empujarlo fuera del marco.
  const pie = ALTO - 21;
  doc.setFont("times", "bold");
  doc.setFontSize(11);
  const marcaGuia = "Guía del Cacao";
  const lema = "  ·  Chocolaterías, catas y cacao de México";
  const anchoMarca = doc.getTextWidth(marcaGuia);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const anchoLema = doc.getTextWidth(lema);
  const anchoPie = (logoGuia ? 13 : 0) + anchoMarca + anchoLema;
  let x = CENTRO - anchoPie / 2;
  if (logoGuia) {
    doc.addImage(logoGuia, "PNG", x, pie - 6.5, 11, 11);
    x += 13;
  }
  doc.setFont("times", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...CACAO);
  doc.text(marcaGuia, x, pie);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...ORO_HONDO);
  doc.text(lema, x + anchoMarca, pie);

  return doc.output("blob");

  /* ----------------------------------------------------------------- */

  /*
    El brillo, como en el catálogo: jsPDF no pinta degradados ni desenfoques,
    así que un degradado son franjas finas de color que va cambiando, un halo
    son elipses casi transparentes que se suman y el metal se recorta a la
    forma que lo lleva (`recortado`).
  */

  function transparencia(opacidad: number) {
    doc.setGState(opacidad >= 1 ? opaco : new GState({ opacity: opacidad }));
  }

  /** Dibuja `pintar` recortado al rectángulo redondeado. */
  function recortado(x: number, y: number, ancho: number, alto: number, radio: number, pintar: () => void) {
    doc.saveGraphicsState();
    doc.roundedRect(x, y, ancho, alto, radio, radio, null);
    doc.clip();
    doc.discardPath();
    pintar();
    doc.restoreGraphicsState();
  }

  /** Un degradado de arriba abajo (o de izquierda a derecha con `horizontal`). */
  function degradado(x: number, y: number, ancho: number, alto: number, paradas: [number, Rgb][], horizontal = false) {
    const largo = horizontal ? ancho : alto;
    const pasos = Math.max(2, Math.ceil(largo / 0.5));
    const paso = largo / pasos;
    for (let i = 0; i < pasos; i += 1) {
      doc.setFillColor(...colorEn(paradas, (i + 0.5) / pasos));
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
  function aura(x: number, y: number, ancho: number, alto: number, radio: number, color: Rgb, fuerza: number, extension: number) {
    const capas = 7;
    doc.setFillColor(...color);
    transparencia(fuerza / capas);
    for (let i = capas; i >= 1; i -= 1) {
      const e = (extension * i) / capas;
      doc.roundedRect(x - e, y - e, ancho + e * 2, alto + e * 2, radio + e, radio + e, "F");
    }
    transparencia(1);
  }

  /** La píldora de `boton-oro`, en metal: el degradado, su filo claro y su aura. */
  function pildoraDeOro(x: number, y: number, ancho: number, alto: number) {
    const radio = alto / 2;
    aura(x, y, ancho, alto, radio, [255, 159, 67], 0.45, 2.4);
    recortado(x, y, ancho, alto, radio, () => {
      degradado(x, y, ancho, alto, METAL, true);
      doc.setFillColor(255, 255, 255);
      transparencia(0.35);
      doc.rect(x, y, ancho, alto * 0.4, "F");
      transparencia(1);
    });
  }

  /** Una moneda de oro: círculo metálico con su reflejo. */
  function monedaDeOro(cx: number, cy: number, r: number) {
    halo(cx, cy, r * 2, r * 2, ORO, 0.35);
    doc.saveGraphicsState();
    doc.circle(cx, cy, r, null);
    doc.clip();
    doc.discardPath();
    degradado(cx - r, cy - r, r * 2, r * 2, METAL, true);
    doc.setFillColor(255, 255, 255);
    transparencia(0.35);
    doc.rect(cx - r, cy - r, r * 2, r * 0.8, "F");
    transparencia(1);
    doc.restoreGraphicsState();
  }

  /**
   * El marco: una lámina de oro metálico (el degradado recortado al anillo entre
   * dos rectángulos) y un filo fino por dentro, que además dice por dónde
   * recortar si alguien lo quiere enmicar.
   */
  function marcoDeOro() {
    const fuera = 7;
    const grueso = 3.4;
    doc.saveGraphicsState();
    doc.roundedRect(fuera, fuera, ANCHO - fuera * 2, ALTO - fuera * 2, 8, 8, null);
    doc.clip();
    doc.discardPath();
    degradado(0, 0, ANCHO, ALTO, METAL, true);
    doc.restoreGraphicsState();

    // El interior vuelve a ser hoja: se repinta encima con su mismo degradado.
    const dentro = fuera + grueso;
    recortado(dentro, dentro, ANCHO - dentro * 2, ALTO - dentro * 2, 6, () => {
      degradado(0, 0, ANCHO, ALTO, [
        [0, CREMA],
        [0.55, [255, 248, 228]],
        [1, CREMA_2],
      ]);
      halo(CENTRO, 50, 95, 62, ORO_CLARO, 0.55);
    });

    doc.setDrawColor(...ORO);
    doc.setLineWidth(0.35);
    doc.roundedRect(dentro + 2.6, dentro + 2.6, ANCHO - (dentro + 2.6) * 2, ALTO - (dentro + 2.6) * 2, 4.5, 4.5, "S");
  }

  /** Un destello de cuatro puntas, dorado, con su resplandor. */
  function destello(x: number, y: number, r: number) {
    halo(x, y, r * 3, r * 3, ORO_CLARO, 0.5);
    doc.setFillColor(...ORO);
    doc.ellipse(x, y, r * 2.4, r * 0.3, "F");
    doc.ellipse(x, y, r * 0.3, r * 2.4, "F");
    doc.setFillColor(255, 246, 214);
    doc.circle(x, y, r * 0.55, "F");
  }

  /** Una rueda de seis gajos con su flecha, dibujada con polígonos. */
  function rueda(cx: number, cy: number, r: number) {
    const paso = (Math.PI * 2) / GAJOS.length;
    GAJOS.forEach((color, i) => {
      const desde = -Math.PI / 2 + i * paso;
      const puntos: [number, number][] = [[cx, cy]];
      for (let k = 0; k <= 12; k += 1) {
        const a = desde + (paso * k) / 12;
        puntos.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
      }
      // `lines` quiere tramos relativos a partir del primer punto.
      const tramos = puntos.slice(1).map(([px, py], k) => [px - puntos[k][0], py - puntos[k][1]]);
      doc.setFillColor(...color);
      doc.lines(tramos, cx, cy, [1, 1], "F", true);
    });

    doc.setDrawColor(...ORO_HONDO);
    doc.setLineWidth(1.4);
    doc.circle(cx, cy, r, "S");
    monedaDeOro(cx, cy, 3);

    // La flecha, arriba, apuntando al centro.
    doc.setFillColor(...CACAO);
    doc.triangle(cx - 3.2, cy - r - 4.5, cx + 3.2, cy - r - 4.5, cx, cy - r + 2.5, "F");
  }
}
