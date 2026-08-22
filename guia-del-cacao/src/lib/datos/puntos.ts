import { crearClienteServidor } from "@/lib/supabase/server";

export type SolicitudPendiente = {
  id: string;
  fecha_solicitud: string;
  usuario_id: string;
  sucursal_id: string;
  perfiles_publicos: { nombre: string; foto_perfil: string | null } | null;
  sucursales: {
    nombre_sucursal: string;
    marcas: { nombre_comercial: string } | null;
  } | null;
  solicitud_productos: {
    cantidad: number;
    productos_servicios: { nombre: string; precio: number | null } | null;
  }[];
};

export type SolicitudDelCliente = {
  id: string;
  estado: "pendiente" | "aprobada" | "rechazada";
  puntos_otorgados: number | null;
  fecha_solicitud: string;
  sucursales: {
    id: string;
    nombre_sucursal: string;
    slug: string;
    marcas: { nombre_comercial: string } | null;
  } | null;
};

const CAMPOS_PENDIENTE = `
  id, fecha_solicitud, usuario_id, sucursal_id,
  perfiles_publicos(nombre, foto_perfil),
  sucursales(nombre_sucursal, marcas(nombre_comercial)),
  solicitud_productos(cantidad, productos_servicios(nombre, precio))
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
    .select(
      "id, estado, puntos_otorgados, fecha_solicitud, sucursales(id, nombre_sucursal, slug, marcas(nombre_comercial))",
    )
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
    .select(
      "id, texto, fecha, foto, respuesta_marca, sucursales(id, nombre_sucursal, slug, marcas(nombre_comercial))",
    )
    .eq("usuario_id", usuarioId)
    .order("fecha", { ascending: false });

  return (data ?? []) as unknown as {
    id: string;
    texto: string;
    fecha: string;
    foto: string | null;
    respuesta_marca: string | null;
    sucursales: {
      id: string;
      nombre_sucursal: string;
      slug: string;
      marcas: { nombre_comercial: string } | null;
    } | null;
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

export type Pasaporte = { puntos: number; nivel: number };

/**
 * Monedas y rango del año en curso de un cliente.
 *
 * El `.eq("usuario_id")` no sobra aunque ya se filtre por año: un
 * administrador puede leer los rangos de todo el mundo, así que sin él la
 * consulta devolvería el pasaporte de cualquiera como si fuera el propio.
 * Ya pasó una vez (ver AGENTS.md, "RLS autoriza, no acota").
 */
export async function pasaporteDe(
  usuarioId: string,
  anio = new Date().getFullYear(),
): Promise<Pasaporte> {
  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("rangos_usuario")
    .select("puntos_acumulados, rango_actual")
    .eq("usuario_id", usuarioId)
    .eq("anio", anio)
    .maybeSingle();

  return { puntos: data?.puntos_acumulados ?? 0, nivel: data?.rango_actual ?? 1 };
}
