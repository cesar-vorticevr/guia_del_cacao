"use client";

import { useActionState } from "react";
import { Aviso, BotonEnviar } from "@/components/formulario";
import { cambiarRol, rechazarSucursal, type EstadoAccion } from "@/lib/admin/acciones";

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

const ROLES = [
  { valor: "cliente", texto: "Cliente" },
  { valor: "negocio", texto: "Negocio" },
  { valor: "admin", texto: "Administrador" },
];

/**
 * Cambio de rol. Un formulario por opcion y el rol en un campo oculto: React
 * descarta `name`/`value` en un boton que lleva `formAction` con funcion.
 */
export function BotonesRol({
  perfilId,
  rolActual,
}: {
  perfilId: string;
  rolActual: string;
}) {
  const [estado, accion] = useActionState(cambiarRol, INICIAL);

  return (
    <div className="grid gap-2">
      {estado.error && <Aviso>{estado.error}</Aviso>}
      {estado.ok && (
        <p role="status" className="text-sm font-bold text-selva">
          {estado.ok}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {ROLES.map((rol) => (
          <form key={rol.valor} action={accion}>
            <input type="hidden" name="perfil_id" value={perfilId} />
            <input type="hidden" name="rol" value={rol.valor} />
            <button
              type="submit"
              disabled={rol.valor === rolActual}
              aria-current={rol.valor === rolActual}
              className={`min-h-10 rounded-full px-4 text-sm font-bold ${
                rol.valor === rolActual
                  ? "cursor-default bg-selva text-crema"
                  : "border-2 border-selva/25 bg-white text-selva-2"
              }`}
            >
              {rol.texto}
            </button>
          </form>
        ))}
      </div>
    </div>
  );
}
