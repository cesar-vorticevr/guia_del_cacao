import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { FormularioElegirRol } from "@/components/formularios-auth";
import { destinoSegunRol, perfilActual } from "@/lib/auth/sesion";

export const metadata: Metadata = { title: "¿Cliente o negocio? · Guía del Cacao" };

/**
 * Paso que cierra el registro con Google (spec §3.1): Google dijo quién eres,
 * falta decir para qué entras. Solo se ve una vez.
 */
export default async function ElegirRol() {
  const perfil = await perfilActual();

  if (!perfil) redirect("/login");
  if (perfil.rol_confirmado) redirect(destinoSegunRol(perfil));

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="font-display text-3xl">Hola, {perfil.nombre}</h1>
        <p className="mt-2 text-cacao">
          Falta un dato: ¿cómo vas a usar la plataforma? Esta elección no se
          puede cambiar después.
        </p>
      </div>

      <FormularioElegirRol />
    </div>
  );
}
