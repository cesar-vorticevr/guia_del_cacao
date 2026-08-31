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

/**
 * Cuántas reseñas sin leer tiene cada sucursal, por slug.
 *
 * Se agrupa por el `enlace` del aviso (`/marca/{slug}`) porque la notificación
 * no guarda a qué sucursal pertenece: guarda a dónde ir. Es el mismo dato desde
 * otro ángulo, y añadir una columna solo para esto obligaría a rellenarla hacia
 * atrás en los avisos que ya existen.
 */
export async function sinLeerPorSucursal(): Promise<Map<string, number>> {
  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("notificaciones")
    .select("enlace")
    .eq("leida", false)
    .eq("tipo", "resena");

  const cuenta = new Map<string, number>();

  for (const fila of (data ?? []) as { enlace: string }[]) {
    const slug = fila.enlace.replace("/marca/", "");
    cuenta.set(slug, (cuenta.get(slug) ?? 0) + 1);
  }

  return cuenta;
}

export type SolicitudesDeSucursal = { pendientes: number; nuevas: number };

/**
 * Solicitudes de mazorcas sin resolver, por sucursal.
 *
 * Distingue **pendientes** de **nuevas**: la primera cuenta lo que falta por
 * atender y la segunda, lo que llegó desde la última vez que el negocio abrió
 * la sección. Una enciende el icono; la otra lo hace destellar.
 */
export async function solicitudesPorSucursal(): Promise<
  Map<string, SolicitudesDeSucursal>
> {
  const supabase = await crearClienteServidor();

  const { data } = await supabase.rpc("solicitudes_por_sucursal");

  type Fila = { sucursal_id: string; pendientes: number; nuevas: number };

  return new Map(
    ((data ?? []) as Fila[]).map((fila) => [
      fila.sucursal_id,
      { pendientes: Number(fila.pendientes), nuevas: Number(fila.nuevas) },
    ]),
  );
}

/**
 * Deja constancia de que este negocio ya miró sus solicitudes de mazorcas.
 *
 * Vive aquí y no entre las acciones a propósito: **se llama desde el render** de
 * la pantalla de monedas, y una acción con `revalidatePath` dentro revienta ahí
 * —Next no deja revalidar mientras se está pintando—. Esto solo escribe.
 *
 * No hace falta revalidar nada: el panel es dinámico y vuelve a preguntar en
 * cuanto se navega a él, que es justo cuando importa ver el destello apagado.
 */
export async function anotarMonedasVistas(perfilId: string) {
  const supabase = await crearClienteServidor();

  await supabase
    .from("perfiles")
    .update({ monedas_vistas_en: new Date().toISOString() })
    .eq("id", perfilId);
}
