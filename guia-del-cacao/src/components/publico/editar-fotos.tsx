"use client";

import { useState } from "react";
import { PROPORCION_MINIMA } from "@/lib/limites";
import { ponerEnCampo } from "@/lib/recorte";
import { useAcomodo } from "@/components/publico/ajustar-foto";

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
 *
 * Las que se suman pasan por el encuadre antes de subirse, igual que al
 * publicar: van al mismo carrusel que las otras, así que se recortan con la
 * misma proporción.
 */
export function EditarFotos({
  actuales,
  urlDe,
  tope = 4,
  obligatoria = true,
  proporcion = PROPORCION_MINIMA,
}: {
  /** Las rutas guardadas, tal como están en la base. */
  actuales: string[];
  /** Cómo se convierte una ruta en algo que el navegador pueda pintar. */
  urlDe: Record<string, string>;
  tope?: number;
  /** Si hace falta al menos una. En un evento la foto es opcional. */
  obligatoria?: boolean;
  /** La forma con la que se van a ver. La misma con la que se recortan. */
  proporcion?: number;
}) {
  const [conservadas, setConservadas] = useState(actuales);

  /*
    En piezas, no como `acomodo.algo`: al pasar una de ellas a `ref`, el lint de
    React da por contagiado el objeto entero y se queja de todo lo demás que se
    lea al pintar.
  */
  const { campo, archivos, previos, empezar, quitar, acomodarUna, encuadre } =
    useAcomodo(proporcion);

  const hueco = Math.max(0, tope - conservadas.length);

  function alElegir(evento: React.ChangeEvent<HTMLInputElement>) {
    const campo = evento.target;
    const elegidos = [...(campo.files ?? [])].slice(0, hueco);

    /*
      Si el navegador trajo más de las que caben, el campo se rellena con las
      que sí. Antes las de más se descartaban solo de la vista previa y viajaban
      igual en el envío: se veían tres y se guardaban cinco.
    */
    if (elegidos.length !== campo.files?.length) {
      ponerEnCampo(campo, elegidos);
    }

    empezar(elegidos);
  }

  return (
    <div className="grid gap-3">
      <span className="font-bold text-selva-2">
        Fotos{" "}
        <span className="font-normal text-cacao">
          · {conservadas.length + archivos.length} de {tope}
        </span>
      </span>

      {encuadre}

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
      {obligatoria &&
        conservadas.length === 0 &&
        archivos.length === 0 && (
          <p className="rounded-2xl border-2 border-mango/50 bg-mango/15 px-4 py-3 text-cacao">
            Te quedaste sin fotos. Sube al menos una antes de guardar.
          </p>
        )}

      {hueco > 0 ? (
        <>
          <input
            ref={campo}
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

      {previos.length > 0 && (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {previos.map((previo, i) => (
            <li key={previo.url} className="relative">
              {/*
                La miniatura de lo nuevo sale con la proporción con la que se
                recortó, y no cuadrada como las guardadas: enseñar en cuadrado
                algo que se acaba de encuadrar en 4:5 desmentiría el encuadre
                justo después de hacerlo.
              */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previo.url}
                alt={`Foto nueva ${i + 1}`}
                style={{ aspectRatio: `${proporcion}`, objectFit: "cover" }}
                className="w-full rounded-xl border-2 border-dashed border-selva/40"
              />

              <button
                type="button"
                onClick={() => acomodarUna(i)}
                className="absolute right-1 bottom-1 min-h-11 rounded-full bg-ink/70 px-3 text-sm font-bold text-crema"
              >
                Acomodar
              </button>

              {/*
                La × también en las nuevas, no solo en las guardadas. Arriba se
                podía quitar una foto que ya estaba y abajo no se podía quitar
                la que se acababa de elegir: había que vaciar el campo entero y
                volver a escogerlas todas.
              */}
              <button
                type="button"
                onClick={() => quitar(i)}
                aria-label={`Quitar la foto nueva ${i + 1}`}
                className="absolute -top-2 -right-2 grid size-8 place-items-center rounded-full border-2 border-guayaba bg-white text-lg font-bold text-cacao shadow-dura-sm"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
