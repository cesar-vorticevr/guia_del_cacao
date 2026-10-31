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
 * Va de orilla a orilla, como la portada de una película: la foto ocupa todo
 * el ancho y se acerca despacio mientras está a la vista, y el texto va encima,
 * a la izquierda, sobre un velo de noche que lo deja leer pase lo que pase
 * detrás. Fue partido en dos columnas mientras vivía en una caja de 1180 px;
 * a lo ancho de la pantalla la foto ya tiene sitio para enseñarse entera y
 * el velo resuelve lo que antes resolvía el color plano.
 *
 * Abajo, una barra por negocio que se llena con el tiempo de cada uno: dice
 * cuántos hay, cuál se ve y cuánto falta para el siguiente, y se toca para
 * saltar.
 */
const INTERVALO_MS = 3000;

export function BannerRotativo({ diapositivas }: { diapositivas: Diapositiva[] }) {
  const [activa, setActiva] = useState(0);
  const total = diapositivas.length;

  useEffect(() => {
    if (total < 2) return;

    // Si alguien pidió menos animación en su sistema, el banner se queda
    // quieto en la primera y se navega con las barras.
    // La barra de tiempo no necesita aviso: la regla global de movimiento
    // reducido acorta su animación a nada y sale llena.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const reloj = setInterval(() => setActiva((i) => (i + 1) % total), INTERVALO_MS);
    return () => clearInterval(reloj);
    // `activa` en la lista reinicia el reloj al saltar con una barra: sin
    // eso, tocar una a medio tiempo la cambiaba al segundo siguiente.
  }, [total, activa]);

  if (total === 0) return null;

  return (
    <section aria-label="Negocios de la guía">
      <div className="relative h-[34rem] overflow-hidden border-y border-mango/20 sm:h-[38rem]">
        {diapositivas.map((slide, i) => {
          const visible = i === activa;
          return (
            <Link
              key={slide.slug}
              href={`/marca/${slide.slug}`}
              aria-hidden={!visible}
              tabIndex={visible ? 0 : -1}
              /*
                `pointer-events` no es un detalle de estilo: las diapositivas van
                apiladas y todas seguían recibiendo el clic aunque estuvieran en
                opacidad cero. La última del DOM gana siempre, así que sin esto
                tocar la foto llevaba al último negocio de la lista y no al que se
                estaba viendo.
              */
              className={`group absolute inset-0 transition-opacity duration-1000 ${
                visible ? "opacity-100" : "pointer-events-none opacity-0"
              }`}
            >
              {/* La foto se acerca despacio mientras se ve: el «Ken Burns». */}
              <span
                className={`absolute inset-0 bg-gradient-to-br from-selva-2 via-[#1c1236] to-cacao bg-cover bg-center transition-transform ease-out ${
                  visible ? "scale-100 duration-[4000ms]" : "scale-110 duration-0"
                }`}
                style={{
                  backgroundImage: slide.imagen ? `url(${slide.imagen})` : undefined,
                }}
              />

              {/*
                El velo: oscuro a la izquierda, donde va el texto, y abierto a la
                derecha para que la foto respire. Abajo se funde con la noche de
                la página. En celular el texto va abajo, así que el velo sube.
              */}
              <span className="absolute inset-0 bg-gradient-to-t from-[#0b1f16] via-[#0b1f16]/70 to-transparent sm:bg-gradient-to-r sm:from-[#0b1f16]/95 sm:via-[#0b1f16]/55 sm:to-transparent" />
              <span className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#0b1f16] to-transparent" />

              <span className="relative mx-auto flex h-full w-[92vw] max-w-[1180px] flex-col justify-end pb-16 sm:justify-center sm:pb-0">
                <span
                  className={`flex max-w-xl flex-col gap-2 transition-all delay-200 duration-700 ${
                    visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
                  }`}
                >
                  <span className="block text-balance font-display text-4xl font-medium leading-tight tracking-tight text-crema sm:text-6xl">
                    {slide.nombre}
                  </span>

                  {slide.sucursal && (
                    <span className="block text-lg text-crema/70">{slide.sucursal}</span>
                  )}

                  {slide.calificacion && (
                    <span className="block text-crema/80 [&_.text-cacao\/20]:text-crema/25 [&_[class*=text-cacao]]:text-crema/70">
                      <Promedio
                        promedio={slide.calificacion.promedio}
                        total={slide.calificacion.total}
                      />
                    </span>
                  )}

                  {/* El "acerca de" no aparece en celular: ahí gana la acción,
                      y el texto ya está completo en el micrositio. */}
                  {slide.texto && (
                    <span className="mt-1 hidden text-pretty text-lg text-crema/75 sm:line-clamp-3">
                      {slide.texto}
                    </span>
                  )}

                  {/* No es un botón de verdad —toda la diapositiva ya es el
                      enlace— pero sin algo que se lea como acción nadie descubre
                      que la foto entera se puede tocar. */}
                  <span className="boton-oro brillo mt-4 inline-flex w-fit items-center gap-2 rounded-full px-6 py-3 font-bold text-ink">
                    Conocer el lugar <span aria-hidden>→</span>
                  </span>
                </span>
              </span>
            </Link>
          );
        })}

        {total > 1 && (
          <div className="absolute inset-x-0 bottom-6 z-10 mx-auto flex w-[92vw] max-w-[1180px] gap-2">
            {diapositivas.map((slide, i) => (
              <button
                key={slide.slug}
                type="button"
                onClick={() => setActiva(i)}
                aria-label={`Ver ${slide.nombre}`}
                aria-current={i === activa}
                className="h-6 flex-1 sm:max-w-24"
              >
                <span className="block h-1 overflow-hidden rounded-full bg-crema/20">
                  <span
                    // La `key` reinicia la animación cada vez que esta barra se
                    // vuelve la activa.
                    key={i === activa ? `activa-${activa}` : "quieta"}
                    className={`block h-full rounded-full bg-mango shadow-[0_0_8px_rgb(255_183_3/0.9)] ${
                      i === activa ? "animate-llena" : i < activa ? "w-full opacity-60" : "w-0"
                    }`}
                    style={{ animationDuration: `${INTERVALO_MS}ms` }}
                  />
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
