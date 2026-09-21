"use client";

import { useActionState, useState } from "react";
import { Aviso, BotonEnviar } from "@/components/formulario";
import {
  importarCatalogo,
  type EstadoImportacion,
} from "@/lib/negocio/catalogo";
import { TOPE_DE_FILAS } from "@/lib/negocio/columnas-catalogo";

const INICIAL: EstadoImportacion = {};

/**
 * Cargar el catálogo de golpe desde una hoja de Excel.
 *
 * Son dos gestos, y en este orden: **bajar el formato** y **subirlo lleno**. El
 * formato importa tanto como la carga — un negocio con cien productos los tiene
 * en una hoja suya, con sus columnas y sus nombres, y pedirle que adivine cuáles
 * esperamos acaba en cinco intentos fallidos. Bajando el formato, la hoja que
 * devuelve ya trae los encabezados que sabemos leer.
 *
 * Va plegado. Es la vía rápida para quien empieza de cero o suma una temporada
 * entera, no lo que se hace cada semana, y abierto empujaba la lista del
 * catálogo —que es a lo que casi siempre se entra— fuera de la pantalla.
 */
export function ImportarCatalogo() {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion] = useActionState(importarCatalogo, INICIAL);

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="min-h-12 w-full rounded-2xl border-2 border-dashed border-selva/30 bg-white px-5 text-sm font-bold text-selva-2 transition-colors hover:border-selva hover:bg-crema-2/40"
      >
        Cargar varios de golpe desde Excel
      </button>
    );
  }

  return (
    <section className="grid gap-4 rounded-2xl border-2 border-ink/10 bg-white p-5 shadow-dura-sm">
      <div>
        <h2 className="font-display text-lg text-selva-2">
          Cargar varios de golpe
        </h2>
        <p className="mt-1 text-sm text-cacao">
          Baja el formato, llénalo con un producto por renglón y súbelo. Caben
          hasta {TOPE_DE_FILAS} productos por archivo.
        </p>
      </div>

      {/*
        Un `<a download>` de toda la vida, no un `<Link>`: `next/link` navega
        del lado del cliente, y esta dirección no devuelve una página sino un
        archivo con su cabecera de descarga. Con `Link`, el navegador se queda
        esperando una pantalla que nunca llega.

        El atributo `download` es el que lo declara, y de paso es lo que hace
        que el linter no lo confunda con un enlace de navegación. Así, además,
        funciona igual con el clic derecho y «guardar enlace como».
      */}
      <a
        href="/negocio/panel/catalogo/formato"
        download
        className="flex min-h-12 items-center justify-center gap-2 rounded-full border-2 border-selva/25 bg-white px-5 text-sm font-bold text-selva-2 shadow-dura-sm transition-transform active:translate-y-0.5"
      >
        {/* Decorativa: el texto de al lado ya dice qué hace. */}
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="size-4 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 3v12" />
          <path d="m7 11 5 5 5-5" />
          <path d="M4 20h16" />
        </svg>
        1. Bajar el formato en Excel
      </a>

      <form action={accion} className="grid gap-3">
        <Resultado estado={estado} />

        <label className="block">
          <span className="mb-1.5 block font-bold text-selva-2">
            2. Subir el formato lleno
          </span>
          <input
            type="file"
            name="archivo"
            accept=".xlsx"
            required
            className="w-full rounded-2xl border-2 border-dashed border-selva/25 bg-white px-4 py-3 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-selva file:px-4 file:py-2 file:font-bold file:text-crema"
          />
          <span className="mt-1.5 block text-sm text-cacao/80">
            Tiene que ser .xlsx. Las fotos no van en la hoja: se suben después,
            una por producto.
          </span>
        </label>

        <BotonEnviar>Agregar al catálogo</BotonEnviar>

        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="min-h-11 rounded-full px-4 text-sm font-bold text-cacao underline"
        >
          Cerrar
        </button>
      </form>
    </section>
  );
}

/**
 * Lo que pasó con el archivo.
 *
 * Los renglones con problema van **con su número de fila**, que es lo único que
 * sirve: quien tiene la hoja abierta en otra ventana va a esa fila y lo
 * corrige. Un "revisa los precios" sin número obliga a repasar doscientos.
 */
function Resultado({ estado }: { estado: EstadoImportacion }) {
  const { error, ok, problemas, repetidos } = estado;

  if (!error && !ok) return null;

  return (
    <div className="grid gap-2">
      {error && <Aviso>{error}</Aviso>}

      {ok && (
        <p
          role="status"
          className="rounded-2xl border-2 border-lima/50 bg-lima/15 px-4 py-3 font-bold text-selva-2"
        >
          {ok}
        </p>
      )}

      {problemas && problemas.length > 0 && (
        <ul className="grid gap-1 rounded-2xl bg-crema-2 p-4 text-sm text-cacao">
          {problemas.map((problema) => (
            <li key={problema.fila}>
              <span className="font-mono font-bold text-selva-2">
                Fila {problema.fila}
              </span>{" "}
              — {problema.motivo}
            </li>
          ))}
        </ul>
      )}

      {repetidos && repetidos.length > 0 && (
        <div className="rounded-2xl bg-crema-2 p-4 text-sm text-cacao">
          <p className="font-bold text-selva-2">
            Estos ya estaban en tu catálogo y no se volvieron a agregar:
          </p>
          <p className="mt-1">{repetidos.join(" · ")}</p>
          <p className="mt-2 text-cacao/80">
            Para cambiarle el precio o la descripción a uno que ya existe, ábrelo
            en la lista de abajo y edítalo.
          </p>
        </div>
      )}
    </div>
  );
}
