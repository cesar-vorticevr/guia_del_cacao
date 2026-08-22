"use client";

import Link from "next/link";
import { useState } from "react";
import { rango } from "@/lib/vocabulario";
import type { Clase, Entrada } from "@/lib/datos/comunidad";

/**
 * El muro de la comunidad: temas, eventos y noticias en una sola lista.
 *
 * El filtro va arriba y filtra en el momento, sin recargar: las tres clases ya
 * vienen cargadas y son pocas decenas. Cada chip trae su conteo, para que
 * elegir "Eventos" no sea saltar a ciegas a una lista vacía.
 */

const CLASES: { valor: Clase; texto: string; tono: string }[] = [
  { valor: "tema", texto: "Temas", tono: "bg-turquesa text-ink" },
  { valor: "evento", texto: "Eventos", tono: "bg-mango text-ink" },
  { valor: "noticia", texto: "Noticias", tono: "bg-lima text-ink" },
];

const ETIQUETA: Record<Clase, { texto: string; tono: string }> = {
  tema: { texto: "Tema", tono: "bg-turquesa/25 text-selva-2" },
  evento: { texto: "Evento", tono: "bg-mango/30 text-cacao" },
  noticia: { texto: "Noticia", tono: "bg-lima/30 text-selva-2" },
};

export function MuroComunidad({ entradas }: { entradas: Entrada[] }) {
  const [filtro, setFiltro] = useState<Clase | null>(null);

  const cuantas = (clase: Clase) => entradas.filter((e) => e.clase === clase).length;
  const visibles = filtro === null ? entradas : entradas.filter((e) => e.clase === filtro);

  return (
    <>
      <nav aria-label="Filtrar el muro" className="pt-5">
        <ul className="flex flex-wrap gap-2.5">
          <li>
            <button
              type="button"
              onClick={() => setFiltro(null)}
              aria-pressed={filtro === null}
              className={`min-h-11 rounded-full border-2 border-ink/10 px-4 text-sm font-bold shadow-dura-sm transition-transform active:translate-y-0.5 ${
                filtro === null ? "bg-selva text-crema" : "bg-crema-2 text-selva-2"
              }`}
            >
              Todo ({entradas.length})
            </button>
          </li>

          {CLASES.map((clase) => (
            <li key={clase.valor}>
              <button
                type="button"
                onClick={() => setFiltro(filtro === clase.valor ? null : clase.valor)}
                aria-pressed={filtro === clase.valor}
                className={`min-h-11 rounded-full border-2 border-ink/10 px-4 text-sm font-bold shadow-dura-sm transition-transform active:translate-y-0.5 ${
                  filtro === clase.valor
                    ? clase.tono
                    : "bg-white text-selva-2"
                }`}
              >
                {clase.texto} ({cuantas(clase.valor)})
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {visibles.length === 0 ? (
        <p className="mt-6 rounded-3xl bg-crema-2 p-6 text-cacao">
          Todavía no hay nada por aquí.
        </p>
      ) : (
        <ul className="mt-6 grid gap-4">
          {visibles.map((entrada) => (
            <li key={`${entrada.clase}-${entrada.id}`}>
              <Link
                href={entrada.href}
                className="flex h-full gap-4 rounded-3xl border-2 border-ink/10 bg-white p-5 shadow-dura transition-all hover:-translate-y-0.5 hover:shadow-dura-alta"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 font-mono text-xs font-bold ${
                        ETIQUETA[entrada.clase].tono
                      }`}
                    >
                      {ETIQUETA[entrada.clase].texto}
                    </span>
                    <span className="font-mono text-xs tracking-wide text-cacao/70 uppercase">
                      {entrada.fechaTexto}
                    </span>
                  </span>

                  <span className="mt-1.5 block font-display text-xl text-selva-2">
                    {entrada.titulo}
                  </span>

                  <span className="mt-0.5 block font-bold text-selva">
                    {entrada.autor}
                    {entrada.detalle && (
                      <span className="font-normal text-cacao/70"> · {entrada.detalle}</span>
                    )}
                  </span>

                  <span className="mt-1.5 line-clamp-2 block text-cacao">
                    {entrada.resumen}
                  </span>

                  <span className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full bg-crema-2 px-3 py-1 font-mono text-xs font-bold text-cacao">
                      {entrada.comentarios}{" "}
                      {entrada.comentarios === 1 ? "comentario" : "comentarios"}
                    </span>

                    {entrada.apoyos !== null && (
                      <span className="rounded-full bg-mango/25 px-3 py-1 font-mono text-xs font-bold text-cacao">
                        {entrada.apoyos} {entrada.apoyos === 1 ? "apoyo" : "apoyos"}
                      </span>
                    )}

                    {entrada.rangoExclusivo && (
                      <span className="rounded-full bg-mango px-3 py-1 font-mono text-xs font-bold text-ink">
                        Solo {rango(entrada.rangoExclusivo).plural}
                      </span>
                    )}
                  </span>
                </span>

                {entrada.imagen && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={entrada.imagen}
                    alt=""
                    className="size-24 shrink-0 rounded-2xl border-2 border-selva/10 object-cover sm:size-28"
                  />
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
