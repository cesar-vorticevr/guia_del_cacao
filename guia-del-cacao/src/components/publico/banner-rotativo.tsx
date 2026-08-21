"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export type Diapositiva = {
  slug: string;
  nombre: string;
  imagen: string | null;
  texto: string | null;
};

/**
 * Banner de la portada. Rota cada 3 segundos entre todas las marcas Tier 3
 * (spec §5.2). No es un espacio de nadie en particular: Turismo aparece ahí
 * como una marca Tier 3 más.
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
    <section aria-label="Negocios destacados" className="pt-4">
      <div className="relative h-45 overflow-hidden rounded-3xl shadow-lg shadow-selva/25 sm:h-58">
        {diapositivas.map((slide, i) => (
          <Link
            key={slide.slug}
            href={`/marca/${slide.slug}`}
            aria-hidden={i !== activa}
            tabIndex={i === activa ? 0 : -1}
            className="absolute inset-0 flex flex-col justify-end bg-cacao p-6 transition-opacity duration-500"
            style={{
              opacity: i === activa ? 1 : 0,
              backgroundImage: slide.imagen ? `url(${slide.imagen})` : undefined,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            <span className="self-start rounded-full bg-ink/40 px-3 py-1 font-mono text-xs text-crema">
              Destacado
            </span>

            <span className="mt-auto">
              <span className="block font-display text-2xl font-semibold text-white drop-shadow">
                {slide.nombre}
              </span>
              {slide.texto && (
                <span className="mt-1 block text-white/90 drop-shadow">{slide.texto}</span>
              )}
            </span>
          </Link>
        ))}
      </div>

      {total > 1 && (
        <div className="mt-2.5 flex justify-center gap-2">
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
