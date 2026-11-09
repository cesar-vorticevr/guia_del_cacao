import Link from "next/link";
import type { Metadata } from "next";
import { FormularioCodigo } from "@/components/formularios-auth";
import { correoDelCodigo } from "@/lib/auth/acciones";

export const metadata: Metadata = { title: "Confirma tu correo · Guía del Cacao" };

/**
 * Se llega aquí después de registrarse, porque el proyecto exige confirmar el
 * correo. El correo trae un código de 6 dígitos —y también un enlace, que
 * sigue funcionando—: escribirlo aquí abre la sesión sin salir de la página.
 */
export default async function Confirma() {
  const correo = await correoDelCodigo();

  return (
    <div className="grid gap-5">
      <div className="grid gap-2 text-center">
        <h1 className="font-display text-3xl">Revisa tu correo</h1>
        <p className="text-cacao">
          {correo ? (
            <>
              Mandamos un código de 6 dígitos a{" "}
              <strong className="text-selva-2">{correo}</strong>. Escríbelo aquí
              para confirmar tu cuenta.
            </>
          ) : (
            <>Escribe tu correo y el código de 6 dígitos que te mandamos.</>
          )}{" "}
          Si no lo ves, revisa la carpeta de correo no deseado.
        </p>
      </div>

      <FormularioCodigo correo={correo} />

      <p className="text-center">
        <Link href="/login" className="font-bold text-selva underline">
          Ya confirmé: iniciar sesión
        </Link>
      </p>
    </div>
  );
}
