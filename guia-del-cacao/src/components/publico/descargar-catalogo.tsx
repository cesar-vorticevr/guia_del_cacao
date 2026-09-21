"use client";

import { useState } from "react";
import { bajarBlob, enNombreDeArchivo } from "@/lib/descargas";
import type { CatalogoParaPdf } from "@/lib/publico/catalogo-pdf";

/**
 * El botón que baja el catálogo de una sucursal en PDF.
 *
 * **No pide entrar.** Quien mira un micrositio suele estar decidiendo si va
 * hasta allá, o enseñándoselo a alguien más; obligarlo a registrarse para
 * llevarse la lista de precios sería cobrar un peaje justo donde el negocio
 * quiere que lo compartan.
 *
 * El trabajo pesado —traer las fotos, encogerlas, maquetar las hojas— vive en
 * `catalogo-pdf`, que a su vez carga `jspdf` solo al pulsar. Aquí solo queda
 * el botón y sus tres estados, los mismos que el cartel del mostrador.
 */
export function DescargarCatalogo({ datos }: { datos: CatalogoParaPdf }) {
  const [estado, setEstado] = useState<"listo" | "armando" | "fallo">("listo");

  async function bajar() {
    setEstado("armando");

    try {
      const { armarCatalogoPdf } = await import("@/lib/publico/catalogo-pdf");
      const pdf = await armarCatalogoPdf(datos);

      bajarBlob(
        pdf,
        `catalogo-${enNombreDeArchivo(`${datos.marca} ${datos.sucursal}`)}.pdf`,
      );

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
        className="flex min-h-11 items-center gap-2 rounded-full border-2 border-selva/20 bg-white px-4 py-2 text-sm font-bold text-selva-2 shadow-dura-sm transition-transform active:translate-y-0.5 disabled:opacity-60"
      >
        {/* Decorativa: lo que se lee al lado ya dice qué hace el botón. */}
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="size-4 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 3v12" />
          <path d="m7 11 5 5 5-5" />
          <path d="M4 20h16" />
        </svg>

        {estado === "armando" ? "Armando el PDF…" : "Descargar en PDF"}
      </button>

      {estado === "fallo" && (
        <p role="alert" className="text-sm text-cacao">
          No se pudo armar el catálogo. Vuelve a intentarlo; si sigue igual,
          escríbenos.
        </p>
      )}
    </div>
  );
}
