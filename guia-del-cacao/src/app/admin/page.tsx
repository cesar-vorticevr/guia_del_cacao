import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { BarraSesion } from "@/components/barra-sesion";
import { FormularioRechazo } from "@/components/admin/formularios";
import { aprobarSucursal } from "@/lib/admin/acciones";
import { perfilActual } from "@/lib/auth/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { pesos } from "@/lib/tipos";

export const metadata: Metadata = { title: "Administración · Guía del Cacao" };

type EnRevision = {
  id: string;
  nombre_sucursal: string;
  acerca_de: string | null;
  slug: string;
  marcas: { nombre_comercial: string } | null;
  tiers: { nombre: string; precio_mensual: number } | null;
};

/**
 * Cola de aprobación. Aquí el rol admin no es autoregistrable (spec §2) y
 * Turismo no participa en esta decisión (§3.3).
 */
export default async function Admin() {
  const perfil = await perfilActual();

  if (!perfil) redirect("/login");
  if (perfil.rol !== "admin") redirect("/cuenta");

  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("sucursales")
    .select(
      "id, nombre_sucursal, acerca_de, slug, marcas(nombre_comercial), tiers(nombre, precio_mensual)",
    )
    .eq("estado", "pendiente_aprobacion")
    .order("fecha_creacion");

  const pendientes = (data ?? []) as unknown as EnRevision[];

  return (
    <>
      <BarraSesion nombre={perfil.nombre} />

      <main className="mx-auto w-[92vw] max-w-2xl py-8">
        <h1 className="font-display text-3xl">Micrositios en revisión</h1>

        {pendientes.length === 0 ? (
          <p className="mt-6 rounded-3xl bg-crema-2 p-6 text-cacao">
            No hay nada pendiente por ahora.
          </p>
        ) : (
          <ul className="mt-6 grid gap-5">
            {pendientes.map((sucursal) => (
              <li key={sucursal.id} className="grid gap-4 rounded-3xl bg-crema-2 p-6">
                <div>
                  <p className="font-mono text-xs tracking-wide text-cacao/70 uppercase">
                    {sucursal.marcas?.nombre_comercial}
                    {sucursal.tiers &&
                      ` · ${sucursal.tiers.nombre} · ${pesos(sucursal.tiers.precio_mensual)}/mes`}
                  </p>
                  <h2 className="mt-1 font-display text-xl">{sucursal.nombre_sucursal}</h2>
                  <p className="mt-1 font-mono text-xs text-cacao/70">/marca/{sucursal.slug}</p>
                </div>

                {sucursal.acerca_de && (
                  <p className="rounded-2xl bg-white p-4 text-cacao">{sucursal.acerca_de}</p>
                )}

                <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
                  <form action={aprobarSucursal}>
                    <input type="hidden" name="sucursal_id" value={sucursal.id} />
                    <button
                      type="submit"
                      className="min-h-14 w-full rounded-full bg-selva px-6 font-display text-lg font-semibold text-crema"
                    >
                      Aprobar y publicar
                    </button>
                  </form>

                  <FormularioRechazo sucursalId={sucursal.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
