import { crearClienteServidor } from "@/lib/supabase/server";
import type { Producto, Sucursal, Tier } from "@/lib/tipos";

const CAMPOS_SUCURSAL = `
  id, marca_id, nombre_sucursal, slug, logo, imagen_fondo, ubicacion_maps_url,
  acerca_de, whatsapp, facebook, instagram, youtube, tiktok, correo_contacto,
  telefono, tier_id, estado, motivo_rechazo, fecha_publicacion, galeria
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


export type PublicacionPropia = {
  id: string;
  titulo: string;
  imagenes: string[];
  fecha: string;
  sucursal: string;
  /** Solo en eventos: si la fecha ya pasó, dejó de salir en el micrositio. */
  paso?: boolean;
};

/**
 * Los eventos y noticias que ya publicó un negocio.
 *
 * Existe porque hasta ahora solo se podían crear: una vez publicados no había
 * forma de verlos, de ponerles foto ni de borrarlos. El acotado por sucursal es
 * explícito aunque RLS ya limite la escritura, porque la lectura es tan ancha
 * como el público del micrositio.
 */
export async function misPublicaciones(sucursalIds: string[]) {
  if (sucursalIds.length === 0) return { eventos: [], noticias: [] };

  const supabase = await crearClienteServidor();
  const ahora = Date.now();

  const [eventos, noticias] = await Promise.all([
    supabase
      .from("eventos")
      .select("id, titulo, imagenes, fecha_evento, sucursales(nombre_sucursal)")
      .in("sucursal_id", sucursalIds)
      .order("fecha_evento", { ascending: false }),
    supabase
      .from("noticias")
      .select("id, titulo, imagenes, fecha_publicacion, sucursales(nombre_sucursal)")
      .in("sucursal_id", sucursalIds)
      .order("fecha_publicacion", { ascending: false }),
  ]);

  type Fila = {
    id: string;
    titulo: string;
    imagenes: string[];
    fecha_evento?: string;
    fecha_publicacion?: string;
    sucursales: { nombre_sucursal: string } | null;
  };

  const armar = (filas: Fila[], esEvento: boolean): PublicacionPropia[] =>
    filas.map((fila) => {
      const fecha = (esEvento ? fila.fecha_evento : fila.fecha_publicacion)!;

      return {
        id: fila.id,
        titulo: fila.titulo,
        imagenes: fila.imagenes ?? [],
        fecha,
        sucursal: fila.sucursales?.nombre_sucursal ?? "",
        ...(esEvento ? { paso: new Date(fecha).getTime() < ahora } : {}),
      };
    });

  return {
    eventos: armar((eventos.data ?? []) as unknown as Fila[], true),
    noticias: armar((noticias.data ?? []) as unknown as Fila[], false),
  };
}
