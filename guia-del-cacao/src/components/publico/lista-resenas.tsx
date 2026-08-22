"use client";

import { useState } from "react";
import { Estrella, Estrellas } from "@/components/publico/estrellas";
import { FormularioRespuesta } from "@/components/publico/resenas";
import { Medio } from "@/components/publico/medio";

export type ResenaEnLista = {
  id: string;
  nombre: string;
  texto: string;
  /** Ya formateada en el servidor, para que no baile entre servidor y navegador. */
  fechaTexto: string;
  /** Foto o video que subió con su reseña, ya como URL. */
  medioUrl: string | null;
  /** Si la cambió después de escribirla. */
  editada: boolean;
  /** Las estrellas que esa persona le dio al negocio, si votó. */
  estrellas: number | null;
  respuesta: string | null;
};

const FILTROS = [5, 4, 3, 2, 1] as const;

/**
 * Todas las reseñas de un micrositio, con su fecha y su calificación.
 *
 * Tres decisiones:
 *
 * 1. **Se ven todas, dentro de un marco con scroll propio.** Antes la lista
 *    crecía sin fin y empujaba el formulario y el contacto fuera de la
 *    pantalla; ahora el micrositio conserva su forma tenga tres reseñas o
 *    trescientas.
 * 2. **Cada reseña trae las estrellas de quien la escribió.** Son dos tablas
 *    distintas —el comentario y el voto—, pero para quien lee es una sola
 *    cosa: qué opinó esta persona.
 * 3. **El filtro cuenta cuántas hay de cada nota**, y esconde las opciones
 *    vacías: un "2 estrellas (0)" solo estorba.
 */
export function ListaResenas({
  resenas,
  esDuenio,
  slug,
}: {
  resenas: ResenaEnLista[];
  esDuenio: boolean;
  slug: string;
}) {
  const [filtro, setFiltro] = useState<number | null>(null);

  const cuantas = (estrellas: number) =>
    resenas.filter((r) => r.estrellas === estrellas).length;

  const visibles = filtro === null ? resenas : resenas.filter((r) => r.estrellas === filtro);

  const conNota = FILTROS.filter((n) => cuantas(n) > 0);

  return (
    <div className="mt-4 grid gap-4">
      {conNota.length > 0 && (
        <div>
          <p className="mb-2 font-bold text-selva-2">Filtrar por calificación</p>

          <ul className="flex flex-wrap gap-2">
            <li>
              <button
                type="button"
                onClick={() => setFiltro(null)}
                aria-pressed={filtro === null}
                className={`min-h-11 rounded-full border-2 px-4 text-sm font-bold transition-colors ${
                  filtro === null
                    ? "border-selva bg-selva text-crema"
                    : "border-ink/10 bg-white text-selva-2"
                }`}
              >
                Todas ({resenas.length})
              </button>
            </li>

            {conNota.map((n) => (
              <li key={n}>
                <button
                  type="button"
                  onClick={() => setFiltro(filtro === n ? null : n)}
                  aria-pressed={filtro === n}
                  className={`flex min-h-11 items-center gap-1.5 rounded-full border-2 px-4 text-sm font-bold transition-colors ${
                    filtro === n
                      ? "border-selva bg-selva text-crema"
                      : "border-ink/10 bg-white text-selva-2"
                  }`}
                >
                  <span>{n}</span>
                  {/* Una sola estrella, no las cinco: el número ya dice
                      cuántas, y cinco iconos a medio pintar en una pildora
                      de filtro se leen como otra calificación. */}
                  <Estrella className="size-4 text-mango" />
                  <span className="font-mono">({cuantas(n)})</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {visibles.length === 0 ? (
        <p className="rounded-3xl bg-crema-2 p-5 text-cacao">
          Ninguna reseña con esa calificación todavía.
        </p>
      ) : (
        <ul
          // El marco solo se vuelve scrollable cuando hay de sobra; con dos
          // reseñas, una caja alta a medio llenar se ve rota.
          className={
            visibles.length > 3
              ? "grid max-h-[32rem] gap-4 overflow-y-auto pr-1"
              : "grid gap-4"
          }
        >
          {visibles.map((resena) => (
            <li key={resena.id} className="rounded-3xl bg-white p-5 shadow-dura">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-bold text-selva-2">{resena.nombre}</p>
                <p className="font-mono text-xs text-cacao/70">{resena.fechaTexto}{resena.editada && " · editada"}</p>
              </div>

              {resena.estrellas !== null && (
                <p className="mt-1 flex items-center gap-2">
                  <Estrellas valor={resena.estrellas} />
                  <span className="font-mono text-sm font-bold text-cacao">
                    {resena.estrellas}/5
                  </span>
                </p>
              )}

              <p className="mt-1.5 whitespace-pre-line text-cacao">{resena.texto}</p>

              <Medio
                ruta={resena.medioUrl}
                alt={`Lo que subió ${resena.nombre} con su reseña`}
              />

              {resena.respuesta ? (
                <p className="mt-3 rounded-2xl bg-crema-2 p-4 text-cacao">
                  <span className="block font-bold text-selva-2">
                    Respuesta del negocio
                  </span>
                  {resena.respuesta}
                </p>
              ) : (
                esDuenio && <FormularioRespuesta resenaId={resena.id} slug={slug} />
              )}
            </li>
          ))}
        </ul>
      )}

      {visibles.length > 3 && (
        <p className="text-sm text-cacao/70">
          {visibles.length} reseñas. Desliza dentro del recuadro para verlas
          todas.
        </p>
      )}
    </div>
  );
}
