import type { GState as ClaseGState, jsPDF } from "jspdf";

/**
 * Los pinceles de las hojas carta que se imprimen: el tarjetón del mostrador
 * (`lib/negocio/tarjeton-pdf.ts`) y el póster de realidad aumentada
 * (`lib/ra/poster-pdf.ts`). Hoja crema, marco de oro metálico, halos y
 * destellos: las dos hojas tienen que leerse como de la misma familia.
 *
 * jsPDF no pinta degradados ni desenfoques, así que un degradado son franjas
 * finas de color que va cambiando, un halo son elipses casi transparentes que
 * se suman y el metal se recorta a la forma que lo lleva (`recortado`).
 */

export type Rgb = [number, number, number];
export const CREMA: Rgb = [255, 251, 240];
export const CREMA_2: Rgb = [255, 241, 207];
export const CACAO: Rgb = [74, 44, 29];
export const TINTA: Rgb = [34, 21, 14];
export const ORO_HONDO: Rgb = [176, 118, 8];
export const ORO: Rgb = [255, 183, 3];
export const ORO_CLARO: Rgb = [255, 214, 102];

/**
 * El oro metálico: oscuro en las orillas, un reflejo casi blanco y otro más
 * suave. Es lo que hace que se lea como lámina dorada y no como amarillo.
 */
export const METAL: [number, Rgb][] = [
  [0, [178, 122, 14]],
  [0.18, [240, 186, 52]],
  [0.36, [255, 244, 196]],
  [0.5, [242, 182, 38]],
  [0.68, [255, 224, 132]],
  [0.84, [222, 160, 26]],
  [1, [170, 114, 10]],
];

/* Carta vertical, en milímetros. */
export const ANCHO = 215.9;
export const ALTO = 279.4;
export const CENTRO = ANCHO / 2;

/** Destellos en sitios fijos: dos hojas del mismo negocio salen iguales. */
export const DESTELLOS: [number, number, number][] = [
  [0.09, 0.07, 2.4], [0.91, 0.07, 2.4], [0.16, 0.2, 1.3], [0.84, 0.21, 1.5],
  [0.07, 0.4, 1.2], [0.93, 0.42, 1.2], [0.08, 0.78, 1.4], [0.92, 0.8, 1.6],
  [0.27, 0.05, 1], [0.73, 0.05, 1], [0.09, 0.93, 2.2], [0.91, 0.93, 2.2],
];

/** El color de un degradado en `t` (0 a 1), entre sus paradas. */
export function colorEn(paradas: [number, Rgb][], t: number): Rgb {
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

/** Los pinceles, atados a un documento. `GState` se pasa porque jsPDF se importa al pulsar. */
export function pincelesDeOro(doc: jsPDF, GState: typeof ClaseGState) {
  const opaco = new GState({ opacity: 1 });

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
   * recortar si alguien lo quiere enmicar. `sol` es la altura del resplandor
   * dorado que va detrás de lo principal de la hoja.
   */
  function marcoDeOro(sol = 50) {
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
      halo(CENTRO, sol, 95, 62, ORO_CLARO, 0.55);
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

  /**
   * El pie de la hoja: el logotipo de la guía, su nombre y el lema, centrado y
   * colgado del borde de abajo para que nada de arriba lo empuje fuera.
   */
  function pieDeLaGuia(logoGuia: string | null, lema = "  ·  Chocolaterías, catas y cacao de México") {
    const pie = ALTO - 21;
    doc.setFont("times", "bold");
    doc.setFontSize(11);
    const marcaGuia = "Guía del Cacao";
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
  }

  return {
    transparencia,
    recortado,
    degradado,
    halo,
    aura,
    pildoraDeOro,
    monedaDeOro,
    marcoDeOro,
    destello,
    pieDeLaGuia,
  };
}
