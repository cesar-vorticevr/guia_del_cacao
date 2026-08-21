import { crearClienteServidor } from "@/lib/supabase/server";

export type SolicitudPendiente = {
  id: string;
  fecha_solicitud: string;
  usuario_id: string;
  sucursal_id: string;
  perfiles_publicos: { nombre: string; foto_perfil: string | null } | null;
  sucursales: { nombre_sucursal: string } | null;
  solicitud_productos: { productos_servicios: { nombre: string; precio: number | null } | null }[];
};

export type SolicitudDelCliente = {
  id: string;
  estado: "pendiente" | "aprobada" | "rechazada";
  puntos_otorgados: number | null;
  fecha_solicitud: string;
  sucursales: { nombre_sucursal: string; slug: string } | null;
};

const CAMPOS_PENDIENTE = `
  id, fecha_solicitud, usuario_id, sucursal_id,
  perfiles_publicos(nombre, foto_perfil),
  sucursales(nombre_sucursal),
  solicitud_productos(productos_servicios(nombre, precio))
`;

/**
 * Solicitudes que una marca tiene por resolver.
 *
 * Se acota a las sucursales del dueño de forma explícita. RLS ya limita las
 * solicitudes a las de sus sucursales, pero repetirlo aquí deja la intención
 * escrita y no depende de que la política siga igual mañana.
 */
export async function solicitudesPorResolver(sucursalIds: string[]) {
  if (sucursalIds.length === 0) return [];

  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("solicitudes_puntos")
    .select(CAMPOS_PENDIENTE)
    .in("sucursal_id", sucursalIds)
    .eq("estado", "pendiente")
    .order("fecha_solicitud");

  return (data ?? []) as unknown as SolicitudPendiente[];
}

/** Historial del cliente: qué pidió, dónde y en qué quedó. */
export async function misSolicitudes(usuarioId: string) {
  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("solicitudes_puntos")
    .select("id, estado, puntos_otorgados, fecha_solicitud, sucursales(nombre_sucursal, slug)")
    .eq("usuario_id", usuarioId)
    .order("fecha_solicitud", { ascending: false })
    .limit(30);

  return (data ?? []) as unknown as SolicitudDelCliente[];
}

/** Reseñas que ha escrito el cliente, para su propia cuenta. */
export async function misResenas(usuarioId: string) {
  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("resenas")
    .select("id, texto, fecha, respuesta_marca, sucursales(nombre_sucursal, slug)")
    .eq("usuario_id", usuarioId)
    .order("fecha", { ascending: false });

  return (data ?? []) as unknown as {
    id: string;
    texto: string;
    fecha: string;
    respuesta_marca: string | null;
    sucursales: { nombre_sucursal: string; slug: string } | null;
  }[];
}

/**
 * ¿Este cliente tiene una solicitud sin resolver en esta sucursal?
 *
 * Regla §5.4.4: no puede pedir otra hasta que la anterior se resuelva. El
 * índice único de la base lo impide de todos modos; esto es para avisarle
 * antes, en vez de dejarlo llenar el formulario y fallar al final.
 */
export async function tienePendienteEn(usuarioId: string, sucursalId: string) {
  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("solicitudes_puntos")
    .select("id")
    .eq("usuario_id", usuarioId)
    .eq("sucursal_id", sucursalId)
    .eq("estado", "pendiente")
    .maybeSingle();

  return data !== null;
}
