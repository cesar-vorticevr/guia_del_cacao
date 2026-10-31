import { cargarImagen, encogida } from "@/lib/descargas";
import {
  ALTO,
  ANCHO,
  CACAO,
  CENTRO,
  DESTELLOS,
  ORO,
  ORO_CLARO,
  ORO_HONDO,
  METAL,
  TINTA,
  pincelesDeOro,
  type Rgb,
} from "@/lib/pdf/oro";

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

/* Los seis colores de la rueda del micrositio, en el mismo orden. */
const GAJOS: Rgb[] = [
  [255, 183, 3],
  [255, 93, 115],
  [18, 184, 172],
  [168, 217, 74],
  [16, 107, 70],
  [74, 44, 29],
];

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
  const { aura, degradado, destello, halo, marcoDeOro, monedaDeOro, pieDeLaGuia, pildoraDeOro, recortado } =
    pincelesDeOro(doc, GState);
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

  pieDeLaGuia(logoGuia);

  return doc.output("blob");

  /* ----------------------------------------------------------------- */

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
