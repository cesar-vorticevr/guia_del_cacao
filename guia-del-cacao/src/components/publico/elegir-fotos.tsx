"use client";

import { useRef, useState } from "react";

/**
 * Elegir hasta cuatro fotos, con lo que se ve antes de mandarlas.
 *
 * Enseña las miniaturas porque una publicación se elige por su portada: mandar
 * cuatro archivos a ciegas y descubrir en el muro cuál quedó primera es el tipo
 * de sorpresa que hace que nadie vuelva a subir fotos.
 *
 * Es un solo `<input multiple>` y no cuatro casillas: en celular, cuatro
 * botones de archivo son cuatro viajes a la galería.
 */
export function ElegirFotos({ tope = 4 }: { tope?: number }) {
  const [previos, setPrevios] = useState<string[]>([]);
  const [demasiadas, setDemasiadas] = useState(false);
  const campo = useRef<HTMLInputElement>(null);

  function alElegir(evento: React.ChangeEvent<HTMLInputElement>) {
    const archivos = [...(evento.target.files ?? [])];

    setDemasiadas(archivos.length > tope);

    // Se liberan las anteriores: cada `createObjectURL` reserva memoria hasta
    // que se revoca, y aquí se cambian de foto varias veces seguidas.
    previos.forEach((url) => URL.revokeObjectURL(url));
    setPrevios(archivos.slice(0, tope).map((a) => URL.createObjectURL(a)));
  }

  return (
    <div className="grid gap-2">
      <span className="font-bold text-selva-2">
        Fotos <span className="font-normal text-cacao">· de 1 a {tope}</span>
      </span>

      <input
        ref={campo}
        type="file"
        name="imagenes"
        accept="image/jpeg,image/png,image/webp,image/avif"
        multiple
        required
        onChange={alElegir}
        className="min-w-0 rounded-2xl border-2 border-dashed border-selva/25 bg-white px-3 py-3 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-selva file:px-4 file:py-2 file:font-bold file:text-crema"
      />

      {demasiadas && (
        <p role="status" className="text-sm text-cacao">
          Elegiste más de {tope}: se van a subir las primeras {tope}.
        </p>
      )}

      {previos.length > 0 && (
        <ul className="grid grid-cols-4 gap-2">
          {previos.map((url, i) => (
            <li key={url} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`Foto ${i + 1}`}
                className="aspect-square w-full rounded-xl border-2 border-selva/15 object-cover"
              />

              {i === 0 && (
                <span className="absolute bottom-1 left-1 rounded-full bg-selva px-2 py-0.5 font-mono text-[0.6rem] font-bold text-crema">
                  Portada
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="text-sm text-cacao/70">
        La primera es la portada: es la que se ve en el muro. Máximo 5 MB cada
        una.
      </p>
    </div>
  );
}
