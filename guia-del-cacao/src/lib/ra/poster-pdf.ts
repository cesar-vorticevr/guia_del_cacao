import { cargarImagen, encogida } from "@/lib/descargas";
import {
  ALTO,
  ANCHO,
  CACAO,
  CENTRO,
  DESTELLOS,
  ORO,
  ORO_HONDO,
  METAL,
  TINTA,
  pincelesDeOro,
} from "@/lib/pdf/oro";

/**
 * El póster de una experiencia de realidad aumentada: una hoja **carta** con
 * la imagen que se enfoca, grande, y debajo el QR que abre la cámara. Es lo
 * que el negocio imprime y pega: quien pasa escanea el código, apunta a la
 * imagen de la misma hoja y la ve cobrar vida.
 *
 * Es de la familia del tarjetón (`lib/negocio/tarjeton-pdf.ts`): hoja crema,
 * marco de oro metálico, mismos pinceles (`lib/pdf/oro.ts`).
 *
 * **La imagen no se recorta ni se deforma, y nada se le encima.** La cámara la
 * reconoce por sus rasgos: si se recorta un lado, se estira o se le pone un
 * sello encima, el celular deja de encontrarla. Por eso va entera, con su
 * proporción, sobre un paspartú blanco, y lo demás queda alrededor.
 *
 * Se arma en el navegador, como el tarjetón y el catálogo: la imagen pesa lo
 * que el negocio subió y no tiene por qué viajar en cada visita al panel.
 */

export type DatosDelPoster = {
  titulo: string;
  marca: string;
  /** URL pública de la imagen que se enfoca. */
  imagen: string;
  /** A dónde lleva el QR: `/ra/{codigo}`. */
  destino: string;
};

/** La imagen a imprimir: entera, en JPEG sobre blanco, hasta este lado mayor. */
const LADO_DE_IMPRESION = 2400;

