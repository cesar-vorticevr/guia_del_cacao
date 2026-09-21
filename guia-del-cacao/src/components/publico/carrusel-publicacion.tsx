"use client";

import { useEffect, useRef, useState } from "react";
import { PROPORCION_MINIMA } from "@/lib/limites";

/**
 * Lo que se ve de una publicación: una foto, diez, o un video.
 *
 * **El desplazamiento es del navegador, no mío.** `scroll-snap` da el arrastre
 * con el dedo, el frenado en cada foto y el rebote del final, en el idioma de
 * cada sistema. Escrito a mano con eventos de puntero sale peor, pesa más y se
 * pelea con el desplazamiento vertical del muro.
 *
 * **No es un enlace.** Tocar la foto no lleva a ningún sitio: tocarla dos veces
 * da corazón, como en cualquier muro, y para eso el área tiene que estar libre.
 * A la publicación se entra por el icono de comentar o por el enlace que
 * alguien comparte.
 */

export type MedioDeLaPublicacion = { url: string; esVideo: boolean };

export function CarruselPublicacion({
  medios,
  titulo,
  /** Se llama al dar dos toques. Sin esto, el doble toque no hace nada. */
  alDarCorazon,
  className = "",
}: {
  medios: MedioDeLaPublicacion[];
  titulo: string;
  alDarCorazon?: () => void;
  className?: string;
}) {
  const pista = useRef<HTMLDivElement>(null);
  const [actual, setActual] = useState(0);
  const [festejo, setFestejo] = useState(0);

  const ultimoToque = useRef(0);

  /*
    Qué foto se está viendo, para pintar su puntito. Se mira el desplazamiento
    en vez de escuchar cada cuadro: `scrollend` todavía no está en todos los
    navegadores, y con `scroll` a secas el cálculo es una división.
  */
  useEffect(() => {
    const nodo = pista.current;
    if (!nodo || medios.length < 2) return;

    const mirar = () => {
      const cual = Math.round(nodo.scrollLeft / nodo.clientWidth);
      setActual(Math.min(Math.max(cual, 0), medios.length - 1));
    };

    nodo.addEventListener("scroll", mirar, { passive: true });
    return () => nodo.removeEventListener("scroll", mirar);
  }, [medios.length]);

  /**
   * Dos toques seguidos son un corazón.
   *
   * Se cuenta a mano y no con `onDoubleClick` porque ese evento no existe en
   * el navegador de un teléfono, que es donde de verdad se hace este gesto.
   * 300 ms es el margen habitual: más corto se escapan los dedos lentos, más
   * largo y dos toques a fotos distintas cuentan como uno.
   */
  function alTocar() {
    const ahora = Date.now();

    if (ahora - ultimoToque.current < 300) {
      ultimoToque.current = 0;
      // La clave sube para que React reemplace el corazón y la animación
      // vuelva a empezar aunque se toque dos veces seguidas.
      setFestejo((n) => n + 1);
      alDarCorazon?.();
      return;
    }

    ultimoToque.current = ahora;
  }

  /** Mueve una foto en la dirección que se le diga. */
  function correr(hacia: -1 | 1) {
    const nodo = pista.current;
    if (!nodo) return;

    nodo.scrollBy({ left: nodo.clientWidth * hacia, behavior: "smooth" });
  }

  return (
    <div className={`group/carrusel relative ${className}`}>
      <div
        ref={pista}
        onPointerUp={alDarCorazon ? alTocar : undefined}
        className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {medios.map((medio, i) => (
          <div key={medio.url} className="w-full shrink-0 snap-center">
            {medio.esVideo ? (
              <VideoDeLaPublicacion url={medio.url} />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={medio.url}
                alt={i === 0 ? titulo : ""}
                loading="lazy"
                draggable={false}
                style={{ aspectRatio: `${PROPORCION_MINIMA}`, objectFit: "cover" }}
                className="w-full bg-crema-2"
              />
            )}
          </div>
        ))}
      </div>

      {/*
        El corazón del doble toque. Vive fuera de la pista para que no se
        arrastre con ella, y no intercepta toques —`pointer-events-none`— o
        taparía justo el sitio donde se acaba de tocar.
      */}
      {festejo > 0 && (
        <span
          key={festejo}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 grid animate-brinca place-items-center text-7xl drop-shadow-lg"
        >
          ❤️
        </span>
      )}

      {medios.length > 1 && (
        <>
          {/*
            Las flechas son de ratón, no de dedo: `hidden sm:flex`. En un
            teléfono el gesto es arrastrar, y dos botones encima de la foto solo
            taparían lo que se viene a ver.

            Se asoman al pasar el ratón por encima —`group-hover/carrusel`— y
            desaparecen en la primera y la última, que es donde no llevarían a
            ningún sitio. Poca opacidad y fondo apenas translúcido, para que se
            lean sobre una foto clara y sobre una oscura sin pelearse con ella.
          */}
          {actual > 0 && (
            <FlechaDelCarrusel hacia={-1} alPulsar={() => correr(-1)} />
          )}

          {actual < medios.length - 1 && (
            <FlechaDelCarrusel hacia={1} alPulsar={() => correr(1)} />
          )}

          {/* Cuántas van y en cuál vas, para quien no ve los puntitos. */}
          <span role="status" className="sr-only">
            {`Foto ${actual + 1} de ${medios.length}`}
          </span>

          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
            {medios.map((medio, i) => (
              <span
                key={medio.url}
                aria-hidden="true"
                className={`size-1.5 rounded-full transition-colors ${
                  i === actual ? "bg-white" : "bg-white/50"
                }`}
              />
            ))}
          </div>

          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-3 right-3 rounded-full bg-ink/60 px-2 py-0.5 font-mono text-xs font-bold text-crema"
          >
            {actual + 1}/{medios.length}
          </span>
        </>
      )}
    </div>
  );
}

