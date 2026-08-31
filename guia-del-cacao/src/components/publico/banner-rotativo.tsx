"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Promedio } from "@/components/publico/estrellas";

export type Diapositiva = {
  slug: string;
  /** El nombre de la marca: es lo que la gente reconoce. */
  nombre: string;
  /** La sucursal, debajo y en chico. Null si la marca no tiene nombre propio. */
  sucursal: string | null;
  imagen: string | null;
  texto: string | null;
  /** Promedio de estrellas, o null si al negocio no lo ha calificado nadie. */
  calificacion: { promedio: number; total: number } | null;
};

/**
 * Banner de la portada. Rota cada 3 segundos entre todas las marcas Tier 3
 * (spec §5.2). No es un espacio de nadie en particular: Turismo aparece ahí
 * como una marca Tier 3 más.
 *
 * La foto y el texto van en columnas separadas, no el texto encima de la foto.
 * Encima se veía bien mientras el banner era una franja, pero al crecer pasaron
 * dos cosas: el recorte se comía la imagen —una foto cuadrada en una caja de
 * 2.7:1 enseña su tercio central y nada más— y el texto quedaba a merced de lo
 * que hubiera detrás. Partido en dos, la foto se acerca a su proporción y las
 * letras caen sobre color plano.
 */
export function BannerRotativo({ diapositivas }: { diapositivas: Diapositiva[] }) {
  const [activa, setActiva] = useState(0);
  const total = diapositivas.length;

  useEffect(() => {
    if (total < 2) return;

    // Si alguien pidió menos animación en su sistema, el banner se queda
    // quieto en la primera y se navega con los puntos.
    const quieto = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (quieto) return;

    const reloj = setInterval(() => setActiva((i) => (i + 1) % total), 3000);
    return () => clearInterval(reloj);
  }, [total]);

  if (total === 0) return null;

  return (
    <section aria-label="Negocios destacados">
      <div className="relative h-[28rem] overflow-hidden rounded-3xl border-2 border-ink/10 shadow-dura-alta sm:h-[24rem] lg:h-[27rem]">
        {diapositivas.map((slide, i) => (
          <Link
            key={slide.slug}
            href={`/marca/${slide.slug}`}
            aria-hidden={i !== activa}
            tabIndex={i === activa ? 0 : -1}
            /*
              `pointer-events` no es un detalle de estilo: las diapositivas van
              apiladas y todas seguían recibiendo el clic aunque estuvieran en
              opacidad cero. La última del DOM gana siempre, así que sin esto
              tocar la foto llevaba al último negocio de la lista y no al que se
              estaba viendo.
            */
            className={`absolute inset-0 grid grid-rows-[1.15fr_1fr] bg-crema-2 transition-opacity duration-500 sm:grid-cols-2 sm:grid-rows-1 ${
              i === activa ? "" : "pointer-events-none"
            }`}
            style={{ opacity: i === activa ? 1 : 0 }}
          >
            <span
              className="relative bg-cacao"
              style={{
                backgroundImage: slide.imagen ? `url(${slide.imagen})` : undefined,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              <span className="absolute left-4 top-4 rounded-full bg-ink/50 px-3 py-1 font-mono text-xs text-crema">
                Destacado
              </span>
            </span>

            <span className="flex flex-col justify-center gap-1 p-6 sm:p-10">
              <span className="block font-display text-2xl font-semibold text-selva-2 sm:text-4xl">
                {slide.nombre}
              </span>

              {slide.sucursal && (
                <span className="block text-cacao/80">{slide.sucursal}</span>
              )}

              {slide.calificacion && (
                <span className="mt-1 block">
                  <Promedio
                    promedio={slide.calificacion.promedio}
                    total={slide.calificacion.total}
                  />
                </span>
              )}

              {/* El "acerca de" no aparece en celular: la mitad de abajo son
                  unos 200 px y con el párrafo dentro el botón se salía del
                  recorte. Ahí gana la acción, que el texto ya está completo en
                  el micrositio. */}
              {slide.texto && (
                <span className="mt-2 hidden text-pretty text-cacao sm:line-clamp-3 sm:text-lg">
                  {slide.texto}
                </span>
              )}

              {/* No es un botón de verdad —toda la diapositiva ya es el enlace—
                  pero sin algo que se lea como acción nadie descubre que la
                  tarjeta entera se puede tocar. */}
              <span className="mt-3 inline-flex w-fit rounded-full bg-selva px-5 py-2.5 font-bold text-crema shadow-dura-sm sm:mt-4">
                Ver el negocio
              </span>
            </span>
          </Link>
        ))}
      </div>

      {total > 1 && (
        <div className="mt-3 flex justify-center gap-2">
          {diapositivas.map((slide, i) => (
            <button
              key={slide.slug}
              type="button"
              onClick={() => setActiva(i)}
              aria-label={`Ver ${slide.nombre}`}
              aria-current={i === activa}
              className={`size-2.5 rounded-full transition-transform ${
                i === activa ? "scale-125 bg-selva" : "bg-selva/25"
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
