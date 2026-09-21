"use client";

import { useActionState, useState } from "react";
import { Aviso, BotonEnviar } from "@/components/formulario";
import {
  borrarTema,
  crearTema,
  type EstadoForo,
} from "@/lib/foro/acciones";
import { ElegirFotos } from "@/components/publico/elegir-fotos";

const INICIAL: EstadoForo = {};

function Resultado({ estado }: { estado: EstadoForo }) {
  if (estado.error) return <Aviso>{estado.error}</Aviso>;
  if (estado.ok) {
    return (
      <p
        role="status"
        className="rounded-2xl border-2 border-lima/50 bg-lima/15 px-4 py-3 font-bold text-selva-2"
      >
        {estado.ok}
      </p>
    );
  }
  return null;
}

/**
 * Abrir un tema.
 *
 * El formulario está plegado hasta que se pide: en una lista de temas, un
 * cuadro de texto grande abierto compite con lo que la gente vino a leer.
 *
 * Plegado es **un renglón**, no un botón de ancho completo en mango. El botón
 * gritaba "PUBLICAR ALGO" encima del muro y se llevaba la primera pantalla
 * entera para una acción que la mayoría no viene a hacer. El renglón con la
 * inicial y la pregunta ocupa un tercio de eso, se reconoce de cualquier otro
 * sitio donde la gente ya publica, y deja el muro empezando arriba.
 */
export function FormularioTema({
  sucursales = [],
  /** La inicial de quien publica, para el círculo del renglón plegado. */
  inicial = "?",
}: {
  /**
   * Las sucursales con las que un negocio puede firmar.
   *
   * Vacío para una persona, que publica a su nombre. Con una sola no se
   * pregunta: elegir entre una opción no es elegir.
   */
  sucursales?: { id: string; nombre_sucursal: string }[];
  inicial?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion] = useActionState(crearTema, INICIAL);

  if (!abierto) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border-2 border-ink/10 bg-white p-3 shadow-dura-sm">
        <span
          aria-hidden="true"
          className="grid size-10 shrink-0 place-items-center rounded-full border-2 border-ink/10 bg-crema-2 font-display text-lg font-semibold text-selva/60"
        >
          {inicial}
        </span>

        {/*
          Es un botón y no un campo de texto, aunque lo parezca: escribir aquí y
          que al primer carácter salte un formulario distinto pierde lo tecleado
          y desconcierta. Se pulsa, se abre el formulario de verdad, y ahí se
          escribe una sola vez.
        */}
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="min-h-11 flex-1 rounded-full bg-crema-2 px-5 text-left text-cacao/70 transition-colors hover:bg-crema-2/70"
        >
          ¿Qué quieres contar?
        </button>
      </div>
    );
  }

  return (
    <form
      action={accion}
      className="grid gap-3 rounded-2xl border-2 border-ink/10 bg-white p-4 shadow-dura-sm"
    >
      <Resultado estado={estado} />

      {sucursales.length > 0 && (
        <input type="hidden" name="sucursal_id" value={sucursales[0].id} />
      )}

      {sucursales.length > 1 && (
        <label className="block">
          <span className="mb-1.5 block font-bold text-selva-2">
            Publicas como
          </span>
          <select
            name="sucursal_id"
            className="min-h-14 w-full rounded-2xl border-2 border-selva/20 bg-white px-4 text-base text-ink"
          >
            {sucursales.map((sucursal) => (
              <option key={sucursal.id} value={sucursal.id}>
                {sucursal.nombre_sucursal}
              </option>
            ))}
          </select>
        </label>
      )}

      {/*
        Las fotos van primero, y el texto después.

        Es el orden en que se publica en cualquier muro, y el orden en que
        ocurre: se elige la foto y entonces se sabe qué escribir. Al revés
        —título, párrafo y al final "ah, y súbele algo"— la foto acababa siendo
        un trámite, y se notaba: nueve de catorce publicaciones no tenían
        ninguna.

        El título se fue del todo (migración 000050). Donde hace falta un nombre
        —la pestaña del navegador, la tarjeta al compartir— sale de estas mismas
        palabras.
      */}
      <ElegirFotos />

      <label className="block">
        <span className="mb-1.5 block font-bold text-selva-2">
          Qué quieres contar
        </span>
        <textarea
          name="contenido"
          rows={4}
          maxLength={3000}
          placeholder="Cuéntalo con calma."
          className="w-full rounded-2xl border-2 border-selva/20 bg-white px-4 py-3 text-base text-ink placeholder:text-cacao/40 focus:border-selva"
        />
      </label>

      <BotonEnviar>Publicar</BotonEnviar>

      <button
        type="button"
        onClick={() => setAbierto(false)}
        className="min-h-11 rounded-full px-4 text-sm font-bold text-cacao underline"
      >
        Cancelar
      </button>
    </form>
  );
}

export function BotonBorrarTema({ temaId }: { temaId: string }) {
  return (
    <form action={borrarTema}>
      <input type="hidden" name="publicacion_id" value={temaId} />
      <button
        type="submit"
        className="min-h-11 rounded-full border-2 border-guayaba/50 px-4 text-sm font-bold text-cacao"
      >
        Eliminar mi publicación
      </button>
    </form>
  );
}
