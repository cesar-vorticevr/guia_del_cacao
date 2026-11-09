"use client";

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
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
 *
 * **La tarjeta siempre cabe en la pantalla**, a lo ancho y a lo alto. A lo
 * ancho la acota su `w-full`. A lo alto, la rueda se encoge lo que la tarjeta
 * se pase del alto de la ventana (`ajustarRueda`): como es cuadrada, quitarle
 * ancho le quita lo mismo de alto, y el texto de alrededor no cambia porque su
 * ancho es el de la tarjeta. Se mide en vez de calcularse con CSS porque lo que
 * ocupa ese texto depende del ancho: en el celular las reglas son tres renglones.
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
  const tarjeta = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!visible) return;
    const ajustarRueda = () => {
      const caja = tarjeta.current;
      const rueda = caja?.querySelector<HTMLElement>(".ruleta-rueda")?.parentElement;
      if (!caja || !rueda) return;
      // Se mide desde su tamaño natural: así también vuelve a crecer.
      rueda.style.maxWidth = "";
      // 16px de aire arriba y abajo, los mismos del `py-4` del contenedor.
      const sobra = caja.getBoundingClientRect().height - (window.innerHeight - 32);
      if (sobra > 0) {
        rueda.style.maxWidth = `${Math.max(144, rueda.getBoundingClientRect().width - sobra)}px`;
      }
    };
    ajustarRueda();
    // Las letras pueden llegar después de la primera medida y mover los renglones.
    void document.fonts?.ready.then(ajustarRueda);
    // Se observa la capa fija, que mide lo mismo que la pantalla: el `resize`
    // de `window` no siempre llega (girar el celular, la barra del navegador
    // que aparece y se esconde).
    const capa = tarjeta.current?.closest<HTMLElement>("[role=dialog]");
    const observador = new ResizeObserver(ajustarRueda);
    if (capa) observador.observe(capa);
    window.addEventListener("resize", ajustarRueda);
    return () => {
      observador.disconnect();
      window.removeEventListener("resize", ajustarRueda);
    };
  }, [visible]);

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
          <div className="pointer-events-none relative grid min-h-full place-items-center px-3 py-4">
            <div ref={tarjeta} className="noche pointer-events-auto relative w-full max-w-lg">
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
