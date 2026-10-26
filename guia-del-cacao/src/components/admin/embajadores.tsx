"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { registrarPagoAEmbajador, type EstadoPagoEmbajador } from "@/lib/admin/embajadores";
import { pesos } from "@/lib/tipos";

const INICIAL: EstadoPagoEmbajador = {};

function Boton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="boton-oro brillo min-h-11 shrink-0 rounded-full px-5 font-bold text-ink disabled:opacity-60"
    >
      {pending ? "Registrando…" : children}
    </button>
  );
}

/**
 * «Ya le transferí»: la referencia del SPEI y registrar. El monto no se
 * escribe: es todo lo que se le debía, y lo suma la base.
 */
export function RegistrarPago({ perfilId, monto }: { perfilId: string; monto: number }) {
  const [estado, enviar] = useActionState(registrarPagoAEmbajador, INICIAL);

  if (estado.ok) {
    return <p className="font-bold text-lima">{estado.ok}</p>;
  }

  return (
    <form action={enviar} className="grid gap-2">
      <input type="hidden" name="perfil_id" value={perfilId} />
      <div className="flex flex-wrap gap-2">
        <input
          name="referencia"
          required
          maxLength={120}
          placeholder="Referencia SPEI"
          aria-label="Referencia de la transferencia"
          className="min-h-11 min-w-0 flex-1 rounded-full border-2 border-selva/20 bg-white px-4 text-ink"
        />
        <Boton>Ya le pagué {pesos(monto)}</Boton>
      </div>
      {estado.error && <p className="text-sm font-bold text-guayaba">{estado.error}</p>}
    </form>
  );
}
