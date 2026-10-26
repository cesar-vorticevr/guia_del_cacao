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

/** Una reseña con sus reportes, para la cola de Moderación. */
export type ResenaReportada = ResenaAdmin & {
  reportes: number;
  motivos: string[];
  detalles: string[];
  ultimo: string;
};

export type PublicacionAdmin = {
  id: string;
  titulo: string | null;
  contenido: string;
  fecha: string;
  /** Dónde verla: la página del evento o la publicación de la comunidad. */
  enlace: string | null;
  /** Quién la publicó: la sucursal de un evento, la persona en la comunidad. */
  autor: string | null;
};

export type PerfilAdmin = {
  id: string;
  nombre: string;
  correo: string;
  rol: "cliente" | "negocio" | "admin";
  fecha_registro: string;
};

/** Cuántos renglones va cada página de las listas del panel. */
export const POR_PAGINA = 20;

/** Una página de resultados y cuántos hay en total, para la paginación. */
export type Pagina<T> = { filas: T[]; total: number; pagina: number; paginas: number };

function pagina<T>(filas: T[] | null, total: number | null, numero: number): Pagina<T> {
  const cuantos = total ?? 0;
  return {
    filas: filas ?? [],
    total: cuantos,
    pagina: numero,
    paginas: Math.max(1, Math.ceil(cuantos / POR_PAGINA)),
  };
}

/** El rango de renglones de una página, empezando en la 1. */
function rango(numero: number) {
  const desde = (Math.max(1, numero) - 1) * POR_PAGINA;
  return [desde, desde + POR_PAGINA - 1] as const;
}

/**
 * Lo que se escribió en el buscador, listo para un filtro `or` de PostgREST.
 *
 * Comas, paréntesis, puntos y comodines significan algo dentro de ese filtro:
 * dejarlos pasar permitiría a quien busca armar condiciones nuevas. Se quitan.
 */
