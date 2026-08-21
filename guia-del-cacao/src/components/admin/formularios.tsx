"use client";

import { useActionState } from "react";
import { Aviso, BotonEnviar } from "@/components/formulario";
import { rechazarSucursal, type EstadoAccion } from "@/lib/admin/acciones";

const INICIAL: EstadoAccion = {};

/**
 * Rechazar exige motivo: el negocio ya pagó, así que tiene derecho a saber qué
 * corregir. La validación está en la acción del servidor, no solo aquí.
 */
export function FormularioRechazo({ sucursalId }: { sucursalId: string }) {
  const [estado, accion] = useActionState(rechazarSucursal, INICIAL);

  return (
    <form action={accion} className="grid gap-3">
      <input type="hidden" name="sucursal_id" value={sucursalId} />
      {estado.error && <Aviso>{estado.error}</Aviso>}

      <label className="block">
        <span className="mb-1.5 block font-bold text-selva-2">
          Motivo del rechazo
        </span>
        <textarea
          name="motivo"
          rows={2}
          className="w-full rounded-2xl border-2 border-selva/20 bg-white px-4 py-3 text-base text-ink focus:border-selva"
        />
      </label>

      <BotonEnviar variante="secundario">Rechazar</BotonEnviar>
    </form>
  );
}
