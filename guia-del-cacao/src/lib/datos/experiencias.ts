import { crearClienteServidor } from "@/lib/supabase/server";
import { experienciaDeFila, type Experiencia } from "@/lib/experiencias";

/**
 * Lecturas de las experiencias de realidad aumentada (migración 000066).
 *
 * Se filtra a mano por la marca aunque RLS ya lo haga: «RLS autoriza, no
 * acota» (AGENTS.md).
 */

/** La marca de quien lleva la sesión, o null. */
export async function marcaDe(perfilId: string) {
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from("marcas")
    .select("id, nombre_comercial, experiencias_extra")
    .eq("perfil_id", perfilId)
    .limit(1)
    .maybeSingle();
  return data as { id: string; nombre_comercial: string; experiencias_extra: number } | null;
}

/** Las experiencias de una marca, la más nueva arriba. */
export async function experienciasDe(marcaId: string): Promise<Experiencia[]> {
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from("experiencias")
    .select("*")
    .eq("marca_id", marcaId)
    .order("creada_en", { ascending: false });
  return (data ?? []).map(experienciaDeFila);
}

/** Una experiencia, solo si es de esa marca. */
export async function experienciaDe(marcaId: string, id: string): Promise<Experiencia | null> {
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from("experiencias")
    .select("*")
    .eq("marca_id", marcaId)
    .eq("id", id)
    .maybeSingle();
  return data ? experienciaDeFila(data) : null;
}

/** Cuántas publica hoy la marca: su plan más las compradas. 0 sin Pro. */
export async function cupoDe(marcaId: string) {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.rpc("cupo_de_experiencias", { p_marca: marcaId });
  return Number(data ?? 0);
}

/**
 * Cuáles de las publicadas se ven hoy: las más recientes que caben en el cupo,
 * igual que decide `experiencia_publica` en la base.
 */
export function visibles(experiencias: Experiencia[], cupo: number) {
  return new Set(
    experiencias
      .filter((e) => e.estado === "publicada")
      .sort((a, b) => (b.publicadaEn ?? "").localeCompare(a.publicadaEn ?? ""))
      .slice(0, cupo)
      .map((e) => e.id),
  );
}