export async function armarPosterPdf(datos: DatosDelPoster): Promise<Blob> {
  const [{ jsPDF, GState }, QRCode] = await Promise.all([
    import("jspdf"),
    import("qrcode").then((m) => m.default),
  ]);

  const [qr, foto, logoGuia, mazorca] = await Promise.all([
    QRCode.toDataURL(datos.destino, {
      errorCorrectionLevel: "Q",
      margin: 1,
      width: 1200,
      color: { dark: "#22150e", light: "#ffffff" },
    }),
    cargarImagen(datos.imagen),
    cargarImagen("/marca/logotipo.png").then((img) => (img ? encogida(img, 300) : null)),
    cargarImagen("/marca/mazorca.png").then((img) => (img ? encogida(img, 300) : null)),
  ]);

  // Sin la imagen no hay póster: lo que se enfoca es justo lo que faltaría.
  if (!foto) throw new Error("No se pudo cargar la imagen de la experiencia.");
  const imagen = paraImprimir(foto);
  if (!imagen) throw new Error("No se pudo preparar la imagen.");

  const doc = new jsPDF({ unit: "mm", format: "letter", compress: true });
  const { aura, destello, halo, marcoDeOro, monedaDeOro, pieDeLaGuia, pildoraDeOro, recortado, degradado } =
    pincelesDeOro(doc, GState);
  doc.setProperties({
    title: `Póster de realidad aumentada · ${datos.marca} · ${datos.titulo}`,
    creator: "Guía del Cacao",
  });

  // El sol dorado va detrás de la imagen, que es lo principal de esta hoja.
  marcoDeOro(110);
  for (const [fx, fy, r] of DESTELLOS) destello(fx * ANCHO, fy * ALTO, r);

  let y = 23;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...ORO_HONDO);
  doc.text(datos.marca.toUpperCase(), CENTRO, y, { align: "center", charSpace: 0.8 });
  y += 10;

  doc.setFont("times", "bold");
  doc.setFontSize(25);
  doc.setTextColor(...CACAO);
  const titulo: string[] = doc.splitTextToSize(datos.titulo || "Realidad aumentada", ANCHO - 50).slice(0, 2);
  for (const linea of titulo) {
    doc.text(linea, CENTRO, y, { align: "center" });
    y += 9.5;
  }

  // La invitación, en su cinta de oro.
  const titular = "¡Escanéame y mira esta imagen cobrar vida!";
  doc.setFont("times", "bolditalic");
  doc.setFontSize(17);
  const anchoCinta = Math.min(doc.getTextWidth(titular) + 20, ANCHO - 36);
  pildoraDeOro(CENTRO - anchoCinta / 2, y - 3, anchoCinta, 13);
  doc.setTextColor(...TINTA);
  doc.text(titular, CENTRO, y + 5.6, { align: "center" });
  y += 17;

  // La imagen: lo más grande que quepa en su hueco, con su proporción.
  const arriba = y;
  const abajo = 183;
  const anchoMax = ANCHO - 52;
  const altoMax = abajo - arriba;
  const escala = Math.min(anchoMax / imagen.ancho, altoMax / imagen.alto);
  const w = imagen.ancho * escala;
  const h = imagen.alto * escala;
  const ix = CENTRO - w / 2;
  const iy = arriba + (altoMax - h) / 2;
  const mat = 3;
  const filo = 1.8;

  aura(ix - mat, iy - mat, w + mat * 2, h + mat * 2, 4, ORO, 0.4, 3.4);
  recortado(ix - mat - filo, iy - mat - filo, w + (mat + filo) * 2, h + (mat + filo) * 2, 5, () =>
    degradado(ix - mat - filo, iy - mat - filo, w + (mat + filo) * 2, h + (mat + filo) * 2, METAL, true),
  );
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(ix - mat, iy - mat, w + mat * 2, h + mat * 2, 3.5, 3.5, "F");
  doc.addImage(imagen.datos, "JPEG", ix, iy, w, h);

  // Debajo de la imagen, el QR a la izquierda y los pasos a la derecha.
  y = 192;
  const caja = 56;
  const qx = 27;
  aura(qx, y, caja, caja, 6, ORO, 0.4, 3);
  recortado(qx - 2, y - 2, caja + 4, caja + 4, 7, () => degradado(qx - 2, y - 2, caja + 4, caja + 4, METAL, true));
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(qx, y, caja, caja, 5, 5, "F");
  doc.addImage(qr, "PNG", qx + 3, y + 3, caja - 6, caja - 6);

  const cx = qx + caja + 12;
  const anchoTexto = ANCHO - cx - 24;
  doc.setFont("times", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...CACAO);
  doc.text("Así se ve en tu celular", cx, y + 7);

  const pasos = [
    "Escanea el código con la cámara.",
    "Deja que la página use tu cámara.",
    "Apunta a la imagen de arriba y mírala cobrar vida.",
  ];
  let py = y + 17;
  pasos.forEach((paso, i) => {
    monedaDeOro(cx + 4.6, py - 1.4, 4.4);
    doc.setFont("times", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...TINTA);
    doc.text(String(i + 1), cx + 4.6, py + 0.3, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...CACAO);
    const lineas: string[] = doc.splitTextToSize(paso, anchoTexto - 13);
    lineas.slice(0, 2).forEach((linea, j) => doc.text(linea, cx + 12.5, py + j * 4.6));
    py += 6 + Math.min(lineas.length, 2) * 4.6;
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...ORO_HONDO);
  doc.textWithLink(datos.destino.replace(/^https?:\/\//, ""), cx, y + caja - 2, { url: datos.destino });

  if (mazorca) {
    halo(ANCHO - 30, y + caja - 8, 10, 10, ORO, 0.3);
    doc.addImage(mazorca, "PNG", ANCHO - 38, y + caja - 16, 16, 16);
  }

  pieDeLaGuia(logoGuia, "  ·  Realidad aumentada powered by Vórtice VR");

  return doc.output("blob");
}

/**
 * La imagen como JPEG sobre blanco, entera y con su proporción. Blanco y no
 * transparente: una zona transparente se imprime del color del papel, y así
 * la hoja sale igual que lo que ve la cámara en pantalla.
 */
function paraImprimir(img: HTMLImageElement) {
  const escala = Math.min(LADO_DE_IMPRESION / img.naturalWidth, LADO_DE_IMPRESION / img.naturalHeight, 1);
  const ancho = Math.max(1, Math.round(img.naturalWidth * escala));
  const alto = Math.max(1, Math.round(img.naturalHeight * escala));
  const lienzo = document.createElement("canvas");
  lienzo.width = ancho;
  lienzo.height = alto;
  const ctx = lienzo.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, ancho, alto);
  ctx.drawImage(img, 0, 0, ancho, alto);
  return { datos: lienzo.toDataURL("image/jpeg", 0.92), ancho, alto };
}
