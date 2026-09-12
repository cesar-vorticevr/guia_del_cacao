import Link from "next/link";
import { PortadaPublicacion } from "@/components/publico/portada-publicacion";
import { MeGusta } from "@/components/publico/me-gusta";
import type { Entrada } from "@/lib/datos/comunidad";

/**
 * Una publicación de la comunidad en una retícula.
 *
 * La misma que el explorador y el catálogo: foto arriba, quién escribe y de qué
 * trata debajo, y al pie el corazón, los comentarios y cuánto lleva.
 *
 * Vive en su componente porque se pinta en dos sitios —el muro de `/comunidad` y
 * la portada— y la copia de la portada se habría quedado atrás en el primer
 * ajuste. Es de servidor: no tiene estado propio, y el único trozo interactivo
 * —el corazón— ya es de cliente por su cuenta.
 */
export function TarjetaEntrada({
  entrada,
  haySesion,
}: {
  entrada: Entrada;
  haySesion: boolean;
}) {
  return (
    <li className="group flex h-full flex-col overflow-hidden rounded-3xl border-2 border-ink/10 bg-white shadow-dura transition-all hover:-translate-y-0.5 hover:shadow-dura-alta">
      <Link href={entrada.href} className="flex flex-1 flex-col">
        {/*
          La foto en 4:3 y fuera del flujo, como en el directorio y el catálogo:
          con `h-full` en el flujo, una foto alta estira su caja y las tarjetas
          de la fila dejan de alinearse.
        */}
        <span className="relative block aspect-[4/3] w-full shrink-0 overflow-hidden bg-crema-2">
          <PortadaPublicacion
            id={entrada.id}
            foto={entrada.imagen}
            titulo={entrada.titulo}
            className="absolute inset-0 size-full"
          />
        </span>

        <div className="flex flex-1 flex-col gap-1 p-4">
          {/*
            Quién escribe va primero: en una retícula de cuatro, lo que hace
            abrir una publicación es de quién es y de qué trata, en ese orden.
          */}
          <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
            <span className="font-bold text-selva-2">{entrada.autor}</span>

            {entrada.detalle && (
              <span className="w-full text-cacao/70">{entrada.detalle}</span>
            )}

            {entrada.oculta && (
              <span className="rounded-full bg-ink/10 px-2 py-0.5 font-mono text-[0.7rem] font-bold text-cacao">
                Oculta
              </span>
            )}
          </p>

          <p className="font-display text-base leading-tight font-semibold text-selva-2 underline-offset-4 group-hover:underline">
            {entrada.titulo}
          </p>

          <p className="mt-auto line-clamp-3 pt-1 text-sm text-cacao">
            {entrada.resumen}
          </p>
        </div>
      </Link>

      {/*
        El corazón va fuera del enlace —un `button` dentro de un `a` es HTML
        inválido— pero dentro de la misma caja, en su franja al pie.
      */}
      <div className="flex items-center gap-3 border-t-2 border-ink/5 px-4 py-2.5">
        <MeGusta
          clase="publicacion"
          id={entrada.id}
          inicial={entrada.miApoyo}
          cuantos={entrada.apoyos}
          comentarios={entrada.comentarios}
          haySesion={haySesion}
        />

        {/*
          El punto solo aparece cuando hay respuestas que esa persona no ha
          visto. Si estuviera siempre que hay comentarios, dejaría de significar
          "hay algo nuevo" y sería parte del dibujo.
        */}
        {entrada.sinVer > 0 && (
          <span
            className="grid size-5 shrink-0 place-items-center rounded-full bg-guayaba font-mono text-xs font-bold text-ink"
            aria-label={`${entrada.sinVer} sin leer`}
          >
            {entrada.sinVer}
          </span>
        )}

        {/*
          Cuánto lleva, pegado a la derecha con `ml-auto`. Estaba al lado del
          autor y ahí se leía como parte del título; aquí es lo que es: un dato
          de la esquina, junto a los otros dos números.

          La fecha completa va en el `title`, para quien quiera el dato exacto
          sin que ocupe sitio.
        */}
        <span
          title={entrada.fechaTexto}
          className="ml-auto shrink-0 font-mono text-xs text-cacao/60"
        >
          {entrada.hace}
        </span>
      </div>
    </li>
  );
}
