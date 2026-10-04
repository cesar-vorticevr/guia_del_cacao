"use client";

import { useRef, useState } from "react";
import { PROPORCION_MINIMA } from "@/lib/limites";

/**
 * Las fotos ya elegidas: cómo van a verse, en qué orden, y qué se les puede
 * hacer sin empezar de nuevo.
 *
 * Tres cosas se hacen aquí y ninguna se podía antes:
 *
 * **Quitar una.** Un campo de archivo se elige entero, así que arrepentirse de
 * la tercera foto obligaba a cancelar la publicación completa y volver a
 * empezar. Ahora cada una lleva su ×.
 *
 * **Cambiar el orden arrastrándolas.** La primera es la portada —la que sale en
 * el muro y la que aparece cuando alguien comparte el enlace—, y hasta ahora el
 * orden lo decidía el selector de archivos del teléfono.
 *
 * **Acomodarla, tocándola.** Sin botón: en una miniatura de cien píxeles, un
 * botón con letra legible tapa justo la foto que se quiere juzgar. El toque se
 * distingue del arrastre por lo que se movió el dedo, no por cuánto tardó.
 *
 * Con varias, la tira **se cuadricula en vez de deslizarse**. Lo que había era
 * un carrusel a dos tercios de ancho que imitaba el del muro, y eso era bueno
 * para mirar y malo para ordenar: llevar la última al primer sitio pedía
 * arrastrar dos mil píxeles por dentro de un contenedor que a la vez quería
 * desplazarse. Cuadriculadas caben las diez a la vista, el arrastre no pelea con
 * ningún desplazamiento, y lo que se prometía —la proporción con la que se van a
 * ver— sigue intacto, que es lo que de verdad importaba.
 */
