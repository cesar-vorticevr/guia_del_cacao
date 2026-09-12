import { crearClienteServidor } from "@/lib/supabase/server";

/**
 * Qué sucursales de esta lista tiene guardadas quien está mirando.
 *
 * Se pregunta por el lote entero y no una por una: el directorio pinta decenas
 * de tarjetas, y una consulta por corazón sería una consulta por tarjeta.
 *
 * Sin sesión de cliente devuelve un conjunto vacío en vez de ir a la base. El
 * corazón se sigue pintando para quien no ha entrado —es la invitación a
 * registrarse— pero apagado.
 */
export async function misFavoritosEntre(
  usuarioId: string | undefined,
  sucursalIds: string[],
): Promise<Set<string>> {
  if (!usuarioId || sucursalIds.length === 0) return new Set();

  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("favoritos")
    .select("sucursal_id")
    .eq("usuario_id", usuarioId)
    .in("sucursal_id", sucursalIds);

  return new Set((data ?? []).map((fila) => fila.sucursal_id as string));
}

/** Si una sola sucursal está guardada. Para el micrositio, que pinta una. */
export async function esFavorito(
  usuarioId: string | undefined,
  sucursalId: string,
): Promise<boolean> {
  const guardados = await misFavoritosEntre(usuarioId, [sucursalId]);
  return guardados.has(sucursalId);
}

/**
 * Cuántos negocios tiene guardados, sin traérselos.
 *
 * La cuenta solo necesita el número para ofrecer el atajo al explorador, que es
 * donde viven los favoritos. Pedir las fichas completas para contar sería
 * traerse el directorio entero y tirarlo.
 */
export async function cuantosFavoritos(usuarioId: string): Promise<number> {
  const supabase = await crearClienteServidor();

  const { count } = await supabase
    .from("favoritos")
    .select("sucursal_id", { count: "exact", head: true })
    .eq("usuario_id", usuarioId);

  return count ?? 0;
}
