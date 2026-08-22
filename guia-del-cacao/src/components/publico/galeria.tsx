"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * El carrusel del micrositio, con las fotos abiertas a pantalla completa.
 *
 * En la tira se ven recortadas para que quepan varias; al tocarlas se abren
 * enteras, que es donde de verdad se aprecia una finca o una barra de
 * chocolate. Se puede pasar de una a otra sin cerrar y volver.
 *
 * Recibe las URLs ya armadas: así el componente no necesita saber en qué
 * bucket viven ni tiene que leer variables de entorno del cliente.
 */
export function Galeria({ fotos }: { fotos: string[] }) {
  // null = cerrado. El número es el índice de la foto abierta.
  const [abierta, setAbierta] = useState<number | null>(null);

  const cerrar = useCallback(() => setAbierta(null), []);

  const mover = useCallback(
    (paso: number) => {
      setAbierta((actual) => {
        if (actual === null) return null;
        // Da la vuelta en los extremos: llegar al final y no poder seguir se
        // siente como que algo se rompió.
        return (actual + paso + fotos.length) % fotos.length;
      });
    },
    [fotos.length],
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

  return (
    <>
      <ul className="mt-3 flex gap-3 overflow-x-auto px-4 pb-2">
        {fotos.map((foto, indice) => (
          <li key={foto} className="shrink-0">
            <button
              type="button"
              onClick={() => setAbierta(indice)}
              aria-label={`Ver la foto ${indice + 1} de ${fotos.length} en grande`}
              className="block overflow-hidden rounded-2xl border-2 border-ink/10 shadow-dura transition-transform hover:-translate-y-0.5"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={foto} alt="" className="h-44 w-64 object-cover" />
            </button>
          </li>
        ))}
      </ul>

      {abierta !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Foto ${abierta + 1} de ${fotos.length}`}
          // Cerrar tocando el fondo es lo que la gente intenta primero en
          // celular; el botón de la esquina es para quien no lo intenta.
          onClick={cerrar}
          className="fixed inset-0 z-50 flex flex-col bg-ink/90 p-4 backdrop-blur-sm"
        >
          <div className="flex items-center justify-between gap-4 text-crema">
            <span className="font-mono text-sm">
              {abierta + 1} / {fotos.length}
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
            alt={`Foto ${abierta + 1} de ${fotos.length}`}
            onClick={(evento) => evento.stopPropagation()}
            className="mx-auto min-h-0 flex-1 rounded-2xl object-contain"
          />

          {fotos.length > 1 && (
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
      )}
    </>
  );
}
