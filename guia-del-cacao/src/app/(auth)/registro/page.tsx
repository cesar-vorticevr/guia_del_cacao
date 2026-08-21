import Link from "next/link";
import type { Metadata } from "next";
import { BotonGoogle } from "@/components/boton-google";

export const metadata: Metadata = { title: "Crear cuenta · Guía del Cacao" };

/**
 * No hay cuenta genérica: aquí se elige el camino (spec §3.1). Quien entra con
 * Google desde esta pantalla también elige su rol, pero después de volver.
 */
export default function Registro() {
  return (
    <div className="grid gap-5">
      <div>
        <h1 className="font-display text-3xl">Crear cuenta</h1>
        <p className="mt-2 text-cacao">¿Cómo vas a usar la plataforma?</p>
      </div>

      <Link
        href="/registro/cliente"
        className="rounded-3xl border-2 border-selva/20 bg-white p-5 transition-colors hover:border-selva"
      >
        <span className="block font-display text-xl font-semibold text-selva-2">
          Soy cliente
        </span>
        <span className="mt-1 block text-cacao">
          Explora el directorio, deja reseñas y junta puntos escaneando el QR de
          cada negocio.
        </span>
      </Link>

      <Link
        href="/registro/negocio"
        className="rounded-3xl border-2 border-selva/20 bg-white p-5 transition-colors hover:border-selva"
      >
        <span className="block font-display text-xl font-semibold text-selva-2">
          Soy negocio
        </span>
        <span className="mt-1 block text-cacao">
          Arma tu micrositio gratis y publícalo cuando estés listo.
        </span>
      </Link>

      <div className="flex items-center gap-3 text-sm text-cacao/60">
        <span className="h-px flex-1 bg-selva/15" />o<span className="h-px flex-1 bg-selva/15" />
      </div>

      <BotonGoogle />

      <p className="text-center text-cacao">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="font-bold text-selva underline">
          Inicia sesión
        </Link>
      </p>
    </div>
  );
}
