"use client";

import { createPortal } from "react-dom";
import { useFormStatus } from "react-dom";

/**
 * Lo que se ve mientras la publicación sube.
 *
 * Era el hueco del asunto: entre pulsar «Publicar» y aterrizar en la
 * publicación pasan varios segundos —diez fotos recortadas son varios megas
 * subiendo por la red de una feria— y en todo ese rato lo único que cambiaba
 * era la palabra del botón. Con el teléfono en la mano eso se lee como que no
 * pasó nada, y lo que se hace entonces es volver a pulsar.
 *
 * Así que además de tapar el formulario —que impide ese segundo envío— hay algo
 * que se mueve, para que el rato de espera se vea como un rato de espera y no
 * como una avería.
 *
 * Va **dentro** del `<form>`, porque de ahí saca `useFormStatus` si el envío
 * está en curso, y sale por un portal, porque un `fixed` dentro de una tarjeta
 * del muro —que tiene `overflow` y sombras— deja de ser fijo y se recorta.
 */
export function Publicando() {
  const { pending } = useFormStatus();

  if (!pending) return null;

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 grid place-items-center overflow-hidden bg-ink/60 p-6"
    >
      <div className="w-full max-w-sm animate-brinca rounded-3xl border-4 border-mango bg-crema p-8 text-center shadow-dura-alta">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/marca/mazorca.png"
          alt=""
          className="mx-auto size-16 animate-bounce motion-reduce:animate-none"
        />

        <p className="mt-4 font-display text-2xl font-semibold text-selva-2">
          Subiendo tus fotos…
        </p>

        <p className="mt-2 text-cacao">
          No cierres esta pantalla. Cuando termine te llevamos a tu publicación.
        </p>
      </div>
    </div>,
    document.body,
  );
}
