"use client";

import { useState } from "react";

/**
 * Las fotos al editar: las que ya están, las que se quitan y las que se suman.
 *
 * Antes editar solo dejaba **reemplazarlas todas**: mandar una foto nueva
 * borraba las tres anteriores, y no había forma de quitar una sola. Quien subía
 * cuatro y quería tirar la borrosa tenía que volver a subir las otras tres.
 *
 * Las que se conservan viajan en campos ocultos, una por ruta. Así el servidor
 * recibe la lista final tal cual, sin tener que adivinar qué se quitó
 * comparando con lo que había.
 */
export function EditarFotos({
  actuales,
  urlDe,
  tope = 4,
  obligatoria = true,
}: {
  /** Las rutas guardadas, tal como están en la base. */
  actuales: string[];
  /** Cómo se convierte una ruta en algo que el navegador pueda pintar. */
  urlDe: Record<string, string>;
  tope?: number;
  /** Si hace falta al menos una. En un evento la foto es opcional. */
  obligatoria?: boolean;
}) {
  const [conservadas, setConservadas] = useState(actuales);
  const [nuevas, setNuevas] = useState<string[]>([]);

  const hueco = Math.max(0, tope - conservadas.length);

  function alElegir(evento: React.ChangeEvent<HTMLInputElement>) {
    const archivos = [...(evento.target.files ?? [])].slice(0, hueco);

    nuevas.forEach((url) => URL.revokeObjectURL(url));
    setNuevas(archivos.map((a) => URL.createObjectURL(a)));
  }

  return (
    <div className="grid gap-3">
      <span className="font-bold text-selva-2">
        Fotos{" "}
        <span className="font-normal text-cacao">
          · {conservadas.length + nuevas.length} de {tope}
        </span>
      </span>

      {conservadas.length > 0 && (
        <ul className="grid grid-cols-4 gap-2">
          {conservadas.map((ruta, i) => (
            <li key={ruta} className="relative">
              <input type="hidden" name="conservar" value={ruta} />

              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={urlDe[ruta]}
                alt={`Foto ${i + 1}`}
                className="aspect-square w-full rounded-xl border-2 border-selva/15 object-cover"
              />

              <button
                type="button"
                onClick={() =>
                  setConservadas((antes) => antes.filter((r) => r !== ruta))
                }
                aria-label={`Quitar la foto ${i + 1}`}
                className="absolute -top-2 -right-2 grid size-7 place-items-center rounded-full border-2 border-guayaba bg-white font-bold text-cacao"
              >
                ×
              </button>

              {i === 0 && (
                <span className="absolute bottom-1 left-1 rounded-full bg-selva px-2 py-0.5 font-mono text-[0.6rem] font-bold text-crema">
                  Portada
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {/*
        El aviso solo donde la foto es obligatoria. En un evento se puede
        publicar sin ninguna, así que ahí sería un reproche por algo que está
        permitido.
      */}
      {obligatoria && conservadas.length === 0 && nuevas.length === 0 && (
        <p className="rounded-2xl border-2 border-mango/50 bg-mango/15 px-4 py-3 text-cacao">
          Te quedaste sin fotos. Sube al menos una antes de guardar.
        </p>
      )}

      {hueco > 0 ? (
        <>
          <input
            type="file"
            name="imagenes"
            accept="image/jpeg,image/png,image/webp,image/avif"
            multiple
            onChange={alElegir}
            className="min-w-0 rounded-2xl border-2 border-dashed border-selva/25 bg-white px-3 py-3 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-selva file:px-4 file:py-2 file:font-bold file:text-crema"
          />

          <p className="text-sm text-cacao/70">
            Puedes sumar {hueco} {hueco === 1 ? "más" : "más"}. Máximo 5 MB cada
            una.
          </p>
        </>
      ) : (
        <p className="text-sm text-cacao/70">
          Ya tienes las {tope}. Quita alguna para poder sumar otra.
        </p>
      )}

      {nuevas.length > 0 && (
        <ul className="grid grid-cols-4 gap-2">
          {nuevas.map((url, i) => (
            <li key={url}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`Foto nueva ${i + 1}`}
                className="aspect-square w-full rounded-xl border-2 border-dashed border-selva/40 object-cover"
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
