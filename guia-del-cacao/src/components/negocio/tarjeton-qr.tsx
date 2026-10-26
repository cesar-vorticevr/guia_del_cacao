"use client";

import { useState } from "react";
import { bajarBlob, enNombreDeArchivo } from "@/lib/descargas";
import type { DatosDelTarjeton } from "@/lib/negocio/tarjeton-pdf";

/**
 * El botón que baja el tarjetón del mostrador (`lib/negocio/tarjeton-pdf`):
 * hoja carta, noche y oro, con el QR al micrositio.
 *
 * `jspdf` y `qrcode` se piden al pulsar, no al cargar el panel: son cientos
 * de KB que la mayoría de las visitas no necesita.
 */
export function TarjetonQr({
  datos,
  compacto = false,
}: {
  datos: DatosDelTarjeton;
  /** En la tarjeta de la sucursal va como botón secundario, sin la explicación. */
  compacto?: boolean;
}) {
  const [estado, setEstado] = useState<"listo" | "armando" | "fallo">("listo");

  async function bajar() {
    setEstado("armando");
    try {
      const { armarTarjetonPdf } = await import("@/lib/negocio/tarjeton-pdf");
      const pdf = await armarTarjetonPdf(datos);
      bajarBlob(pdf, `tarjeton-${enNombreDeArchivo(`${datos.marca} ${datos.sucursal}`)}.pdf`);
      setEstado("listo");
    } catch {
      setEstado("fallo");
    }
  }

  return (
    <div className="grid justify-items-start gap-1.5">
      <button
        type="button"
        onClick={bajar}
        disabled={estado === "armando"}
        className={
          compacto
            ? "min-h-11 rounded-full border-2 border-mango/50 bg-white px-5 py-2.5 text-sm font-bold text-selva-2 transition-transform active:translate-y-0.5 disabled:opacity-60"
            : "boton-oro brillo inline-flex min-h-12 items-center gap-2 rounded-full px-6 font-bold text-ink disabled:opacity-60"
        }
      >
        <span aria-hidden="true">🖨️</span>
        {estado === "armando" ? "Armando el tarjetón…" : "Tarjetón con QR para imprimir"}
      </button>

      {estado === "fallo" && (
        <p role="alert" className="text-sm text-cacao">
          No se pudo armar el tarjetón. Vuelve a intentarlo.
        </p>
      )}
    </div>
  );
}
