"use client";

import { useCallback, useEffect } from "react";

/**
 * El visor a pantalla completa. Una foto, o varias que se pasan sin cerrar.
 *
 * Vivía dentro de `Galeria`, y salió de ahí cuando hubo que abrir también la
 * portada del micrositio y las fotos del catálogo. Son tres sitios que quieren
 * lo mismo —ver la foto entera— y tres copias de esto habrían sido tres sitios
 * donde arreglar el mismo día que Escape dejara de funcionar.
 *
 * Recibe las URLs ya armadas: así no necesita saber en qué bucket viven ni leer
 * variables de entorno del cliente.
 */
export function VisorDeFotos({
  fotos,
  /** Índice de la foto abierta. `null` es cerrado. */
  abierta,
  alCambiar,
  /** Para el lector de pantalla: «Foto de la barra 70%», por ejemplo. */
  etiqueta,
}: {
  fotos: string[];
  abierta: number | null;
  alCambiar: (indice: number | null) => void;
  etiqueta?: string;
}) {
  const cerrar = useCallback(() => alCambiar(null), [alCambiar]);

  const mover = useCallback(
    (paso: number) => {
      if (abierta === null) return;
      // Da la vuelta en los extremos: llegar al final y no poder seguir se
      // siente como que algo se rompió.
      alCambiar((abierta + paso + fotos.length) % fotos.length);
    },
    [abierta, alCambiar, fotos.length],
  );

  // El teclado tiene que servir para lo mismo que el dedo. Solo se escucha
  // mientras hay una foto abierta, para no dejar un listener puesto de balde.
  useEffect(() => {
    if (abierta === null) return;

    function alTeclear(evento: KeyboardEvent) {
      if (evento.key === "Escape") cerrar();
      if (evento.key === "ArrowRight") mover(1);
      if (evento.key === "ArrowLeft") mover(-1);
    }

    document.addEventListener("keydown", alTeclear);

    // Sin esto, la página de atrás sigue haciendo scroll debajo del visor.
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", alTeclear);
      document.body.style.overflow = overflowPrevio;
    };
  }, [abierta, cerrar, mover]);

  if (abierta === null) return null;

  const varias = fotos.length > 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={
        varias
          ? `Foto ${abierta + 1} de ${fotos.length}`
          : (etiqueta ?? "Foto en grande")
      }
      // Cerrar tocando el fondo es lo que la gente intenta primero en celular;
      // el botón de la esquina es para quien no lo intenta.
      onClick={cerrar}
      className="fixed inset-0 z-50 flex flex-col bg-ink/90 p-4 backdrop-blur-sm"
    >
      <div className="flex items-center justify-between gap-4 text-crema">
        <span className="font-mono text-sm">
          {varias ? `${abierta + 1} / ${fotos.length}` : (etiqueta ?? "")}
        </span>

        <button
          type="button"
          onClick={cerrar}
          aria-label="Cerrar"
          className="grid size-12 place-items-center rounded-full bg-crema/15 text-2xl font-bold transition-colors hover:bg-crema/25"
        >
          ×
        </button>
      </div>

      {/* El clic en la foto no debe cerrar: solo el del fondo. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={fotos[abierta]}
        alt={
          varias ? `Foto ${abierta + 1} de ${fotos.length}` : (etiqueta ?? "")
        }
        onClick={(evento) => evento.stopPropagation()}
        className="mx-auto min-h-0 flex-1 rounded-2xl object-contain"
      />

      {varias && (
        <div className="mt-4 flex justify-center gap-4">
          <button
            type="button"
            onClick={(evento) => {
              evento.stopPropagation();
              mover(-1);
            }}
            aria-label="Foto anterior"
            className="min-h-14 min-w-14 rounded-full bg-crema px-6 font-display text-lg font-semibold text-selva-2"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={(evento) => {
              evento.stopPropagation();
              mover(1);
            }}
            aria-label="Foto siguiente"
            className="min-h-14 min-w-14 rounded-full bg-crema px-6 font-display text-lg font-semibold text-selva-2"
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
}
