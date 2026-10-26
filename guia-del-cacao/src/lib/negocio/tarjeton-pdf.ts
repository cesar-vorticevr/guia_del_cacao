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
 * Va entero de noche y oro, como el sitio. Es una sola copia que se pega en la
 * pared, no un catálogo que se imprime a montones: aquí la tinta sí vale la
 * pena. El QR va sobre su cuadro blanco, que es lo único que no se negocia:
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
const NOCHE: Rgb = [28, 18, 54];
const NOCHE_2: Rgb = [15, 42, 34];
const ORO: Rgb = [255, 183, 3];
const ORO_CLARO: Rgb = [255, 209, 102];
const CREMA: Rgb = [255, 247, 232];
const TINTA: Rgb = [34, 21, 14];

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

/** Estrellas en sitios fijos: dos tarjetones del mismo negocio salen iguales. */
const ESTRELLAS: [number, number, number][] = [
  [0.07, 0.05, 0.6], [0.2, 0.12, 0.4], [0.86, 0.06, 0.5], [0.94, 0.16, 0.35],
  [0.05, 0.3, 0.35], [0.95, 0.34, 0.45], [0.1, 0.48, 0.5], [0.9, 0.52, 0.3],
  [0.06, 0.66, 0.4], [0.94, 0.7, 0.55], [0.15, 0.86, 0.3], [0.84, 0.88, 0.4],
  [0.3, 0.04, 0.3], [0.7, 0.03, 0.35], [0.5, 0.95, 0.3],
];

