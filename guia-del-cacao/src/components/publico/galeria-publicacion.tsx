"use client";

import { useState } from "react";

/**
 * Las fotos de una publicación, en grande.
 *
 * Una sola ocupa todo el ancho; varias van en retícula y al tocar una se abre a
 * pantalla completa. Es lo que pedía la queja de que el muro se veía aburrido:
 * si la foto se ve del tamaño de un sello, da igual que esté.
 *
 * Se abre en el sitio y no en otra página: quien está leyendo no debería perder
 * el hilo para mirar la segunda foto.
 */
export function GaleriaPublicacion({
  fotos,
  titulo,
}: {
  fotos: string[];
  titulo: string;
}) {
  const [abierta, setAbierta] = useState<number | null>(null);

  if (fotos.length === 0) return null;

  return (
    <>
      <ul
        className={`mt-6 grid gap-3 ${
          fotos.length === 1 ? "grid-cols-1" : "grid-cols-2"
        }`}
      >
        {fotos.map((foto, i) => (
          <li
            key={foto}
            /*
              Con tres fotos, la primera ocupa la fila entera: en dos columnas la
              tercera se quedaba sola y la retícula parecía a medio cargar.
            */
            className={fotos.length === 3 && i === 0 ? "col-span-2" : ""}
          >
            <button
              type="button"
              onClick={() => setAbierta(i)}
              className="block w-full overflow-hidden rounded-3xl"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={foto}
                alt={`${titulo} (${i + 1} de ${fotos.length})`}
                className={`w-full object-cover transition-transform hover:scale-[1.02] ${
                  fotos.length === 1 ? "max-h-[32rem]" : "aspect-[4/3]"
                }`}
              />
            </button>
          </li>
        ))}
      </ul>

      {abierta !== null && (
        <div
          onClick={() => setAbierta(null)}
          role="dialog"
          aria-label={`Foto de ${titulo}`}
          className="fixed inset-0 z-50 grid place-items-center bg-ink/85 p-4"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fotos[abierta]}
            alt={`${titulo} (${abierta + 1} de ${fotos.length})`}
            className="max-h-[90vh] max-w-full rounded-2xl object-contain"
          />

          <p className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-crema px-4 py-2 text-sm font-bold text-cacao">
            {fotos.length > 1 && `${abierta + 1} de ${fotos.length} · `}
            Toca para cerrar
          </p>
        </div>
      )}
    </>
  );
}
