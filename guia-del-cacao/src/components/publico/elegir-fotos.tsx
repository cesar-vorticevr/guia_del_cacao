"use client";

import { useState } from "react";
import { ACEPTA_MEDIO, TOPE_MEDIO_MB, TOPE_MB } from "@/lib/imagenes";
import {
  PROPORCION_MINIMA,
  TOPE_FOTOS,
  TOPE_SEGUNDOS_VIDEO,
} from "@/lib/limites";
import { useAcomodo } from "@/components/publico/ajustar-foto";
import { FotosElegidas } from "@/components/publico/fotos-elegidas";

/**
 * Elegir lo que lleva una publicación: hasta diez fotos, o un video.
 *
 * Enseña las miniaturas porque una publicación se elige por su portada: mandar
 * los archivos a ciegas y descubrir en el muro cuál quedó primera es el tipo de
 * sorpresa que hace que nadie vuelva a subir nada.
 *
 * Es un solo `<input multiple>` y no diez casillas: en celular, cada botón de
 * archivo es un viaje a la galería.
 *
 * **Las tres reglas se comprueban aquí y no solo al enviar.** Un video de tres
 * minutos son veinte megas que se suben para que el servidor los rechace al
 * final; mejor decirlo con el archivo todavía en el teléfono.
 *
 * Y las fotos se **acomodan** antes de subirse: en cuanto se eligen se abre el
 * encuadre, una por una. Hasta ahora aquí solo se avisaba de que lo que
 * sobresaliera del marco se iba a perder, y la única salida era recortar la
 * foto en otra aplicación y volver.
 */

/** Lo que se le enseña a quien eligió algo que no cabe. */
type Reclamo = { texto: string } | null;

/**
 * Cuánto dura un video, preguntándoselo al navegador.
 *
 * Se carga solo la metadata —`preload="metadata"`— que trae la duración sin
 * bajar el archivo entero; y como el archivo ya está en el aparato, no viaja a
 * ningún sitio. Si el navegador no logra leerlo se devuelve `null` y se deja
 * pasar: rechazar un video por no haber podido medirlo sería castigar a quien
 * tiene un formato raro, y el tope de peso sigue de guardia detrás.
 */
function duracionDe(archivo: File): Promise<number | null> {
  return new Promise((listo) => {
    const url = URL.createObjectURL(archivo);
    const video = document.createElement("video");

    const terminar = (valor: number | null) => {
      URL.revokeObjectURL(url);
      listo(valor);
    };

    video.preload = "metadata";
    video.onloadedmetadata = () =>
      terminar(Number.isFinite(video.duration) ? video.duration : null);
    video.onerror = () => terminar(null);
    video.src = url;
  });
}

export function ElegirFotos({ tope = TOPE_FOTOS }: { tope?: number }) {
  const [reclamo, setReclamo] = useState<Reclamo>(null);

  /*
    Se desarma en piezas y no se usa como `acomodo.algo`: al pasar una de ellas
    a `ref`, el lint de React da por contagiado el objeto entero y se queja de
    todo lo demás que se lea al pintar.
  */
  const {
    campo,
    previos,
    empezar,
    limpiar,
    quitar,
    reordenar,
    acomodarUna,
    encuadre,
  } = useAcomodo(PROPORCION_MINIMA);

  async function alElegir(evento: React.ChangeEvent<HTMLInputElement>) {
    const campo = evento.target;
    const elegidos = [...(campo.files ?? [])];

    limpiar();
    setReclamo(null);

    if (elegidos.length === 0) return;

    const videos = elegidos.filter((a) => a.type.startsWith("video/"));

    /*
      Vaciar el campo es parte del rechazo. Sin eso, el archivo malo sigue
      elegido, el formulario se puede enviar igual y el servidor contesta lo
      mismo que ya decía la pantalla — pero veinte megas más tarde.
    */
    const rechazar = (texto: string) => {
      campo.value = "";
      setReclamo({ texto });
    };

    if (videos.length > 1) {
      return rechazar("Solo cabe un video por publicación. Elige uno.");
    }

    if (videos.length === 1 && elegidos.length > 1) {
      return rechazar(
        "El video va solo: o subes fotos, o subes un video, no las dos cosas.",
      );
    }

    if (elegidos.length > tope) {
      return rechazar(`Elegiste ${elegidos.length}. El tope son ${tope} fotos.`);
    }

    const video = videos[0];

    if (video) {
      const segundos = await duracionDe(video);

      if (segundos !== null && segundos > TOPE_SEGUNDOS_VIDEO + 0.5) {
        return rechazar(
          `El video dura ${Math.round(segundos)} segundos y el tope son ${TOPE_SEGUNDOS_VIDEO}. Recórtalo y vuelve a intentarlo.`,
        );
      }
    }

    empezar(elegidos);
  }

  return (
    <div className="grid gap-2">
      <span className="font-bold text-selva-2">
        Fotos o video{" "}
        <span className="font-normal text-cacao">· hace falta al menos uno</span>
      </span>

      <input
        ref={campo}
        type="file"
        name="imagenes"
        accept={ACEPTA_MEDIO}
        multiple
        required
        onChange={alElegir}
        className="min-w-0 rounded-2xl border-2 border-dashed border-selva/25 bg-white px-3 py-3 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-selva file:px-4 file:py-2 file:font-bold file:text-crema"
      />

      {reclamo && (
        <p
          role="alert"
          className="rounded-2xl border-2 border-guayaba/40 bg-guayaba/10 px-4 py-3 text-sm font-bold text-cacao"
        >
          {reclamo.texto}
        </p>
      )}

      {encuadre}

      {previos.length > 0 && (
        <FotosElegidas
          previos={previos}
          alAcomodar={acomodarUna}
          alQuitar={quitar}
          alMover={reordenar}
        />
      )}

      <p className="text-sm text-cacao/70">
        Hasta {tope} fotos, o un video de {TOPE_SEGUNDOS_VIDEO} segundos. La
        primera es la portada: es la que se ve en el muro y la que sale cuando
        alguien comparte el enlace. Máximo {TOPE_MB} MB por foto y{" "}
        {TOPE_MEDIO_MB} MB el video.
      </p>
    </div>
  );
}
