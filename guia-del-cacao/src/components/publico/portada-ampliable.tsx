"use client";

import { useState } from "react";
import { VisorDeFotos } from "@/components/publico/visor-de-fotos";

/**
 * La portada del micrositio, que se abre entera al tocarla.
 *
 * Era un `div` con `background-image`: se veía recortada a la altura de la
 * cabecera y no había forma de ver el resto. Una foto de una finca o de un
 * mostrador recortada a 160 px de alto enseña una franja, y justo esa foto es
 * lo que alguien quiere mirar antes de decidir si va.
 *
 * Sigue siendo fondo y no contenido: el `alt` va vacío en la cabecera —lo que
 * describe al negocio es el `h1` de al lado— y el texto del botón es lo que
 * anuncia la acción a un lector de pantalla.
 */
export function PortadaAmpliable({
  foto,
  negocio,
}: {
  foto: string;
  negocio: string;
}) {
  const [abierta, setAbierta] = useState<number | null>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierta(0)}
        aria-label={`Ver la foto de ${negocio} en grande`}
        className="group block h-40 w-full overflow-hidden rounded-3xl bg-cacao sm:h-56"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={foto}
          alt=""
          className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      </button>

      <VisorDeFotos
        fotos={[foto]}
        abierta={abierta}
        alCambiar={setAbierta}
        etiqueta={negocio}
      />
    </>
  );
}
