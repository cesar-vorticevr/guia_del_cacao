import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { perfilActual } from "@/lib/auth/sesion";

export const metadata: Metadata = { title: "Agregar mi negocio · Guía del Cacao" };

/**
 * El aviso entre la cuenta de cliente y la de negocio.
 *
 * Un cliente que toca "Agregar mi negocio" espera que su cuenta cambie de
 * sombrero, y no es así: el rol se fija al registrarse y no se cambia después
 * —de eso dependen las políticas de la base, no una preferencia—. Sin esta
 * pantalla, la persona llegaría al formulario de alta, lo llenaría con su mismo
 * correo y se toparía con "ese correo ya tiene una cuenta" sin entender nada.
 *
 * Quien no ha iniciado sesión no necesita el aviso: va derecho al alta.
 */
export default async function SoyNegocio() {
  const perfil = await perfilActual();

  if (!perfil) redirect("/registro/negocio");
  if (perfil.rol !== "cliente") redirect("/negocio/panel");

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="pt-8 font-display text-3xl">Agregar mi negocio</h1>

      <div className="mt-5 rounded-3xl border-2 border-mango bg-mango/15 p-6">
        <p className="font-display text-xl text-selva-2">
          Hace falta una cuenta aparte
        </p>
        <p className="mt-2 text-cacao">
          Ahora mismo estás dentro con <strong>{perfil.correo}</strong>, que es
          una cuenta de cliente: junta mazorcas de cacao y deja reseñas. Una
          cuenta de negocio hace lo contrario —publica el micrositio y{" "}
          <em>abona</em> esas mazorcas—, y por eso las dos no caben en la misma.
        </p>
        <p className="mt-3 text-cacao">
          Regístrate con <strong>otro correo</strong> para tu negocio. Tu
          cuenta se queda como está y puedes seguir usándola.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/registro/negocio"
          className="inline-flex min-h-12 items-center rounded-full bg-selva px-6 py-3 font-bold text-crema shadow-dura-sm transition-transform active:translate-y-0.5"
        >
          Entendido, crear la cuenta
        </Link>

        <Link
          href="/cuenta"
          className="inline-flex min-h-12 items-center rounded-full border-2 border-selva/25 bg-white px-6 py-3 font-bold text-selva-2 transition-transform active:translate-y-0.5"
        >
          Volver a mi cuenta
        </Link>
      </div>

      <p className="mt-6 text-cacao">
        ¿Ya tienes una cuenta de negocio?{" "}
        <Link href="/login" className="font-bold text-selva underline">
          Entra con ella
        </Link>
        .
      </p>
    </div>
  );
}