export async function armarTarjetonPdf(datos: DatosDelTarjeton): Promise<Blob> {
  const [{ jsPDF }, QRCode] = await Promise.all([
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
      color: { dark: "#1c1236", light: "#ffffff" },
    }),
    datos.logo
      ? cargarImagen(datos.logo).then((img) => (img ? encogida(img, 400) : null))
      : Promise.resolve(null),
    cargarImagen("/marca/logotipo.png").then((img) => (img ? encogida(img, 400) : null)),
    cargarImagen("/marca/mazorca.png").then((img) => (img ? encogida(img, 300) : null)),
  ]);

  const doc = new jsPDF({ unit: "mm", format: "letter", compress: true });
  doc.setProperties({
    title: `Tarjetón · ${datos.marca} · ${datos.sucursal}`,
    creator: "Guía del Cacao",
  });

  // El cielo: noche violeta arriba y selva abajo, con estrellas.
  doc.setFillColor(...NOCHE);
  doc.rect(0, 0, ANCHO, ALTO, "F");
  doc.setFillColor(...NOCHE_2);
  doc.rect(0, ALTO * 0.74, ANCHO, ALTO * 0.26, "F");
  doc.setFillColor(...ORO_CLARO);
  for (const [fx, fy, r] of ESTRELLAS) doc.circle(fx * ANCHO, fy * ALTO, r, "F");

  // El marco: oro grueso y un filo fino por dentro, que además dice por dónde
  // recortar si alguien lo quiere enmicar.
  doc.setDrawColor(...ORO);
  doc.setLineWidth(1.4);
  doc.roundedRect(8, 8, ANCHO - 16, ALTO - 16, 7, 7, "S");
  doc.setLineWidth(0.3);
  doc.roundedRect(11.5, 11.5, ANCHO - 23, ALTO - 23, 5, 5, "S");

  let y = 18;

  if (logoNegocio) {
    const lado = 32;
    doc.setFillColor(...CREMA);
    doc.setDrawColor(...ORO);
    doc.setLineWidth(1);
    doc.roundedRect(CENTRO - lado / 2, y, lado, lado, 7, 7, "FD");
    doc.addImage(logoNegocio, "PNG", CENTRO - lado / 2 + 3, y + 3, lado - 6, lado - 6);
    y += lado + 11;
  } else {
    y += 12;
  }

  doc.setFont("times", "bold");
  doc.setFontSize(30);
  doc.setTextColor(...CREMA);
  const nombre: string[] = doc.splitTextToSize(datos.marca, ANCHO - 50).slice(0, 2);
  for (const linea of nombre) {
    doc.text(linea, CENTRO, y, { align: "center" });
    y += 11;
  }

  doc.setFont("times", "italic");
  doc.setFontSize(14);
  doc.setTextColor(...ORO_CLARO);
  doc.text(datos.sucursal, CENTRO, y - 2.5, { align: "center" });
  y += 9;

  // El titular: lo que se lee desde la fila de la caja.
  doc.setFont("times", "bolditalic");
  doc.setFontSize(27);
  doc.setTextColor(...ORO);
  const titular = datos.conRuleta
    ? ["¡Gira la Ruleta Mágica", "y gana premios!"]
    : ["Escanea y descubre", "todo lo que tenemos"];
  for (const linea of titular) {
    doc.text(linea, CENTRO, y + 4, { align: "center" });
    y += 10.5;
  }
  y += 2;

  // El QR, con su cuadro blanco y filo de oro. Nada se le encima.
  const caja = 88;
  const izquierda = CENTRO - caja / 2;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...ORO);
  doc.setLineWidth(1.6);
  doc.roundedRect(izquierda, y, caja, caja, 6, 6, "FD");
  doc.addImage(qr, "PNG", izquierda + 5, y + 5, caja - 10, caja - 10);

  // A los lados del QR, la mazorca y la rueda: de lejos dicen «cacao» y
  // «ruleta» antes de que nadie lea una palabra.
  const medio = y + caja / 2;
  if (mazorca) doc.addImage(mazorca, "PNG", 22, medio - 17, 34, 34);
  if (datos.conRuleta) {
    rueda(ANCHO - 39, medio, 17);
  } else if (mazorca) {
    doc.addImage(mazorca, "PNG", ANCHO - 56, medio - 17, 34, 34);
  }

  y += caja + 9;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...CREMA);
  doc.text("APUNTA LA CÁMARA DE TU CELULAR AL CÓDIGO", CENTRO, y, {
    align: "center",
    charSpace: 0.6,
  });
  y += 10;

  // Los tres pasos, en tres columnas.
  const pasos = datos.conRuleta
    ? ["Escanea el código", "Gira la ruleta en nuestra página", "Enséñanos tu código y recibe tu premio"]
    : ["Escanea el código", "Mira el catálogo y los eventos", "Déjanos tu reseña y calificación"];
  const columna = (ANCHO - 44) / 3;
  pasos.forEach((paso, i) => {
    const cx = 22 + columna * i + columna / 2;
    doc.setFillColor(...ORO);
    doc.circle(cx, y, 5.2, "F");
    doc.setFont("times", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...TINTA);
    doc.text(String(i + 1), cx, y + 1.8, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    doc.setTextColor(...CREMA);
    const lineas: string[] = doc.splitTextToSize(paso, columna - 8);
    lineas.slice(0, 2).forEach((linea, j) => {
      doc.text(linea, cx, y + 11 + j * 4.6, { align: "center" });
    });
  });
  y += 25;

  if (datos.conRuleta && datos.premios.length > 0) {
    doc.setFont("times", "italic");
    doc.setFontSize(12.5);
    doc.setTextColor(...ORO_CLARO);
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
    doc.setTextColor(...CREMA);
    doc.text(`${datos.frecuencia}. Necesitas una cuenta gratis en Guía del Cacao.`, CENTRO, y + 1, {
      align: "center",
    });
  }

  // El pie, colgado del borde de abajo y no de lo de arriba: un nombre de dos
  // líneas no puede empujarlo fuera del marco.
  const pie = ALTO - 26;
  if (logoGuia) doc.addImage(logoGuia, "PNG", 20, pie - 6, 16, 16);
  doc.setFont("times", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...CREMA);
  doc.text("Guía del Cacao", logoGuia ? 39 : 20, pie + 1);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...ORO_CLARO);
  doc.text("Chocolaterías, catas y cacao de México", logoGuia ? 39 : 20, pie + 5.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...CREMA);
  doc.textWithLink(datos.destino.replace(/^https?:\/\//, ""), ANCHO - 20, pie + 3, {
    align: "right",
    url: datos.destino,
  });

  return doc.output("blob");

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
      const tramos = puntos.slice(1).map(([x, yy], k) => [x - puntos[k][0], yy - puntos[k][1]]);
      doc.setFillColor(...color);
      doc.lines(tramos, cx, cy, [1, 1], "F", true);
    });

    doc.setDrawColor(...ORO);
    doc.setLineWidth(1.2);
    doc.circle(cx, cy, r, "S");
    doc.setFillColor(...ORO);
    doc.circle(cx, cy, 2.6, "F");

    // La flecha, arriba, apuntando al centro.
    doc.setFillColor(...CREMA);
    doc.triangle(cx - 3.2, cy - r - 4.5, cx + 3.2, cy - r - 4.5, cx, cy - r + 2.5, "F");
  }
}