/**
 * Un video del muro: en bucle, sin sonido y solo mientras se ve.
 *
 * **`preload="none"` es lo que hace que esto no cueste una fortuna.** El
 * archivo se sirve tal cual se subió, sin recodificar, así que cada quien se
 * lleva los megas enteros. Sin esto, bajar por veinte publicaciones descargaría
 * veinte videos, se miren o no.
 *
 * Y por eso también se reproduce **solo el que está en pantalla**, y se pausa
 * al salir: es lo que hace cualquier muro, y aquí además es la diferencia entre
 * un video servido y cinco.
 *
 * Silenciado no es una preferencia: ningún navegador deja que un video arranque
 * solo con sonido. El botón lo enciende, y entonces sí lo pide la persona.
 */
function VideoDeLaPublicacion({ url }: { url: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const [sonando, setSonando] = useState(false);

  useEffect(() => {
    const nodo = video.current;
    if (!nodo) return;

    const observador = new IntersectionObserver(
      ([entrada]) => {
        if (entrada.isIntersecting) {
          // Puede fallar —una pestaña en segundo plano, o el ahorro de
          // batería— y no es nada que haya que contarle a nadie.
          void nodo.play().catch(() => {});
        } else {
          nodo.pause();
        }
      },
      // La mitad a la vista: con menos, un video asomando por el borde ya
      // estaría gastando datos.
      { threshold: 0.5 },
    );

    observador.observe(nodo);
    return () => observador.disconnect();
  }, []);

  return (
    <div className="relative">
      <video
        ref={video}
        src={url}
        loop
        muted={!sonando}
        playsInline
        preload="none"
        style={{ aspectRatio: `${PROPORCION_MINIMA}`, objectFit: "cover" }}
        className="w-full bg-ink"
      />

      {/*
        Discreto y abajo a la derecha, que es donde lo pone todo el mundo. Para
        del doble toque con `stopPropagation`: encender el sonido no es dar
        corazón.
      */}
      <button
        type="button"
        onPointerUp={(evento) => evento.stopPropagation()}
        onClick={() => {
          const nodo = video.current;
          if (!nodo) return;

          nodo.muted = sonando;
          setSonando((antes) => !antes);
        }}
        aria-label={sonando ? "Silenciar el video" : "Activar el sonido"}
        className="absolute right-3 bottom-3 grid size-9 place-items-center rounded-full bg-ink/60 text-crema backdrop-blur-sm transition-colors hover:bg-ink/80"
      >
        {sonando ? <IconoConSonido /> : <IconoSinSonido />}
      </button>
    </div>
  );
}

/** Una de las dos flechas de escritorio. */
function FlechaDelCarrusel({
  hacia,
  alPulsar,
}: {
  hacia: -1 | 1;
  alPulsar: () => void;
}) {
  const izquierda = hacia === -1;

  return (
    <button
      type="button"
      // Para el doble toque: pasar de foto no es dar corazón.
      onPointerUp={(evento) => evento.stopPropagation()}
      onClick={alPulsar}
      aria-label={izquierda ? "Foto anterior" : "Foto siguiente"}
      className={`absolute top-1/2 hidden size-9 -translate-y-1/2 place-items-center rounded-full bg-ink/40 text-crema opacity-0 backdrop-blur-sm transition-opacity group-hover/carrusel:opacity-100 focus-visible:opacity-100 hover:bg-ink/60 sm:grid ${
        izquierda ? "left-3" : "right-3"
      }`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="size-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={izquierda ? "m15 5-7 7 7 7" : "m9 5 7 7-7 7"} />
      </svg>
    </button>
  );
}

function IconoSinSonido() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 5 6 9H3v6h3l5 4z" />
      <path d="m23 9-6 6" />
      <path d="m17 9 6 6" />
    </svg>
  );
}

function IconoConSonido() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 5 6 9H3v6h3l5 4z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M19 5a9 9 0 0 1 0 14" />
    </svg>
  );
}
