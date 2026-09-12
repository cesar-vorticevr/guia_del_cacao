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
 */
export function FormularioTema({
  sucursales = [],
}: {
  /**
   * Las sucursales con las que un negocio puede firmar.
   *
   * Vacío para una persona, que publica a su nombre. Con una sola no se
   * pregunta: elegir entre una opción no es elegir.
   */
  sucursales?: { id: string; nombre_sucursal: string }[];
}) {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion] = useActionState(crearTema, INICIAL);

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="min-h-14 w-full rounded-full bg-mango px-6 font-display text-lg font-semibold text-ink shadow-dura transition-transform active:translate-y-0.5"
      >
        Publicar algo
      </button>
    );
  }

  return (
    <form
      action={accion}
      className="grid gap-3 rounded-3xl bg-white p-5 shadow-dura"
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

      <label className="block">
        <span className="mb-1.5 block font-bold text-selva-2">Título</span>
        <input
          name="titulo"
          maxLength={120}
          placeholder="¿De qué quieres hablar?"
          className="min-h-14 w-full rounded-2xl border-2 border-selva/20 bg-white px-4 text-base text-ink placeholder:text-cacao/40 focus:border-selva"
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block font-bold text-selva-2">Contenido</span>
        <textarea
          name="contenido"
          rows={5}
          maxLength={3000}
          placeholder="Cuéntalo con calma."
          className="w-full rounded-2xl border-2 border-selva/20 bg-white px-4 py-3 text-base text-ink placeholder:text-cacao/40 focus:border-selva"
        />
      </label>

      <ElegirFotos />

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
