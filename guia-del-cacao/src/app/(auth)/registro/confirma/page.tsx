import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Confirma tu correo · Guía del Cacao" };

/** Solo se llega aquí si el proyecto exige confirmar el correo antes de entrar. */
export default function Confirma() {
  return (
    <div className="grid gap-5 text-center">
      <h1 className="font-display text-3xl">Revisa tu correo</h1>
      <p className="text-cacao">
        Te mandamos un enlace para confirmar tu cuenta. Ábrelo desde este mismo
        dispositivo y podrás entrar.
      </p>
      <Link href="/login" className="font-bold text-selva underline">
        Ir a iniciar sesión
      </Link>
    </div>
  );
}
