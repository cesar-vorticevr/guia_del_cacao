"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

function suscribir() {
  return () => {};
}

/*
  Lo leído se guarda aquí la primera vez y no se vuelve a preguntar:
  `useSyncExternalStore` pide la instantánea en cada pintada, y al anotar
  «ya se abrió» la siguiente pintada la cerraba al instante.
*/
const leidas = new Map<string, boolean>();

/** Si en esta visita ya se abrió sola la ruleta de esta sucursal. */
function yaSeAbrio(clave: string) {
  if (!leidas.has(clave)) {
    try {
      leidas.set(clave, window.sessionStorage.getItem(clave) !== null);
    } catch {
      leidas.set(clave, false);
    }
  }
  return leidas.get(clave)!;
}

/**
 * La Ruleta Mágica del micrositio como ventana emergente, y luego como un
 * botón flotante para volver a abrirla.
 *
 * Fue una sección a todo lo ancho debajo de la portada: ocupaba media
 * pantalla, y después de girar se quedaba ahí con la ruleta de cacao. Ahora:
 *
 * - **Se abre sola al entrar** si todavía hay premio que ganar (`abrirSola`),
 *   una vez por visita: lo recuerda `sessionStorage`, así que recargar o volver
 *   desde el catálogo no la vuelve a lanzar.
 * - Se cierra con la ✕, con Esc o tocando fuera.
 * - Queda el botón 🎡 flotando abajo a la derecha, por encima de la barra del
 *   pedido y de la navegación del celular. Late mientras hay premio.
 *
 * **La tarjeta no lleva `transform` ni filtros**, y el desenfoque del fondo va
 * en una capa hermana: el resultado del giro es un `fixed` dentro de la ruleta,
 * y un ancestro con `transform`, `filter` o `backdrop-filter` lo encerraría en
 * la tarjeta en vez de cubrir la pantalla.
 *
 * Al cerrar el resultado, la ruleta refresca la página; el micrositio la monta
 * de nuevo con otra `key` y ya no se abre sola: queda el botón.
 */
export function RuletaEmergente({
  sucursalId,
  abrirSola,
  etiqueta,
  children,
}: {
  sucursalId: string;
  /** Hay premio por ganar: se abre sola la primera vez de la visita. */
  abrirSola: boolean;
  /** Lo que dice el botón flotante. */
  etiqueta: string;
  children: React.ReactNode;
}) {
  const clave = `guia-ruleta-${sucursalId}`;
  const enNavegador = useSyncExternalStore(suscribir, () => true, () => false);
  const vista = useSyncExternalStore(suscribir, () => yaSeAbrio(clave), () => true);
  // null: nadie la ha tocado todavía y manda `abrirSola`.
  const [abierta, setAbierta] = useState<boolean | null>(null);

  const visible = enNavegador && (abierta ?? (abrirSola && !vista));

  // Abrirse sola cuenta como «ya se abrió» en esta visita.
  useEffect(() => {
    if (!visible) return;
    try {
      window.sessionStorage.setItem(clave, "1");
    } catch {
      // Sin almacenamiento, se volverá a abrir al recargar. No pasa nada.
    }
  }, [visible, clave]);

  useEffect(() => {
    if (!visible) return;
    const alTeclear = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") setAbierta(false);
    };
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", alTeclear);
    return () => {
      document.body.style.overflow = antes;
      window.removeEventListener("keydown", alTeclear);
    };
  }, [visible]);

  if (!enNavegador) return null;

  return createPortal(
    <>
      {!visible && (
        <button
          type="button"
          onClick={() => setAbierta(true)}
          aria-label={`Abrir la Ruleta Mágica: ${etiqueta}`}
          className="fixed right-4 bottom-40 z-[45] flex items-center gap-2 rounded-full border-2 border-[#ffe08a] bg-[linear-gradient(135deg,#ffe08a,#ffb703_50%,#ff9f43)] py-2 pr-4 pl-2 font-bold text-[#22150e] shadow-[0_0_30px_rgb(255_183_3/0.6)] transition-transform hover:scale-105 sm:right-6 sm:bottom-24"
        >
          <span
            aria-hidden="true"
            className={`grid size-10 place-items-center rounded-full bg-[#22150e] text-2xl ${
              abrirSola ? "motion-safe:animate-pulse" : ""
            }`}
          >
            🎡
          </span>
          <span className="text-sm">{etiqueta}</span>
        </button>
      )}

      {visible && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Ruleta Mágica"
          className="fixed inset-0 z-[60] overflow-y-auto"
        >
          {/* El fondo: hermano de la tarjeta, nunca su ancestro (ver arriba). */}
          <div
            aria-hidden="true"
            onClick={() => setAbierta(false)}
            className="fixed inset-0 bg-[#120c22]/80 backdrop-blur-sm"
          />
          <div className="pointer-events-none relative grid min-h-full place-items-center px-3 py-6">
            <div className="noche pointer-events-auto relative w-full max-w-lg">
              <button
                type="button"
                onClick={() => setAbierta(false)}
                aria-label="Cerrar la ruleta"
                className="absolute -top-3 -right-1 z-10 grid size-11 place-items-center rounded-full border-2 border-[#ffb703]/60 bg-[#22150e] text-xl font-bold text-[#fff7e8] shadow-[0_0_20px_rgb(255_183_3/0.5)] hover:border-[#ffb703] sm:-right-3"
              >
                ✕
              </button>
              {children}
            </div>
          </div>
        </div>
      )}
    </>,
    document.body,
  );
}
