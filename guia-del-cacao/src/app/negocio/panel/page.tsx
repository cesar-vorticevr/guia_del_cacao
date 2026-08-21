import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { BarraSesion } from "@/components/barra-sesion";
import { perfilActual } from "@/lib/auth/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Panel del negocio · Guía del Cacao" };

export default async function PanelNegocio() {
  const perfil = await perfilActual();

  if (!perfil) redirect("/login");
  if (!perfil.rol_confirmado) redirect("/elegir-rol");
  if (perfil.rol !== "negocio") redirect("/cuenta");

  const supabase = await crearClienteServidor();

  // Hay que filtrar por dueño a mano. La política de lectura de `marcas` es
  // más amplia a propósito —el directorio público necesita ver las marcas con
  // micrositio publicado—, así que apoyarse en RLS para acotar una vista
  // privada le mostraría a este negocio las marcas de los demás.
  const { data: marcas } = await supabase
    .from("marcas")
    .select("id, nombre_comercial, categorias(nombre)")
    .eq("perfil_id", perfil.id);

  if (!marcas || marcas.length === 0) redirect("/negocio/completar-marca");

  return (
    <>
      <BarraSesion nombre={perfil.nombre} />

      <main className="mx-auto w-[92vw] max-w-[1180px] py-8">
        <h1 className="font-display text-3xl">Panel del negocio</h1>

        <ul className="mt-6 grid gap-4">
          {marcas.map((marca) => (
            <li key={marca.id} className="rounded-3xl bg-crema-2 p-6">
              <p className="font-display text-xl font-semibold text-selva-2">
                {marca.nombre_comercial}
              </p>
              <p className="mt-1 text-cacao">
                {(marca.categorias as unknown as { nombre: string } | null)?.nombre}
              </p>
              <p className="mt-3 font-mono text-xs text-cacao/70">
                Sin sucursales todavía
              </p>
            </li>
          ))}
        </ul>

        <p className="mt-8 font-mono text-xs text-cacao/70">
          Editor de micrositio, tiers y solicitudes de puntos llegan en la
          siguiente fase.
        </p>
      </main>
    </>
  );
}
