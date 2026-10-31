"use client";

import { BotonCompartir } from "@/components/publico/boton-compartir";

/**
 * Lo que se hace con el dossier además de leerlo: mandarlo (WhatsApp, redes o
 * copiar el enlace, que ya trae `BotonCompartir`) y guardarlo en PDF. El PDF lo
 * arma el navegador (`window.print`) con los estilos de impresión de
 * `globals.css`: hoja blanca, letra oscura y sin la selva de fondo, que
 * impresa se volvería una plasta de tinta.
 */
export function AccionesDelDossier({ url }: { url: string }) {
  return (
    <div className="no-imprimir flex flex-wrap items-center justify-center gap-3">
      <BotonCompartir url={url} titulo="Dossier de la Guía del Cacao" />
      <button
        type="button"
        onClick={() => window.print()}
        className="boton-oro brillo inline-flex min-h-11 items-center rounded-full px-5 font-bold text-ink"
      >
        Guardar en PDF
      </button>
    </div>
  );
}
