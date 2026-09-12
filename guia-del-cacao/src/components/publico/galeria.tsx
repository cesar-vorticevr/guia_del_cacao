"use client";

import { useState } from "react";
import { VisorDeFotos } from "@/components/publico/visor-de-fotos";

/**
 * El carrusel del micrositio, con las fotos abiertas a pantalla completa.
 *
 * En la tira se ven recortadas para que quepan varias; al tocarlas se abren
 * enteras, que es donde de verdad se aprecia una finca o una barra de
 * chocolate. Se puede pasar de una a otra sin cerrar y volver.
 *
 * El visor se mudó a `VisorDeFotos` cuando la portada y el catálogo empezaron a
 * abrir fotos también: es el mismo comportamiento en tres sitios y no tres
 * copias que se arreglan por separado.
 *
 * Recibe las URLs ya armadas: así el componente no necesita saber en qué
 * bucket viven ni tiene que leer variables de entorno del cliente.
 */
export function Galeria({ fotos }: { fotos: string[] }) {
  // null = cerrado. El número es el índice de la foto abierta.
  const [abierta, setAbierta] = useState<number | null>(null);

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

      <VisorDeFotos fotos={fotos} abierta={abierta} alCambiar={setAbierta} />
    </>
  );
}