export function limpiarBusqueda(texto: string | undefined) {
  return (texto ?? "")
    .replace(/[,()%*\\.:"']/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

/**
 * Todos los micrositios, sin paginar. Lo usan las métricas, que suman por
 * negocio; la lista del panel va por `sucursalesPagina`.
 */
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

/** Los micrositios, de 20 en 20, buscando por sucursal o por marca. */
export async function sucursalesPagina(numero: number, busqueda: string) {
  const supabase = await crearClienteServidor();
  const q = limpiarBusqueda(busqueda);

  let consulta = supabase
    .from("sucursales")
    .select(
      "id, nombre_sucursal, slug, estado, pausado_por_admin, tier_id, fecha_publicacion, marcas(nombre_comercial), tiers(nombre)",
      { count: "exact" },
    )
    .order("fecha_creacion", { ascending: false });

  if (q) {
    // La marca vive en otra tabla: primero se buscan sus ids y luego entran
    // en el mismo `or` que el nombre de la sucursal.
    const { data: marcas } = await supabase
      .from("marcas")
      .select("id")
      .ilike("nombre_comercial", `%${q}%`)
      .limit(200);

    const ids = (marcas ?? []).map((m) => m.id as string);
    consulta = consulta.or(
      [
        `nombre_sucursal.ilike.%${q}%`,
        `slug.ilike.%${q}%`,
        ...(ids.length ? [`marca_id.in.(${ids.join(",")})`] : []),
      ].join(","),
    );
  }

  const [desde, hasta] = rango(numero);
  const { data, count } = await consulta.range(desde, hasta);

  return pagina(
    data as unknown as (SucursalAdmin & { tiers: { nombre: string } | null })[] | null,
    count,
    numero,
  );
}

/** Las personas, de 20 en 20, buscando por nombre o correo y filtrando por rol. */
export async function perfilesPagina(
  numero: number,
  busqueda: string,
  rol: string | undefined,
) {
  const supabase = await crearClienteServidor();
  const q = limpiarBusqueda(busqueda);

  let consulta = supabase
    .from("perfiles")
    .select("id, nombre, correo, rol, fecha_registro", { count: "exact" })
    .order("fecha_registro", { ascending: false });

  if (q) consulta = consulta.or(`nombre.ilike.%${q}%,correo.ilike.%${q}%`);
  if (rol === "cliente" || rol === "negocio" || rol === "admin") {
    consulta = consulta.eq("rol", rol);
  }

  const [desde, hasta] = rango(numero);
  const { data, count } = await consulta.range(desde, hasta);

  return pagina(data as PerfilAdmin[] | null, count, numero);
}

const CAMPOS_RESENA =
  "id, texto, fecha, respuesta_marca, perfiles_publicos(nombre), sucursales(nombre_sucursal, slug)";

/** Todas las reseñas, de la más nueva a la más vieja, de 20 en 20. */
export async function resenasPagina(numero: number) {
  const supabase = await crearClienteServidor();
  const [desde, hasta] = rango(numero);

  const { data, count } = await supabase
    .from("resenas")
    .select(CAMPOS_RESENA, { count: "exact" })
    .order("fecha", { ascending: false })
    .range(desde, hasta);

  return pagina(data as unknown as ResenaAdmin[] | null, count, numero);
}

/** Las reseñas que alguien reportó, la del reporte más reciente primero. */
export async function resenasReportadas(): Promise<ResenaReportada[]> {
  const supabase = await crearClienteServidor();

  const { data: reportes } = await supabase.rpc("resenas_reportadas");
  const filas = (reportes ?? []) as {
    resena_id: string;
    reportes: number;
    motivos: string[];
    detalles: string[];
    ultimo: string;
  }[];

  if (filas.length === 0) return [];

  const { data } = await supabase
    .from("resenas")
    .select(CAMPOS_RESENA)
    .in(
      "id",
      filas.map((f) => f.resena_id),
    );

  const porId = new Map(
    ((data ?? []) as unknown as ResenaAdmin[]).map((r) => [r.id, r]),
  );

  return filas.flatMap((fila) => {
    const resena = porId.get(fila.resena_id);
    return resena
      ? [
          {
            ...resena,
            reportes: fila.reportes,
            motivos: fila.motivos,
            detalles: fila.detalles,
            ultimo: fila.ultimo,
          },
        ]
      : [];
  });
}

/** Los eventos, del más nuevo al más viejo, de 20 en 20. */
export async function eventosPagina(numero: number) {
  const supabase = await crearClienteServidor();
  const [desde, hasta] = rango(numero);

  const { data, count } = await supabase
    .from("eventos")
    .select("id, titulo, contenido, fecha_publicacion, sucursales(nombre_sucursal, slug)", {
      count: "exact",
    })
    .order("fecha_publicacion", { ascending: false })
    .range(desde, hasta);

  const filas = (
    (data ?? []) as unknown as {
      id: string;
      titulo: string;
      contenido: string;
      fecha_publicacion: string;
      sucursales: { nombre_sucursal: string; slug: string } | null;
    }[]
  ).map(
    (evento): PublicacionAdmin => ({
      id: evento.id,
      titulo: evento.titulo,
      contenido: evento.contenido,
      fecha: evento.fecha_publicacion,
      enlace: `/eventos/${evento.id}`,
      autor: evento.sucursales?.nombre_sucursal ?? null,
    }),
  );

  return pagina(filas, count, numero);
}

/**
 * Lo publicado en la comunidad, de 20 en 20.
 *
 * Es la tabla `publicaciones` (migración 000029). Moderación leía `noticias`,
 * que quedó en desuso entonces: lo que se publicaba de verdad no aparecía aquí.
 */
export async function comunidadPagina(numero: number) {
  const supabase = await crearClienteServidor();
  const [desde, hasta] = rango(numero);

  const { data, count } = await supabase
    .from("publicaciones")
    .select(
      "id, titulo, contenido, fecha, perfiles_publicos!publicaciones_autor_id_fkey(nombre)",
      { count: "exact" },
    )
    .order("fecha", { ascending: false })
    .range(desde, hasta);

  const filas = (
    (data ?? []) as unknown as {
      id: string;
      titulo: string | null;
      contenido: string;
      fecha: string;
      perfiles_publicos: { nombre: string } | null;
    }[]
  ).map(
    (publicacion): PublicacionAdmin => ({
      id: publicacion.id,
      titulo: publicacion.titulo,
      contenido: publicacion.contenido,
      fecha: publicacion.fecha,
      enlace: `/comunidad/tema/${publicacion.id}`,
      autor: publicacion.perfiles_publicos?.nombre ?? null,
    }),
  );

  return pagina(filas, count, numero);
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

  const [publicadas, pausadas, marcas, perfiles, reportadas, abiertas, referidos, solicitudes] =
    await Promise.all([
      porEstado("publicado"),
      porEstado("pausado"),
      total("marcas"),
      total("perfiles"),
      supabase.rpc("resenas_reportadas"),
      // El dinero: lo que pagan hoy los negocios y lo que se debe a embajadores.
      supabase
        .from("suscripciones")
        .select("estado, monto_mensual, tier_id")
        .in("estado", ["trial", "activo", "pausado_por_pago"]),
      supabase.from("referidos").select("comision, pago_id, pagado_en"),
      supabase
        .from("embajadores")
        .select("*", { count: "exact", head: true })
        .eq("estado", "solicitado"),
    ]);

  const suscripciones = (abiertas.data ?? []) as { estado: string; monto_mensual: number; tier_id: number }[];
  const pagando = suscripciones.filter((s) => s.estado === "activo" && Number(s.monto_mensual) > 0);
  const comisiones = (referidos.data ?? []) as { comision: number | null; pago_id: string | null }[];

  return {
    publicadas: publicadas.count ?? 0,
    pausadas: pausadas.count ?? 0,
    marcas: marcas.count ?? 0,
    perfiles: perfiles.count ?? 0,
    reportadas: ((reportadas.data ?? []) as unknown[]).length,
    /** Lo que entra cada mes: la suma de lo que equivale al mes de cada plan pagado. */
    ingresoMensual: Math.round(pagando.reduce((suma, s) => suma + Number(s.monto_mensual), 0) * 100) / 100,
    pagando: pagando.length,
    enPrueba: suscripciones.filter((s) => s.estado === "trial").length,
    sinPagar: suscripciones.filter((s) => s.estado === "pausado_por_pago").length,
    porPagarAEmbajadores:
      Math.round(
        comisiones
          .filter((c) => c.comision !== null && !c.pago_id)
          .reduce((suma, c) => suma + Number(c.comision), 0) * 100,
      ) / 100,
    solicitudesDeEmbajador: solicitudes.count ?? 0,
  };
}

export type UsoDeConvenio = {
  estado: string;
  fecha_inicio: string;
  fecha_fin_trial: string | null;
  pago_de_apertura: number | null;
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
  usos_maximos: number | null;
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
      "id, codigo, descripcion, vigente_desde, vigente_hasta, basico_gratis_hasta, descuento, plan_id, cubre_hasta, usos_maximos, suscripciones(estado, fecha_inicio, pago_de_apertura, fecha_fin_trial, sucursales(nombre_sucursal, slug, estado, marcas(nombre_comercial)))",
    )
    .order("vigente_desde", { ascending: false });

  return ((data ?? []) as unknown as ConvenioAdmin[]).map((convenio) => ({
    ...convenio,
    /**
     * Cuántos ya se gastaron: sucursales que canjearon la promoción. Se cuenta
     * antes de quedarse con la suscripción más reciente de cada una, que puede
     * ser un cambio de plan posterior sin el canje.
     */
    canjeados: new Set(
      convenio.suscripciones
        .filter((uso) => uso.pago_de_apertura !== null)
        .map((uso) => uso.sucursales?.slug ?? ""),
    ).size,
    suscripciones: [...convenio.suscripciones]
      .sort((a, b) => b.fecha_inicio.localeCompare(a.fecha_inicio))
      .filter(
        (uso, i, todas) =>
          todas.findIndex((otro) => otro.sucursales?.slug === uso.sucursales?.slug) === i,
      ),
  }));
}
