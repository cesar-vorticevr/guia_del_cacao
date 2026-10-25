"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { PortadaPublicacion } from "@/components/publico/portada-publicacion";
import { esVideo } from "@/lib/imagenes";

/**
 * La foto de una tarjeta de la comunidad, con todas las que trae la
 * publicación: flechas a los lados, el contador en la esquina y deslizar con
 * el dedo en celular.
 *
 * Así se ojean las fotos sin abrir la publicación, que es lo que hacía el muro
 * en columna con su carrusel grande. Tocar la foto sigue llevando adentro.
 *
 * Las flechas son botones **hermanos** del enlace, no hijos: un botón dentro de
 * un `<a>` es HTML inválido y además el clic se iría a la publicación. Con una
 * sola foto (o ninguna) no hay flechas ni contador.
 */
export function FotosDeTarjeta({
  id,
  href,
  titulo,
  fotos,
}: {
  id: string;
  href: string;
  titulo: string;
  /** Rutas guardadas y su URL; la ruta dice si es video. */
  fotos: { ruta: string; url: string }[];
}) {
  const [actual, setActual] = useState(0);
  const inicioDelDedo = useRef<number | null>(null);
  const total = fotos.length;
  const foto = fotos[actual];

  const mover = (paso: number) => setActual((i) => (i + paso + total) % total);

  return (
    <div
      className="relative block aspect-[4/3] w-full shrink-0 overflow-hidden bg-crema-2"
      onTouchStart={(evento) => {
        inicioDelDedo.current = evento.touches[0].clientX;
      }}
      onTouchEnd={(evento) => {
        if (inicioDelDedo.current === null || total < 2) return;
        const recorrido = evento.changedTouches[0].clientX - inicioDelDedo.current;
        inicioDelDedo.current = null;
        // Cuarenta píxeles separan un deslizamiento de un toque tembloroso.
        if (Math.abs(recorrido) > 40) mover(recorrido < 0 ? 1 : -1);
      }}
    >
      <Link href={href} tabIndex={-1} aria-hidden className="absolute inset-0">
        {foto && esVideo(foto.ruta) ? (
          <video
            key={foto.url}
            src={foto.url}
            muted
            playsInline
            preload="metadata"
            className="absolute inset-0 size-full object-cover"
          />
        ) : (
          <PortadaPublicacion
            key={foto?.url ?? "sin-foto"}
            id={id}
            foto={foto?.url ?? null}
            titulo={titulo}
            className="absolute inset-0 size-full"
          />
        )}
      </Link>

      {total > 1 && (
        <>
          <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-ink/60 px-2 py-0.5 font-mono text-xs font-bold text-crema backdrop-blur-sm">
            {actual + 1}/{total}
          </span>

          {(
            [
              { paso: -1, lado: "left-2", texto: "Foto anterior", flecha: "‹" },
              { paso: 1, lado: "right-2", texto: "Foto siguiente", flecha: "›" },
            ] as const
          ).map((boton) => (
            <button
              key={boton.paso}
              type="button"
              onClick={() => mover(boton.paso)}
              aria-label={boton.texto}
              className={`absolute ${boton.lado} top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-ink/55 text-2xl leading-none text-crema backdrop-blur-sm transition-opacity hover:bg-ink/75 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100`}
            >
              <span aria-hidden className="-mt-0.5">
                {boton.flecha}
              </span>
            </button>
          ))}

          <span className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
            {fotos.map((f, i) => (
              <span
                key={f.ruta}
                className={`size-1.5 rounded-full transition-colors ${
                  i === actual ? "bg-crema" : "bg-crema/45"
                }`}
              />
            ))}
          </span>
        </>
      )}
    </div>
  );
}
