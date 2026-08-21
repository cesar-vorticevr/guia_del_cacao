import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { BarraSesion } from "@/components/barra-sesion";
import { perfilActual } from "@/lib/auth/sesion";

export const metadata: Metadata = { title: "Administración · Guía del Cacao" };

/**
 * El rol admin no es autoregistrable (spec §2): se asigna a mano en la base.
 * Esta pantalla solo comprueba que quien llega ya lo tenga.
 */
export default async function Admin() {
  const perfil = await perfilActual();

  if (!perfil) redirect("/login");
  if (perfil.rol !== "admin") redirect("/cuenta");

  return (
    <>
      <BarraSesion nombre={perfil.nombre} />

      <main className="mx-auto w-[92vw] max-w-[1180px] py-8">
        <h1 className="font-display text-3xl">Administración</h1>
        <p className="mt-8 font-mono text-xs text-cacao/70">
          Aprobación de micrositios y moderación llegan en la siguiente fase.
        </p>
      </main>
    </>
  );
}
