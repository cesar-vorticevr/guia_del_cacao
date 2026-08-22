import { crearClienteServidor } from "@/lib/supabase/server";

export type Aviso = {
  id: string;
  tipo: "resena" | "solicitud";
  titulo: string;
  detalle: string | null;
  enlace: string;
  leida: boolean;
  fecha: string;
};

/**
 * Los avisos de quien está mirando.
 *
 * No se filtra por `perfil_id` aquí porque la política de lectura ya lo hace y
 * no hay otro lector legítimo: un aviso es de una sola persona. Es de las pocas
 * consultas de la aplicación donde apoyarse solo en RLS es correcto.
 *
 * Los pendientes primero: es lo que la persona vino a ver.
 */
export async function misAvisos(limite = 20) {
  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("notificaciones")
    .select("id, tipo, titulo, detalle, enlace, leida, fecha")
    .order("leida")
    .order("fecha", { ascending: false })
    .limit(limite);

  return (data ?? []) as Aviso[];
}

/** Cuántos lleva sin leer, para el contador. */
export async function avisosSinLeer() {
  const supabase = await crearClienteServidor();

  const { count } = await supabase
    .from("notificaciones")
    .select("id", { count: "exact", head: true })
    .eq("leida", false);

  return count ?? 0;
}
