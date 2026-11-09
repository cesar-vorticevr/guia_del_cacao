import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { perfilActual } from "@/lib/auth/sesion";

export const metadata: Metadata = { title: "Agregar mi negocio · Guía del Cacao" };

/**
 * «Agregar mi negocio».
 *
 * Fue el aviso de que hacía falta una cuenta aparte para el negocio. Desde la
 * fase 4 de cuentas compartidas (migración 000080) la misma cuenta sirve: quien
 * no ha entrado va al alta de cuenta y negocio de una vez, y quien ya tiene
 * cuenta registra su negocio con ella.
 */
export default async function SoyNegocio() {
  const perfil = await perfilActual();

  if (!perfil) redirect("/registro/negocio");
  redirect(perfil.rol === "negocio" ? "/negocio/completar-marca?nueva=1" : "/negocio/completar-marca");
}
