"use client";

import Link from "next/link";
import { useState } from "react";
import { PortadaPublicacion } from "@/components/publico/portada-publicacion";
import { VerMas } from "@/components/publico/ver-mas";
import type { Entrada, Filtro } from "@/lib/datos/comunidad";

/**
 * El muro de la comunidad.
 *
 * Se filtraba por tipo —temas, eventos, noticias— porque había tres tablas
 * detrás. Ahora todo es una publicación, así que los filtros son por lo que le
 * toca a quien mira: todo, lo suyo, y lo que le respondieron sin que lo haya
 * leído. Filtran en el momento, sin recargar: ya vienen cargadas.
 */
const FILTROS: { valor: Filtro; texto: string }[] = [
  { valor: "todo", texto: "Todo" },
  { valor: "mias", texto: "Mis publicaciones" },
  { valor: "nuevos", texto: "Comentarios nuevos" },
];

function cuenta(entradas: Entrada[], filtro: Filtro) {
  if (filtro === "mias") return entradas.filter((e) => e.mia).length;
  if (filtro === "nuevos") return entradas.filter((e) => e.sinVer > 0).length;
  return entradas.length;
}

export function MuroComunidad({
  entradas,
  /** Sin sesión no se pintan «mis publicaciones» ni «comentarios nuevos». */
  haySesion,
}: {
  entradas: Entrada[];
  haySesion: boolean;
}) {
  const [filtro, setFiltro] = useState<Filtro>("todo");

  const visibles =
    filtro === "mias"
      ? entradas.filter((e) => e.mia)
      : filtro === "nuevos"
        ? entradas.filter((e) => e.sinVer > 0)
        : entradas;

  const opciones = haySesion ? FILTROS : FILTROS.slice(0, 1);

  return (
    <>
      <nav aria-label="Filtrar el muro" className="pt-5">
        <ul className="flex flex-wrap gap-2.5">
          {opciones.map((opcion) => {
            const activa = filtro === opcion.valor;
            const cuantas = cuenta(entradas, opcion.valor);

            return (
              <li key={opcion.valor}>
                <button
                  type="button"
                  onClick={() => setFiltro(opcion.valor)}
                  aria-pressed={activa}
                  className={`inline-flex min-h-11 items-center gap-2 rounded-full px-4 font-bold transition-colors ${
                    activa
                      ? "bg-selva text-crema"
                      : "border-2 border-selva/25 bg-white text-selva-2 hover:border-selva"
                  }`}
                >
                  {opcion.texto}

                  {/*
                    El conteo de «comentarios nuevos» va en guayaba y no en gris:
                    es lo único de esta fila que reclama algo de quien mira, y en
                    gris se leía como un número más.
                  */}
                  <span
                    className={`rounded-full px-2 py-0.5 font-mono text-xs ${
                      opcion.valor === "nuevos" && cuantas > 0
                        ? "bg-guayaba font-bold text-ink"
                        : activa
                          ? "bg-crema/25"
                          : "bg-ink/5 text-cacao/70"
                    }`}
                  >
                    {cuantas}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {visibles.length === 0 ? (
        <p className="mt-5 rounded-3xl bg-crema-2 p-6 text-cacao">
          {filtro === "mias"
            ? "Todavía no has publicado nada."
            : filtro === "nuevos"
              ? "Nadie te ha respondido desde la última vez que miraste."
              : "Todavía no hay nada publicado."}
        </p>
      ) : (
        <VerMas
          className="mt-5 grid gap-5 sm:grid-cols-2"
          etiqueta="Ver más publicaciones"
          paso={8}
        >
          {visibles.map((entrada) => (
            <li key={entrada.id}>
              {/*
                La foto va arriba y del ancho de la tarjeta. Sin ella el muro
                era una lista de párrafos donde ninguna publicación se
                distinguía de la siguiente hasta leerla.
              */}
              <Link
                href={entrada.href}
                className="group grid h-full content-start overflow-hidden rounded-3xl bg-crema-2 transition-transform active:translate-y-0.5"
              >
                <PortadaPublicacion
                  id={entrada.id}
                  foto={entrada.imagen}
                  titulo={entrada.titulo}
                  className="h-44 w-full"
                />

                <div className="p-5">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <p className="font-mono text-xs tracking-wide text-cacao/70 uppercase">
                      {entrada.fechaTexto}
                    </p>

                    {entrada.oculta && (
                      <span className="rounded-full bg-ink/10 px-2 py-0.5 font-mono text-xs font-bold text-cacao">
                        Oculta
                      </span>
                    )}
                  </div>

                  <p className="mt-1 font-display text-xl font-semibold text-selva-2 underline-offset-4 group-hover:underline">
                    {entrada.titulo}
                  </p>

                  <p className="mt-1 text-cacao">
                    {entrada.autor}
                    {entrada.detalle && (
                      <span className="text-cacao/70">
                        {" "}
                        · {entrada.detalle}
                      </span>
                    )}
                  </p>

                  <p className="mt-2 line-clamp-2 text-cacao">
                    {entrada.resumen}
                  </p>

                  <p className="mt-3 flex flex-wrap items-center gap-3 font-mono text-xs text-cacao/70">
                    <span className="inline-flex items-center gap-1.5">
                      {entrada.comentarios}{" "}
                      {entrada.comentarios === 1 ? "comentario" : "comentarios"}
                      {/*
                      El punto solo aparece cuando hay respuestas que esa persona
                      no ha visto. Si estuviera siempre que hay comentarios, dejaría
                      de significar "hay algo nuevo" y sería parte del dibujo.
                    */}
                      {entrada.sinVer > 0 && (
                        <span
                          className="grid size-5 place-items-center rounded-full bg-guayaba font-bold text-ink"
                          aria-label={`${entrada.sinVer} sin leer`}
                        >
                          {entrada.sinVer}
                        </span>
                      )}
                    </span>

                    {entrada.apoyos > 0 && (
                      <span>
                        {entrada.apoyos}{" "}
                        {entrada.apoyos === 1 ? "mazorca" : "mazorcas"}
                      </span>
                    )}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </VerMas>
      )}
    </>
  );
}
