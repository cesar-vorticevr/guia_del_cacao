import Link from "next/link";
import type { Metadata } from "next";
import { BotonGoogle } from "@/components/boton-google";

export const metadata: Metadata = { title: "Crear cuenta · Guía del Cacao" };

/**
 * Una cuenta para todo (cuentas compartidas, fase 4): con ella se reseña, se
 * pide y se administran negocios. Ya no se elige «cliente o negocio»; quien
 * viene a registrar su negocio tiene el atajo que crea cuenta y negocio de una
 * vez (es el que usa el stand).
 */
export default function Registro() {
  return (
    <div className="grid gap-5">
      <div>
        <h1 className="font-display text-3xl">Crear cuenta</h1>
        <p className="mt-2 text-cacao">
          Una sola cuenta para explorar, dejar reseñas y pedir, y también para
          registrar y administrar tus negocios.
        </p>
      </div>

      <Link
        href="/registro/cliente"
        className="rounded-3xl border-2 border-selva/20 bg-white p-5 transition-colors hover:border-selva"
      >
        <span className="block font-display text-xl font-semibold text-selva-2">
          Crear mi cuenta
        </span>
        <span className="mt-1 block text-cacao">
          Tu nombre, tu correo y una contraseña. Si después quieres registrar
          un negocio, lo haces desde tu cuenta.
        </span>
      </Link>

      <Link
        href="/registro/negocio"
        className="rounded-3xl border-2 border-selva/20 bg-white p-5 transition-colors hover:border-selva"
      >
        <span className="block font-display text-xl font-semibold text-selva-2">
          Crear mi cuenta y registrar mi negocio
        </span>
        <span className="mt-1 block text-cacao">
          Lo mismo, y de una vez el nombre de tu negocio para empezar a armar tu
          micrositio. Treinta días con todo, gratis.
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