export function FotosElegidas({
  previos,
  alAcomodar,
  alQuitar,
  alMover,
}: {
  previos: { url: string; esVideo: boolean }[];
  alAcomodar: (i: number) => void;
  alQuitar: (i: number) => void;
  alMover: (de: number, a: number) => void;
}) {
  const varias = previos.length > 1;

  const listaRef = useRef<HTMLUListElement>(null);

  /*
    El arrastre en curso: cuál se lleva, de dónde salió el dedo y si ya se movió
    de verdad.

    **Va en una referencia y no en estado, y eso no es una optimización: es lo
    que hace que el toque funcione.** Con el índice en estado, `pointerup` leía
    el valor de la pintada anterior —null— porque en un toque rápido los dos
    eventos llegan en la misma tarea y React todavía no ha repintado: el
    encuadre no se abría y no había forma de saber por qué. Una referencia se
    lee en el momento, que es lo que un gesto necesita.

    El estado de abajo es solo para pintar: qué miniatura se está llevando, para
    encogerla mientras viaja.
  */
  const arrastre = useRef<{
    i: number;
    x: number;
    y: number;
    movio: boolean;
  } | null>(null);

  const [llevando, setLlevando] = useState<number | null>(null);
  const [moviendo, setMoviendo] = useState(false);

  /** Sobre qué miniatura está el dedo, mirando las cajas de verdad. */
  function posicionEn(x: number, y: number) {
    const lista = listaRef.current;
    if (!lista) return null;

    const puesto = [...lista.children].findIndex((hijo) => {
      const caja = hijo.getBoundingClientRect();
      return (
        x >= caja.left && x <= caja.right && y >= caja.top && y <= caja.bottom
      );
    });

    return puesto === -1 ? null : puesto;
  }

  function alBajar(evento: React.PointerEvent<HTMLLIElement>, i: number) {
    // El × hace lo suyo: ni arrastra ni acomoda.
    if ((evento.target as HTMLElement).closest("button")) return;

    /*
      La captura es lo que deja seguir el dedo cuando se sale de la miniatura
      —y arrastrar consiste justamente en salirse—, pero puede fallar si el
      puntero ya se soltó. Si falla, el arrastre pierde precisión al cruzar
      huecos y nada más; perder el gesto entero por eso sería peor.
    */
    try {
      evento.currentTarget.setPointerCapture(evento.pointerId);
    } catch {
      // Sin captura se sigue con los eventos normales.
    }

    arrastre.current = { i, x: evento.clientX, y: evento.clientY, movio: false };
    setLlevando(i);
    setMoviendo(false);
  }

  /**
   * El orden cambia **mientras** se arrastra, no al soltar.
   *
   * Es lo que hace que se entienda: al soltar, la foto aparecería de golpe en
   * otro sitio y habría que reconstruir a posteriori qué pasó. Cambiando en
   * cuanto el dedo entra en la casilla de otra, se ve el hueco abrirse.
   *
   * Los ocho píxeles de margen antes de dar el arrastre por empezado son lo que
   * separa un toque de un arrastre: un dedo nunca se queda del todo quieto.
   */
  function alMoverPuntero(evento: React.PointerEvent<HTMLLIElement>) {
    const suyo = arrastre.current;
    if (!suyo) return;

    if (
      !suyo.movio &&
      (Math.abs(evento.clientX - suyo.x) > 8 ||
        Math.abs(evento.clientY - suyo.y) > 8)
    ) {
      suyo.movio = true;
      setMoviendo(true);
    }

    if (!suyo.movio || !varias) return;

    const destino = posicionEn(evento.clientX, evento.clientY);

    if (destino !== null && destino !== suyo.i) {
      alMover(suyo.i, destino);
      suyo.i = destino;
      setLlevando(destino);
    }
  }

  function alSoltar() {
    const suyo = arrastre.current;

    arrastre.current = null;
    setLlevando(null);
    setMoviendo(false);

    if (!suyo) return;
    if (!suyo.movio && !previos[suyo.i]?.esVideo) alAcomodar(suyo.i);
  }

  /**
   * Con el teclado, lo mismo: flechas para mover, Enter para acomodar.
   *
   * Arrastrar con el ratón a pulso no está al alcance de todo el mundo, y el
   * orden es el que decide cuál es la portada: dejarlo solo en un gesto sería
   * dejar la portada fuera del alcance de quien navega con teclado.
   */
  function alTeclear(evento: React.KeyboardEvent<HTMLLIElement>, i: number) {
    if (evento.key === "Enter" || evento.key === " ") {
      evento.preventDefault();
      if (!previos[i].esVideo) alAcomodar(i);
      return;
    }

    if (!varias) return;

    const paso =
      evento.key === "ArrowLeft" ? -1 : evento.key === "ArrowRight" ? 1 : 0;

    if (paso === 0) return;

    const destino = i + paso;
    if (destino < 0 || destino >= previos.length) return;

    evento.preventDefault();
    alMover(i, destino);
  }

  return (
    <>
      <ul
        ref={listaRef}
        className={
          varias
            ? "grid grid-cols-3 gap-2 sm:grid-cols-4"
            : "grid w-2/3 grid-cols-1"
        }
      >
        {previos.map((previo, i) => (
          <li
            key={previo.url}
            tabIndex={0}
            onPointerDown={(evento) => alBajar(evento, i)}
            onPointerMove={alMoverPuntero}
            onPointerUp={alSoltar}
            onPointerCancel={alSoltar}
            onKeyDown={(evento) => alTeclear(evento, i)}
            aria-label={
              previo.esVideo
                ? "El video que vas a subir"
                : `Foto ${i + 1} de ${previos.length}. Enter para acomodarla${
                    varias ? ", flechas para cambiar su orden" : ""
                  }.`
            }
            className={`relative rounded-xl transition-transform focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-selva ${
              varias ? "cursor-grab touch-none" : "cursor-pointer"
            } ${llevando === i && moviendo ? "scale-95 opacity-60" : ""}`}
          >
            {previo.esVideo ? (
              <video
                src={previo.url}
                muted
                playsInline
                preload="metadata"
                style={{
                  aspectRatio: `${PROPORCION_MINIMA}`,
                  objectFit: "cover",
                }}
                className="pointer-events-none w-full rounded-xl border-2 border-selva/15 bg-ink"
              />
            ) : (
              /*
                `pointer-events-none` en la imagen, y no solo `draggable`: sin
                eso el navegador se queda con el arrastre nativo de imágenes y
                el nuestro no llega a empezar.
              */
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previo.url}
                alt=""
                draggable={false}
                style={{
                  aspectRatio: `${PROPORCION_MINIMA}`,
                  objectFit: "cover",
                }}
                className="pointer-events-none w-full rounded-xl border-2 border-selva/15 bg-crema-2 select-none"
              />
            )}

            <button
              type="button"
              onClick={() => alQuitar(i)}
              aria-label={
                previo.esVideo ? "Quitar el video" : `Quitar la foto ${i + 1}`
              }
              className="absolute -top-2 -right-2 grid size-8 place-items-center rounded-full border-2 border-guayaba bg-white text-lg font-bold text-cacao shadow-dura-sm"
            >
              ×
            </button>

            {varias && (
              <span className="pointer-events-none absolute bottom-1 left-1 rounded-full bg-selva px-2 py-0.5 font-mono text-[0.6rem] font-bold text-crema">
                {i === 0 ? "Portada" : i + 1}
              </span>
            )}
          </li>
        ))}
      </ul>

      <p className="text-sm text-cacao/70">
        {varias
          ? "Así se van a ver. Toca una para acomodarla y arrástrala para cambiar el orden: la primera es la portada."
          : "Así se va a ver. Tócala para moverla o acercarla dentro del marco."}
      </p>
    </>
  );
}
