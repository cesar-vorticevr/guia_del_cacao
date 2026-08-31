import Link from "next/link";
import type { Metadata } from "next";
import { FormularioContrasenaNueva } from "@/components/formularios-auth";
import { Aviso } from "@/components/formulario";
import { perfilActual } from "@/lib/auth/sesion";

export const metadata: Metadata = { title: "Contraseña nueva · Guía del Cacao" };

/**
 * La contraseña nueva, al final del enlace del correo.
 *
 * No redirige a quien llega sin sesión: le explica que el enlace caducó y le
 * ofrece pedir otro. Mandarlo al login sin más lo dejaría dando vueltas —
 * justo no puede entrar, que es por lo que estaba aquí.
 */
export default async function CambiarContrasena() {
  const perfil = await perfilActual();

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="font-display text-3xl">Tu contraseña nueva</h1>
        <p className="mt-2 text-cacao">
          Escríbela dos veces y listo: al guardarla entras con ella.
        </p>
      </div>

      {perfil ? (
        <FormularioContrasenaNueva />
      ) : (
        <>
          <Aviso>
            Este enlace ya no es válido: caducó o ya se usó una vez.
          </Aviso>
          <Link
            href="/recuperar"
            className="min-h-14 rounded-full bg-selva px-6 py-3.5 text-center font-display text-lg font-semibold text-crema"
          >
            Pedir un enlace nuevo
          </Link>
        </>
      )}
    </div>
  );
}
