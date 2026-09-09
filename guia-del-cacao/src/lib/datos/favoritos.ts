import { crearClienteServidor } from "@/lib/supabase/server";
import type { TarjetaDirectorio } from "@/lib/datos/publico";

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
 * Los favoritos de alguien, listos para pintar como tarjetas del directorio.
 *
 * Trae los mismos campos que el directorio para poder reusar `TarjetaSucursal`:
 * una lista de favoritos que se viera distinta al directorio obligaría a
 * reconocer dos veces el mismo negocio.
 */
export async function misFavoritos(
  usuarioId: string,
): Promise<TarjetaDirectorio[]> {
  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("favoritos")
    .select(
      `fecha,
       sucursales!inner (
         id, slug, nombre_sucursal, logo, imagen_fondo, acerca_de, tier_id,
         entidad, ciudad, estado,
         tiers (puede_dar_puntos, permite_resenas),
         marcas (nombre_comercial, categoria_id)
       )`,
    )
    .eq("usuario_id", usuarioId)
    .order("fecha", { ascending: false });

  /*
    Un favorito puede apuntar a un micrositio que ya no está en el directorio
    —el negocio lo pausó o bajó de plan—. No se borra el favorito por eso, pero
    tampoco se enseña como si se pudiera visitar: la ficha ya no existe para el
    público y el enlace daría un 404.
  */
  return (data ?? [])
    .map((fila) => fila.sucursales as unknown as TarjetaDirectorio & { estado: string })
    .filter((sucursal) => sucursal?.estado === "publicado");
}
