import { crearClienteServidor } from "@/lib/supabase/server";
import type { Producto, Sucursal, Tier } from "@/lib/tipos";

const CAMPOS_SUCURSAL = `
  id, marca_id, nombre_sucursal, slug, logo, imagen_fondo, ubicacion_maps_url,
  acerca_de, whatsapp, facebook, instagram, youtube, tiktok, correo_contacto,
  telefono, tier_id, estado, motivo_rechazo, fecha_publicacion
`;

/**
 * Sucursales de un dueño.
 *
 * Se filtra por marca explícitamente. RLS deja ver además cualquier sucursal
 * publicada —el directorio la necesita—, así que apoyarse solo en la política
 * mezclaría aquí las sucursales de otros negocios.
 */
export async function misSucursales(perfilId: string) {
  const supabase = await crearClienteServidor();

  const { data: marcas } = await supabase
    .from("marcas")
    .select("id")
    .eq("perfil_id", perfilId);

  const ids = (marcas ?? []).map((m) => m.id);
  if (ids.length === 0) return [];

  const { data } = await supabase
    .from("sucursales")
    .select(CAMPOS_SUCURSAL)
    .in("marca_id", ids)
    .order("fecha_creacion");

  return (data ?? []) as unknown as Sucursal[];
}

/** Una sucursal, solo si es de quien la pide. Devuelve null si no lo es. */
export async function miSucursal(perfilId: string, sucursalId: string) {
  const todas = await misSucursales(perfilId);
  return todas.find((s) => s.id === sucursalId) ?? null;
}

export async function productosDe(sucursalId: string) {
  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("productos_servicios")
    .select("id, nombre, descripcion, precio, imagen")
    .eq("sucursal_id", sucursalId)
    .order("fecha_creacion");

  return (data ?? []) as Producto[];
}

export async function listarTiers() {
  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("tiers")
    .select("id, nombre, precio_mensual, puede_dar_puntos, puede_publicar_contenido, en_banner_principal")
    .order("id");

  return (data ?? []) as Tier[];
}

/** URL pública de una imagen guardada en el bucket de micrositios. */
export async function urlPublica(ruta: string | null) {
  if (!ruta) return null;

  const supabase = await crearClienteServidor();
  const { data } = supabase.storage.from("micrositios").getPublicUrl(ruta);

  return data.publicUrl;
}
