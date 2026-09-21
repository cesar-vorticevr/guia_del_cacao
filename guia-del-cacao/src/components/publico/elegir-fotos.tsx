"use client";

import { useState } from "react";
import { ACEPTA_MEDIO, TOPE_MEDIO_MB, TOPE_MB } from "@/lib/imagenes";
import {
  PROPORCION_MINIMA,
  TOPE_FOTOS,
  TOPE_SEGUNDOS_VIDEO,
} from "@/lib/limites";

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
  const [previos, setPrevios] = useState<
    { url: string; esVideo: boolean }[]
  >([]);
  const [reclamo, setReclamo] = useState<Reclamo>(null);

  async function alElegir(evento: React.ChangeEvent<HTMLInputElement>) {
    const campo = evento.target;
    const archivos = [...(campo.files ?? [])];

    // Se liberan los anteriores: cada `createObjectURL` reserva memoria hasta
    // que se revoca, y aquí se cambia de archivo varias veces seguidas.
    previos.forEach((p) => URL.revokeObjectURL(p.url));
    setPrevios([]);
    setReclamo(null);

    if (archivos.length === 0) return;

    const videos = archivos.filter((a) => a.type.startsWith("video/"));

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

    if (videos.length === 1 && archivos.length > 1) {
      return rechazar(
        "El video va solo: o subes fotos, o subes un video, no las dos cosas.",
      );
    }

    if (archivos.length > tope) {
      return rechazar(
        `Elegiste ${archivos.length}. El tope son ${tope} fotos.`,
      );
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

    setPrevios(
      archivos.map((archivo) => ({
        url: URL.createObjectURL(archivo),
        esVideo: archivo.type.startsWith("video/"),
      })),
    );
  }

  return (
    <div className="grid gap-2">
      <span className="font-bold text-selva-2">
        Fotos o video{" "}
        <span className="font-normal text-cacao">· hace falta al menos uno</span>
      </span>

      <input
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

      {previos.length > 0 && (
        <>
          {/*
            **Así va a quedar, no una miniatura de lo que subiste.**

            Antes las previas eran cuadradas y el muro enseña 4:5, así que quien
            subía un cartel vertical veía el cuadrado aquí y descubría el
            recorte ya publicado. Ahora es el mismo `aspectRatio` y el mismo
            `object-cover` que usa el carrusel, sacados los dos de
            `PROPORCION_MINIMA`: lo que se ve aquí es literalmente lo que se va
            a ver allá.

            Se desliza igual que el carrusel, con `scroll-snap`, para poder
            repasarlas una por una antes de publicar.
          */}
          <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain rounded-xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {previos.map((previo, i) => (
              <div
                key={previo.url}
                className="relative w-2/3 shrink-0 snap-center sm:w-1/2"
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
                    className="w-full rounded-xl border-2 border-selva/15 bg-ink"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previo.url}
                    alt={`Foto ${i + 1}`}
                    style={{
                      aspectRatio: `${PROPORCION_MINIMA}`,
                      objectFit: "cover",
                    }}
                    className="w-full rounded-xl border-2 border-selva/15 bg-crema-2"
                  />
                )}

                {i === 0 && previos.length > 1 && (
                  <span className="absolute bottom-2 left-2 rounded-full bg-selva px-2 py-0.5 font-mono text-[0.6rem] font-bold text-crema">
                    Portada
                  </span>
                )}
              </div>
            ))}
          </div>

          <p className="text-sm text-cacao/70">
            Así se va a ver. Lo que sobresalga de este marco se recorta por
            arriba y por abajo — si algo importante queda fuera, recorta la foto
            antes de subirla.
          </p>
        </>
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
