"use client";

import { useActionState, useState } from "react";
import { Aviso, BotonEnviar } from "@/components/formulario";
import { reportarEnBuzon, type EstadoBuzon } from "@/lib/buzon/acciones";
import { MOTIVOS_DE_MENSAJE } from "@/lib/buzon/textos";

const INICIAL: EstadoBuzon = {};

/**
 * «Reportar» en el buzón: un mensaje, o la conversación entera si no se pasa
 * `mensajeId`. Plegado, como el de las reseñas: casi nadie lo usa, y abierto
 * bajo cada mensaje haría sospechosa toda la conversación.
 *
 * Lo propio no se ofrece —la página no lo pinta en tus mensajes— y aunque
 * alguien lo forzara, la base lo rechaza (`revisar_reporte_de_conversacion`).
 */
export function ReportarEnBuzon({
  conversacionId,
  mensajeId,
  yaReportado,
  texto = "Reportar",
}: {
  conversacionId: string;
  mensajeId?: string;
  yaReportado: boolean;
  texto?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion] = useActionState(reportarEnBuzon, INICIAL);

  if (yaReportado || estado.ok) {
    return (
      <p role="status" className="text-xs text-cacao/70">
        {estado.ok ?? "Ya lo reportaste. La administración lo está revisando."}
      </p>
    );
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="text-xs text-cacao/60 underline underline-offset-4 hover:text-cacao"
      >
        {texto}
      </button>
    );
  }

  return (
    <form action={accion} className="mt-2 grid w-full max-w-md gap-3 rounded-2xl bg-crema-2 p-4 text-left">
      <input type="hidden" name="conversacion_id" value={conversacionId} />
      {mensajeId && <input type="hidden" name="mensaje_id" value={mensajeId} />}
      {estado.error && <Aviso>{estado.error}</Aviso>}

      <fieldset className="grid gap-1.5">
        <legend className="mb-1 font-bold text-selva-2">
          {mensajeId ? "¿Por qué reportas este mensaje?" : "¿Por qué reportas esta conversación?"}
        </legend>
        {Object.entries(MOTIVOS_DE_MENSAJE).map(([clave, etiqueta]) => (
          <label key={clave} className="flex cursor-pointer items-center gap-2 text-cacao">
            <input type="radio" name="motivo" value={clave} required className="size-4 accent-selva" />
            {etiqueta}
          </label>
        ))}
      </fieldset>

      <label className="block">
        <span className="mb-1 block text-sm text-cacao/70">Cuéntanos más (opcional)</span>
        <textarea
          name="detalle"
          rows={2}
          maxLength={500}
          className="w-full rounded-2xl border-2 border-selva/20 bg-white px-4 py-2 text-base text-ink focus:border-selva"
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <BotonEnviar variante="secundario">Enviar reporte</BotonEnviar>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="text-sm font-bold text-selva underline"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
