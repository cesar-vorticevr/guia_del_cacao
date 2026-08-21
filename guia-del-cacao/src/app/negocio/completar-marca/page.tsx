import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Logotipo } from "@/components/marca";
import { FormularioMarca } from "@/components/formularios-auth";
import { listarCategorias } from "@/lib/datos/categorias";
import { perfilActual } from "@/lib/auth/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Datos de tu negocio · Guía del Cacao" };

/**
 * Recoge los datos de la marca cuando el registro no alcanzó a crearla: pasa
 * con Google (donde el rol se elige después) y cuando hay que confirmar el
 * correo antes de tener sesión.
 */
export default async function CompletarMarca() {
  const perfil = await perfilActual();

  if (!perfil) redirect("/login");
  if (perfil.rol !== "negocio") redirect("/cuenta");

  // Mismo cuidado que en el panel: filtrar por dueño explícitamente. Sin el
  // .eq, cualquier marca publicada de otro negocio contaría como propia y
  // mandaría a este usuario al panel sin haber dado de alta la suya.
  const supabase = await crearClienteServidor();
  const { data: marcas } = await supabase
    .from("marcas")
    .select("id")
    .eq("perfil_id", perfil.id)
    .limit(1);

  if (marcas && marcas.length > 0) redirect("/negocio/panel");

  const categorias = await listarCategorias();

  return (
    <>
      <header className="bg-selva py-3.5">
        <div className="mx-auto w-[92vw] max-w-[1180px]">
          <Logotipo />
        </div>
      </header>

      <main className="mx-auto grid w-[92vw] max-w-md gap-5 py-8 sm:py-12">
        <div>
          <h1 className="font-display text-3xl">Datos de tu negocio</h1>
          <p className="mt-2 text-cacao">
            Con esto ya puedes empezar a armar tu micrositio. Publicarlo es un
            paso aparte.
          </p>
        </div>

        <FormularioMarca categorias={categorias} />
      </main>
    </>
  );
}
