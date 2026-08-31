import Link from "next/link";
import type { Metadata } from "next";
import { FormularioRecuperar } from "@/components/formularios-auth";

export const metadata: Metadata = { title: "Recuperar mi contraseña · Guía del Cacao" };

export default function Recuperar() {
  return (
    <div className="grid gap-5">
      <div>
        <h1 className="font-display text-3xl">Olvidé mi contraseña</h1>
        <p className="mt-2 text-cacao">
          Escribe tu correo y te mandamos un enlace para poner una nueva. No
          hace falta que recuerdes la anterior.
        </p>
      </div>

      <FormularioRecuperar />

      <p className="text-center text-cacao">
        ¿Ya te acordaste?{" "}
        <Link href="/login" className="font-bold text-selva underline">
          Iniciar sesión
        </Link>
      </p>
    </div>
  );
}
