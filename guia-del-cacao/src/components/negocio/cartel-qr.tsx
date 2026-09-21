"use client";

import { useState } from "react";
import { bajarBlob, cargarImagen, enNombreDeArchivo } from "@/lib/descargas";
import { MONEDA } from "@/lib/vocabulario";

/*
  El cartel se dibuja a 1240 × 1754: es A4 a 150 ppp, que es lo que aguanta una
  impresora de mostrador sin que el archivo pese como para no poder mandarlo por
  WhatsApp. El QR ocupa el centro y nada se le encima: un código tapado no se
  lee, y este es el único elemento del cartel que tiene que funcionar.
*/
const ANCHO = 1240;
const ALTO = 1754;

const CREMA = "#fff7e8";
const SELVA = "#106b46";
const SELVA_2 = "#0c5236";
const CACAO = "#4a2c1d";
const MANGO = "#ffb703";

/** Los tres pasos, tal como los va a leer quien esté frente al mostrador. */
const PASOS = [
  "Apunta la cámara de tu celular al código.",
  "Dinos qué compraste y, si quieres, deja tu reseña.",
  `Te damos tus ${MONEDA.plural}.`,
];

/** El SVG del QR, envuelto como imagen para poder dibujarlo. */
function qrComoImagen(svg: string) {
  return cargarImagen(
    `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
  );
}

/** Parte un texto en las líneas que caben en `ancho`. */
function enLineas(
  ctx: CanvasRenderingContext2D,
  texto: string,
  ancho: number,
): string[] {
  const lineas: string[] = [];
  let linea = "";

  for (const palabra of texto.split(" ")) {
    const prueba = linea ? `${linea} ${palabra}` : palabra;

    if (ctx.measureText(prueba).width > ancho && linea) {
      lineas.push(linea);
      linea = palabra;
    } else {
      linea = prueba;
    }
  }

  if (linea) lineas.push(linea);
  return lineas;
}

/**
 * El botón que baja el cartel del mostrador: el QR de la sucursal con el logo
 * del negocio y las tres líneas de cómo funciona.
 *
 * Se arma en el navegador y no en el servidor a propósito: el logo pesa lo que
 * el negocio haya subido —hasta 5 MB— y mandarlo incrustado en la página lo
 * cargaría siempre, aunque nadie pulse el botón. Aquí se pide una sola vez, y
 * solo cuando alguien lo va a usar.
 */
export function CartelQr({
  svgQr,
  logo,
  marca,
  sucursal,
  destino,
}: {
  svgQr: string;
  /** URL pública del logo, o null si el micrositio todavía no tiene. */
  logo: string | null;
  marca: string;
  sucursal: string;
  destino: string;
}) {
  const [estado, setEstado] = useState<"listo" | "armando" | "fallo">("listo");

  async function bajar() {
    setEstado("armando");

    try {
      // Las tipografías de la marca las carga `next/font` con nombres propios;
      // el lienzo las usa solo si ya están listas, y si no cae al palo seco del
      // sistema. Esperarlas cuesta nada y evita un cartel con otra letra.
      if (document.fonts?.ready) await document.fonts.ready;

      const raiz = getComputedStyle(document.documentElement);
      const display =
        raiz.getPropertyValue("--font-display").trim() || "sans-serif";
      const cuerpo =
        raiz.getPropertyValue("--font-body").trim() || "sans-serif";

      const [qr, marcaLogo] = await Promise.all([
        qrComoImagen(svgQr),
        logo ? cargarImagen(logo) : Promise.resolve(null),
      ]);

      if (!qr) throw new Error("no se pudo dibujar el código");

      const lienzo = document.createElement("canvas");
      lienzo.width = ANCHO;
      lienzo.height = ALTO;

      const ctx = lienzo.getContext("2d");
      if (!ctx) throw new Error("este navegador no puede dibujar el cartel");

      ctx.fillStyle = CREMA;
      ctx.fillRect(0, 0, ANCHO, ALTO);

      // Marco: dos rectángulos redondeados, el de fuera en mango y el de dentro
      // en crema, para que al imprimir se vea dónde recortar.
      ctx.strokeStyle = MANGO;
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.roundRect(40, 40, ANCHO - 80, ALTO - 80, 48);
      ctx.stroke();

      ctx.textAlign = "center";
      const centro = ANCHO / 2;
      let y = 175;

      if (marcaLogo) {
        // Recortado en círculo, como se ve en el directorio: así el cartel y la
        // ficha del negocio se reconocen como la misma cosa.
        const lado = 210;
        ctx.save();
        ctx.beginPath();
        ctx.arc(centro, y + lado / 2, lado / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();

        // El logo se pide cuadrado pero se acepta lo que suban: se recorta por
        // el lado largo en vez de deformarlo.
        const corte = Math.min(marcaLogo.width, marcaLogo.height);
        ctx.drawImage(
          marcaLogo,
          (marcaLogo.width - corte) / 2,
          (marcaLogo.height - corte) / 2,
          corte,
          corte,
          centro - lado / 2,
          y,
          lado,
          lado,
        );
        ctx.restore();

        y += lado + 62;
      }

      ctx.fillStyle = SELVA_2;
      ctx.font = `700 68px ${display}`;
      for (const linea of enLineas(ctx, marca, ANCHO - 220)) {
        ctx.fillText(linea, centro, y);
        y += 80;
      }

      ctx.fillStyle = CACAO;
      ctx.font = `400 40px ${cuerpo}`;
      ctx.fillText(sucursal, centro, y);
      y += 76;

      ctx.fillStyle = SELVA;
      ctx.font = `700 52px ${display}`;
      for (const linea of enLineas(ctx, `Gana ${MONEDA.plural}`, ANCHO - 220)) {
        ctx.fillText(linea, centro, y);
        y += 62;
      }

      /*
        Los pasos y el pie se cuelgan del borde de abajo, no del final de lo que
        haya escrito arriba. Encadenados, un nombre comercial de dos líneas los
        empujaba hasta encimarse con la dirección del pie: nada avisaba, salía
        en el cartel impreso.
      */
      const MARGEN = 190;
      const ALTO_LINEA = 46;
      const ENTRE_PASOS = 34;

      ctx.font = `400 36px ${cuerpo}`;
      const pasos = PASOS.map((paso) =>
        enLineas(ctx, paso, ANCHO - MARGEN - 250),
      );
      const altoPasos = pasos.reduce(
        (total, lineas) => total + lineas.length * ALTO_LINEA + ENTRE_PASOS,
        0,
      );

      const yPie = ALTO - 150;
      let yPasos = yPie - altoPasos;

      // Lo que sobre entre el titular y los pasos es del QR, con un tope: más
      // grande no se lee mejor y deja el cartel desequilibrado.
      const caja = Math.min(676, yPasos - y - 60);
      const lado = caja - 56;

      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.roundRect(centro - caja / 2, y + 10, caja, caja, 40);
      ctx.fill();
      ctx.drawImage(qr, centro - lado / 2, y + 38, lado, lado);

      ctx.textAlign = "left";

      for (const [i, lineas] of pasos.entries()) {
        ctx.fillStyle = SELVA;
        ctx.beginPath();
        ctx.arc(MARGEN, yPasos - 12, 30, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = CREMA;
        ctx.font = `700 34px ${display}`;
        ctx.textAlign = "center";
        ctx.fillText(String(i + 1), MARGEN, yPasos);

        ctx.fillStyle = CACAO;
        ctx.font = `400 36px ${cuerpo}`;
        ctx.textAlign = "left";
        for (const linea of lineas) {
          ctx.fillText(linea, MARGEN + 56, yPasos);
          yPasos += ALTO_LINEA;
        }

        yPasos += ENTRE_PASOS;
      }

      ctx.textAlign = "center";
      ctx.fillStyle = CACAO;
      ctx.font = `400 26px ${cuerpo}`;
      ctx.fillText(destino, centro, yPie + 42);

      ctx.fillStyle = SELVA;
      ctx.font = `700 30px ${display}`;
      ctx.fillText("Guía del Cacao", centro, yPie + 90);

      const blob = await new Promise<Blob | null>((listo) =>
        lienzo.toBlob(listo, "image/png"),
      );

      if (!blob) throw new Error("no se pudo guardar la imagen");

      bajarBlob(blob, `qr-${enNombreDeArchivo(sucursal)}.png`);

      setEstado("listo");
    } catch {
      setEstado("fallo");
    }
  }

  return (
    <div className="grid gap-2">
      <button
        type="button"
        onClick={bajar}
        disabled={estado === "armando"}
        className="min-h-11 rounded-full bg-selva px-5 py-2.5 text-sm font-bold text-crema transition-transform active:translate-y-0.5 disabled:opacity-60"
      >
        {estado === "armando" ? "Armando el cartel…" : "Descargar el cartel"}
      </button>

      {estado === "fallo" && (
        <p role="alert" className="text-sm text-cacao">
          No se pudo armar el cartel. Vuelve a intentarlo; si sigue igual,
          escríbenos.
        </p>
      )}
    </div>
  );
}
