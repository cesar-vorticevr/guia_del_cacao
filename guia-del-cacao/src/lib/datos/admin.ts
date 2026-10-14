import { crearClienteServidor } from "@/lib/supabase/server";
import type { EstadoSucursal } from "@/lib/tipos";

/**
 * Consultas del panel de administración.
 *
 * Aquí sí se lee todo sin filtrar por dueño, y es intencional: el
 * administrador es el único rol cuya política de lectura abarca la plataforma
 * entera. Cualquier otra vista debe acotar a mano.
 */

export type SucursalAdmin = {
  id: string;
  nombre_sucursal: string;
  slug: string;
  estado: EstadoSucursal;
  pausado_por_admin: boolean;
  tier_id: number | null;
  fecha_publicacion: string | null;
  marcas: { nombre_comercial: string } | null;
};

export type ResenaAdmin = {
  id: string;
  texto: string;
  fecha: string;
  respuesta_marca: string | null;
  perfiles_publicos: { nombre: string } | null;
  sucursales: { nombre_sucursal: string; slug: string } | null;
};

export type PublicacionAdmin = {
  id: string;
  titulo: string;
  contenido: string;
  fecha_publicacion: string;
  sucursales: { nombre_sucursal: string; slug: string } | null;
};

export type PerfilAdmin = {
  id: string;
  nombre: string;
  correo: string;
  rol: "cliente" | "negocio" | "admin";
  fecha_registro: string;
};

export async function sucursalesEnRevision() {
  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("sucursales")
    .select(
      "id, nombre_sucursal, slug, estado, pausado_por_admin, tier_id, fecha_publicacion, acerca_de, marcas(nombre_comercial), tiers(nombre, precio_mensual)",
    )
    .eq("estado", "pendiente_aprobacion")
    .order("fecha_creacion");

  return (data ?? []) as unknown as (SucursalAdmin & {
    acerca_de: string | null;
    tiers: { nombre: string; precio_mensual: number } | null;
  })[];
}

export async function todasLasSucursales() {
  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("sucursales")
    .select(
      "id, nombre_sucursal, slug, estado, pausado_por_admin, tier_id, fecha_publicacion, marcas(nombre_comercial)",
    )
    .order("fecha_creacion", { ascending: false });

  return (data ?? []) as unknown as SucursalAdmin[];
}

export async function resenasRecientes() {
  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("resenas")
    .select(
      "id, texto, fecha, respuesta_marca, perfiles_publicos(nombre), sucursales(nombre_sucursal, slug)",
    )
    .order("fecha", { ascending: false })
    .limit(40);

  return (data ?? []) as unknown as ResenaAdmin[];
}

export async function publicacionesRecientes() {
  const supabase = await crearClienteServidor();

  const [eventos, noticias] = await Promise.all([
    supabase
      .from("eventos")
      .select("id, titulo, contenido, fecha_publicacion, sucursales(nombre_sucursal, slug)")
      .order("fecha_publicacion", { ascending: false })
      .limit(20),
    supabase
      .from("noticias")
      .select("id, titulo, contenido, fecha_publicacion, sucursales(nombre_sucursal, slug)")
      .order("fecha_publicacion", { ascending: false })
      .limit(20),
  ]);

  return {
    eventos: (eventos.data ?? []) as unknown as PublicacionAdmin[],
    noticias: (noticias.data ?? []) as unknown as PublicacionAdmin[],
  };
}

export async function todosLosPerfiles() {
  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("perfiles")
    .select("id, nombre, correo, rol, fecha_registro")
    .order("fecha_registro", { ascending: false });

  return (data ?? []) as PerfilAdmin[];
}

/** Números de la portada del panel, para saber qué necesita atención. */
export async function resumen() {
  const supabase = await crearClienteServidor();

  // head: true trae solo el conteo, sin los renglones: da igual que haya diez
  // micrositios o diez mil.
  const porEstado = (estado: EstadoSucursal) =>
    supabase
      .from("sucursales")
      .select("*", { count: "exact", head: true })
      .eq("estado", estado);

  const total = (tabla: string) =>
    supabase.from(tabla).select("*", { count: "exact", head: true });

  const [enRevision, publicadas, pausadas, marcas, perfiles] = await Promise.all([
    porEstado("pendiente_aprobacion"),
    porEstado("publicado"),
    porEstado("pausado"),
    total("marcas"),
    total("perfiles"),
  ]);

  return {
    enRevision: enRevision.count ?? 0,
    publicadas: publicadas.count ?? 0,
    pausadas: pausadas.count ?? 0,
    marcas: marcas.count ?? 0,
    perfiles: perfiles.count ?? 0,
  };
}

export type UsoDeConvenio = {
  estado: string;
  fecha_inicio: string;
  fecha_fin_trial: string | null;
  sucursales: {
    nombre_sucursal: string;
    slug: string;
    estado: EstadoSucursal;
    marcas: { nombre_comercial: string } | null;
  } | null;
};

export type ConvenioAdmin = {
  id: string;
  codigo: string;
  descripcion: string;
  vigente_desde: string;
  vigente_hasta: string;
  basico_gratis_hasta: string | null;
  descuento: number;
  plan_id: number | null;
  cubre_hasta: string | null;
  suscripciones: UsoDeConvenio[];
};

/**
 * Los códigos de convenio con los negocios que publicaron con cada uno.
 *
 * «Quién del Festival ya está en la guía» es el número que se le reporta a la
 * Secretaría, y sale de aquí. Una sucursal que cambió de plan deja detrás una
 * suscripción cancelada con el mismo convenio: se cuenta una vez, por la
 * más reciente.
 */
export async function todosLosConvenios() {
  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("convenios")
    .select(
      "id, codigo, descripcion, vigente_desde, vigente_hasta, basico_gratis_hasta, descuento, plan_id, cubre_hasta, suscripciones(estado, fecha_inicio, fecha_fin_trial, sucursales(nombre_sucursal, slug, estado, marcas(nombre_comercial)))",
    )
    .order("vigente_desde", { ascending: false });

  return ((data ?? []) as unknown as ConvenioAdmin[]).map((convenio) => ({
    ...convenio,
    suscripciones: [...convenio.suscripciones]
      .sort((a, b) => b.fecha_inicio.localeCompare(a.fecha_inicio))
      .filter(
        (uso, i, todas) =>
          todas.findIndex((otro) => otro.sucursales?.slug === uso.sucursales?.slug) === i,
      ),
  }));
}
