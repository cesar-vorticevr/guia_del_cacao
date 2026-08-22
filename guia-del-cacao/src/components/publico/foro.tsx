"use client";

import { useActionState, useState } from "react";
import { Aviso, BotonEnviar } from "@/components/formulario";
import { apoyarTema, borrarTema, crearTema, type EstadoForo } from "@/lib/foro/acciones";
import { MONEDA } from "@/lib/vocabulario";

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
export function FormularioTema() {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion] = useActionState(crearTema, INICIAL);

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="min-h-14 w-full rounded-full bg-mango px-6 font-display text-lg font-semibold text-ink shadow-dura transition-transform active:translate-y-0.5"
      >
        Abrir un tema
      </button>
    );
  }

  return (
    <form action={accion} className="grid gap-3 rounded-3xl bg-white p-5 shadow-dura">
      <Resultado estado={estado} />

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
        <span className="mb-1.5 block font-bold text-selva-2">Tu tema</span>
        <textarea
          name="contenido"
          rows={5}
          maxLength={3000}
          placeholder="Cuéntalo con calma."
          className="w-full rounded-2xl border-2 border-selva/20 bg-white px-4 py-3 text-base text-ink placeholder:text-cacao/40 focus:border-selva"
        />
      </label>

      <BotonEnviar>Publicar el tema</BotonEnviar>

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

/**
 * El botón de apoyo.
 *
 * Dice claramente que la moneda sale de las tuyas: es una transferencia, no un
 * "me gusta". Quien apoya se queda con una menos y el autor con una más.
 */
export function BotonApoyar({
  temaId,
  yaApoyaste,
  esMio,
  monedas,
  apoyos,
}: {
  temaId: string;
  yaApoyaste: boolean;
  esMio: boolean;
  monedas: number;
  apoyos: number;
}) {
  const [estado, accion] = useActionState(apoyarTema, INICIAL);

  const cuenta = (
    <p className="text-cacao">
      {apoyos === 0
        ? "Todavía nadie lo apoya."
        : `${apoyos} ${apoyos === 1 ? "persona lo apoya" : "personas lo apoyan"}.`}
    </p>
  );

  if (esMio) {
    return (
      <div className="grid gap-2 rounded-3xl bg-crema-2 p-5">
        {cuenta}
        <p className="text-sm text-cacao/70">
          Cada quien puede regalarte una {MONEDA.singular} para apoyar tu tema.
        </p>
      </div>
    );
  }

  if (yaApoyaste) {
    return (
      <div className="grid gap-2 rounded-3xl border-2 border-lima/50 bg-lima/15 p-5">
        {cuenta}
        <p className="font-bold text-selva-2">Ya le diste tu {MONEDA.singular}.</p>
      </div>
    );
  }

  return (
    <form action={accion} className="grid gap-3 rounded-3xl bg-crema-2 p-5">
      <Resultado estado={estado} />
      {cuenta}
      <input type="hidden" name="tema_id" value={temaId} />

      <BotonEnviar variante={monedas > 0 ? "principal" : "secundario"}>
        Regalar una {MONEDA.unaCorta}
      </BotonEnviar>

      <p className="text-sm text-cacao/70">
        Sale de las tuyas: te quedarían {Math.max(0, monedas - 1)}.
      </p>
    </form>
  );
}

export function BotonBorrarTema({ temaId }: { temaId: string }) {
  return (
    <form action={borrarTema}>
      <input type="hidden" name="tema_id" value={temaId} />
      <button
        type="submit"
        className="min-h-11 rounded-full border-2 border-guayaba/50 px-4 text-sm font-bold text-cacao"
      >
        Eliminar mi tema
      </button>
    </form>
  );
}
