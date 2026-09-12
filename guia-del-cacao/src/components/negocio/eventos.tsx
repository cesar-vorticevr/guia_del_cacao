"use client";

import Link from "next/link";
import { useState } from "react";
import { cambiarEstadoEvento } from "@/lib/negocio/acciones";
import type { PublicacionPropia } from "@/lib/datos/sucursales";

/** Clases del botón secundario, las mismas que en el panel de sucursales. */
const SECUNDARIO =
  "min-h-11 rounded-full border-2 border-selva/25 bg-white px-5 py-2.5 text-sm font-bold text-selva-2 transition-transform active:translate-y-0.5";

/**
 * En qué estado está un evento.
 *
 * Solo uno se guarda —cancelado—; los otros dos se deducen de la fecha. Guardar
 * "activo" o "pasado" sería tener dos versiones de la misma verdad: una que se
 * actualiza sola y otra que habría que ir a corregir todas las noches.
 */
export function estadoDeEvento(evento: PublicacionPropia) {
  if (evento.canceladoEn) {
    return { clave: "cancelado", texto: "Cancelado", tono: "bg-guayaba text-ink" };
  }
  if (evento.paso) {
    return { clave: "pasado", texto: "Ya pasó", tono: "bg-crema-2 text-cacao" };
  }
  return { clave: "activo", texto: "Activo", tono: "bg-lima/40 text-selva-2" };
}

/**
 * Un evento en el panel, con la misma forma que una sucursal: nombre arriba,
 * estado a la derecha y la fila de botones al pie.
 *
 * Un evento cancelado se tacha en diagonal sobre su foto y lleva su letrero. No
 * se esconde: quien ya apartó la fecha tiene que ver que se cayó, y un evento
 * que desaparece sin decir nada deja gente presentándose en la puerta.
 */
export function TarjetaEvento({
  evento,
  fechaTexto,
  foto,
  slug,
  editable = true,
}: {
  evento: PublicacionPropia;
  fechaTexto: string;
  foto: string | null;
  /** Para "ver publicado", si su sucursal está en el directorio. */
  slug: string | null;
  /**
   * Si el plan de la marca deja tocarlo.
   *
   * Sin plan la base rechaza cualquier cambio, así que los botones que
   * llevarían a chocar contra ella no se pintan: ofrecer «Editar» para que
   * al guardar salte un error es peor que no ofrecerlo.
   */
  editable?: boolean;
}) {
  const estado = estadoDeEvento(evento);
  const cancelado = estado.clave === "cancelado";

  return (
    /*
      La misma tarjeta vertical que la agenda pública y el explorador: foto en
      4:3 arriba, lo demás debajo. Era un renglón con una miniatura de 80 px, y a
      ese tamaño el cartel de una cata no se lee — que es justo lo que el negocio
      necesita comprobar antes de que lo vea su público.
    */
    <li className="flex h-full flex-col overflow-hidden rounded-3xl border-2 border-ink/10 bg-white shadow-dura">
      {/*
        La foto va absoluta dentro de la caja, no en el flujo: con `h-full` en el
        flujo una foto alta estira su caja y las tarjetas de la fila dejan de
        alinearse.
      */}
      <span className="relative block aspect-[4/3] w-full shrink-0 overflow-hidden bg-crema-2">
        {foto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={foto}
            alt=""
            loading="lazy"
            className={`absolute inset-0 size-full object-cover ${cancelado ? "grayscale" : ""}`}
          />
        ) : (
          <span
            aria-hidden="true"
            className="absolute inset-0 grid place-items-center font-display text-5xl text-selva/30"
          >
            {evento.titulo.charAt(0)}
          </span>
        )}

        {/*
          La raya va en un SVG de esquina a esquina y no con un `rotate` de
          CSS: girado, un div se sale de la caja o queda corto según la
          proporción, y la marca tiene que cruzar la foto entera siempre.
        */}
        {cancelado && (
          <svg
            aria-hidden="true"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 size-full"
          >
            <line
              x1="0"
              y1="100"
              x2="100"
              y2="0"
              stroke="#ff5d73"
              strokeWidth="6"
            />
          </svg>
        )}

        {/* El estado va sobre la foto: es lo primero que hay que saber de un
            evento propio —si está al aire, si se canceló, si ya pasó— y en una
            retícula se busca en la esquina, no en el texto. */}
        <span
          className={`absolute right-2 top-2 rounded-full px-3 py-1 font-mono text-xs font-bold ${estado.tono}`}
        >
          {estado.texto}
        </span>
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5 p-4">
        <p className="font-mono text-xs tracking-wide text-cacao/70 uppercase">
          {fechaTexto}
        </p>

        <p className="font-display text-base leading-tight font-semibold text-selva-2">
          {evento.titulo}
        </p>

        {evento.sucursal && (
          <p className="text-sm text-cacao">{evento.sucursal}</p>
        )}
      </div>

      <div className="flex flex-wrap gap-2 border-t-2 border-ink/5 px-4 py-2.5">
        {editable && (
          <Link href={`/eventos/${evento.id}/editar`} className={SECUNDARIO}>
            Editar
          </Link>
        )}

        {/*
          "Ver publicado" también depende del plan: sin él la página del evento
          solo la ve su dueño, así que el botón prometía enseñar algo que el
          público no tiene delante.
        */}
        {editable && slug && !cancelado && (
          <Link href={`/eventos/${evento.id}`} className={SECUNDARIO}>
            Ver publicado
          </Link>
        )}

        {/*
          Cancelar solo tiene sentido mientras el evento no haya pasado: cancelar
          algo que ya ocurrió no avisa a nadie de nada.
        */}
        {editable && !evento.paso && (
          <form action={cambiarEstadoEvento}>
            <input type="hidden" name="evento_id" value={evento.id} />
            <input type="hidden" name="cancelar" value={cancelado ? "no" : "si"} />
            <button
              type="submit"
              className={
                cancelado
                  ? "min-h-11 rounded-full bg-selva px-5 py-2.5 text-sm font-bold text-crema"
                  : "min-h-11 rounded-full border-2 border-guayaba/40 bg-white px-5 py-2.5 text-sm font-bold text-cacao"
              }
            >
              {cancelado ? "Reactivar" : "Cancelar evento"}
            </button>
          </form>
        )}
      </div>
    </li>
  );
}

/**
 * El formulario de alta, plegado tras un botón.
 *
 * Antes vivía abierto al final de la lista: quien entraba a mirar sus eventos
 * se encontraba con un formulario en blanco que no había pedido, y en celular
 * ocupaba más pantalla que los eventos mismos.
 */
export function NuevoEvento({ children }: { children: React.ReactNode }) {
  const [abierto, setAbierto] = useState(false);

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="min-h-12 w-fit rounded-full bg-selva px-6 font-bold text-crema shadow-dura-sm transition-transform active:translate-y-0.5"
      >
        Nuevo evento
      </button>
    );
  }

  return (
    <section className="grid gap-4 rounded-3xl bg-crema-2 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl">Nuevo evento</h2>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="min-h-10 rounded-full px-4 text-sm font-bold text-cacao underline"
        >
          Cerrar
        </button>
      </div>

      {children}
    </section>
  );
}
