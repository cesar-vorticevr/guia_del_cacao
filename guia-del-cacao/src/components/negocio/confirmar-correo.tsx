"use client";

import { useActionState } from "react";
import { Aviso, BotonEnviar } from "@/components/formulario";
import { pedirVerificarCorreo, type EstadoFormulario } from "@/lib/auth/acciones";

const INICIAL: EstadoFormulario = {};

/**
 * Pide el correo de confirmación para el negocio.
 *
 * La dirección no se escribe: se manda a la de la cuenta y se enseña para que
 * quede claro a dónde va. Poder elegirla vaciaría la comprobación —cualquiera
 * confirmaría con un correo suyo— y además invita a la confusión de creer que
 * ahí se cambia el correo de la cuenta.
 */
export function ConfirmarCorreo({ correo }: { correo: string }) {
  const [estado, accion] = useActionState(
    async () => await pedirVerificarCorreo(),
    INICIAL,
  );

  if (estado.enviado) {
    return (
      <p
        role="status"
        className="rounded-2xl border-2 border-lima/50 bg-lima/15 px-4 py-3 text-cacao"
      >
        <strong className="text-selva-2">Te mandamos el correo.</strong> Ábrelo y
        toca el enlace; al volver ya podrás crear tu sucursal. Si no lo ves,
        revisa la carpeta de correo no deseado.
      </p>
    );
  }

  return (
    <form action={accion} className="grid gap-3">
      <Aviso>{estado.error}</Aviso>

      <p className="text-cacao">
        Va a <strong className="text-selva-2">{correo}</strong>.
      </p>

      <BotonEnviar>Enviarme el correo</BotonEnviar>
    </form>
  );
}
