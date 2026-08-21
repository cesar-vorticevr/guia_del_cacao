import { crearClienteServidor } from "@/lib/supabase/server";
import type { Categoria } from "@/components/formularios-auth";

/** Catálogo de categorías de negocio. Es lectura pública (spec §3). */
export async function listarCategorias(): Promise<Categoria[]> {
  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("categorias")
    .select("id, nombre")
    .order("orden");

  return data ?? [];
}
