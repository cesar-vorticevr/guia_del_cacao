"use client";

import { useRef, useState } from "react";

/**
 * El anuncio de subir de plan y la lista que abre.
 *
 * Van juntos en un componente porque comparten un estado: **tocar el anuncio
 * tiene que abrir la lista**. Antes el anuncio era un cartel muerto — decía
 * "cámbiate a Premier" y no llevaba a ninguna parte, así que había que buscar
 * el botón de "ver los planes" más abajo y volver a decidir lo que ya se había
 * decidido al tocar.
 *
 * Al abrirse desplaza hasta la lista: en celular el anuncio ocupa casi toda la
 * pantalla y lo que se destapa queda por debajo del pliegue, de modo que sin el
 * desplazamiento parecería que no pasó nada.
 *
 * El anuncio no desaparece al abrir. Quitarlo movería todo hacia arriba justo
 * cuando la vista está yendo hacia abajo, y se perdería de vista lo que se
 * acaba de pedir.
 */
export function PlanesDesplegables({
  anuncio,
  children,
}: {
  /** Qué ofrece el plan de arriba. Sin él no hay anuncio: no hay a dónde subir. */
  anuncio?: { nombre: string; ventajas: string; precio: string };
  /** La lista de planes y, dentro, la opción de cancelar. */
  children: React.ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);
  const lista = useRef<HTMLDivElement | null>(null);

  function abrir() {
    setAbierto(true);

    // Después de pintar, no antes: hasta que la lista no existe no hay a dónde
    // desplazarse.
    requestAnimationFrame(() =>
      lista.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }

  return (
    <>
      {anuncio && (
        <button
          type="button"
          onClick={abrir}
          aria-expanded={abierto}
          className="rounded-[2rem] border-2 border-ink/10 bg-mango px-6 py-8 text-left shadow-dura transition-transform hover:brightness-[1.03] active:translate-y-0.5"
        >
          <span className="flex flex-wrap items-baseline justify-between gap-3">
            <span className="font-display text-2xl text-ink">
              Cámbiate a {anuncio.nombre}
            </span>
            <span aria-hidden="true" className="font-bold text-cacao">
              Ver planes →
            </span>
          </span>

          <span className="mt-2 block max-w-prose text-cacao">
            {anuncio.ventajas} Por {anuncio.precio} al mes.
          </span>
        </button>
      )}

      <section ref={lista} className="grid scroll-mt-24 gap-4">
        <h2 className="font-display text-xl">Cambiar de plan</h2>

        {abierto ? (
          children
        ) : (
          <button
            type="button"
            onClick={abrir}
            className="inline-flex min-h-12 w-fit items-center rounded-full border-2 border-selva/25 bg-white px-6 font-bold text-selva-2 transition-transform active:translate-y-0.5"
          >
            Ver los planes
          </button>
        )}
      </section>
    </>
  );
}
