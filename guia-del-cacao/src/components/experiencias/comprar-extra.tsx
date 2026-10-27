"use client";

import { useActionState } from "react";
import { comprarExperienciaExtra, type EstadoExperiencia } from "@/lib/negocio/experiencias";
import { PRECIO_EXPERIENCIA_EXTRA } from "@/lib/experiencias";

/** «+1 experiencia por $499»: pago único, la mensualidad no cambia. */
export function ComprarExtra() {
  const [estado, accion, pendiente] = useActionState<EstadoExperiencia>(comprarExperienciaExtra, {});

  return (
    <form action={accion} className="grid justify-items-start gap-1.5">
      <button
        type="submit"
        disabled={pendiente}
        className="boton-oro brillo inline-flex min-h-12 items-center gap-2 rounded-full px-6 font-bold text-ink disabled:opacity-60"
      >
        <span aria-hidden="true">✦</span>
        {pendiente ? "Abriendo el pago…" : `+1 experiencia por $${PRECIO_EXPERIENCIA_EXTRA}`}
      </button>
      <span className="text-xs text-cacao/70">Pago único. Tu mensualidad sigue igual.</span>
      {estado.error && (
        <p role="alert" className="text-sm font-bold text-guayaba">
          {estado.error}
        </p>
      )}
      {estado.ok && (
        <p role="status" className="text-sm font-bold text-selva-2">
          {estado.ok}
        </p>
      )}
    </form>
  );
}
