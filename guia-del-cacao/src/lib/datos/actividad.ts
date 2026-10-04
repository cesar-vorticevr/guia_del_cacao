import { crearClienteServidor } from "@/lib/supabase/server";
import { todasLasSucursales } from "@/lib/datos/admin";
import type { TipoDeActividad } from "@/lib/actividad";

/**
 * Lo que mide la guía (migración 000052) junto con lo que ya vive en sus
 * propias tablas —reseñas, calificaciones, favoritos, cuentas—, para el
 * tablero del administrador y para lo que ve cada negocio.
 */

/** Los botones que dicen «alguien quiso ir o escribir»: el dato que vende. */
export const CONTACTOS: TipoDeActividad[] = [
  "whatsapp",
  "telefono",
  "correo",
  "mapa",
  "red",
];

export const PERIODOS = {
  "7": { dias: 7, texto: "7 días" },
  "30": { dias: 30, texto: "30 días" },
  "90": { dias: 90, texto: "90 días" },
  todo: { dias: null, texto: "Todo" },
} as const;

export type Periodo = keyof typeof PERIODOS;

export function esPeriodo(valor: string | undefined): valor is Periodo {
  return !!valor && valor in PERIODOS;
}

export function desdeDe(periodo: Periodo) {
  const dias = PERIODOS[periodo].dias;
  return dias === null
    ? new Date("2020-01-01T00:00:00Z")
    : new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
}

type Conteo = Partial<Record<TipoDeActividad, number>>;

export type FilaDeNegocio = {
  id: string;
  slug: string;
  negocio: string;
  sucursal: string;
  estado: string;
  plan: number | null;
  actividad: Conteo;
  contactos: number;
  resenas: number;
  calificaciones: number;
  promedio: number | null;
  favoritos: number;
};

function sumar(conteo: Conteo, tipos: TipoDeActividad[]) {
  return tipos.reduce((total, tipo) => total + (conteo[tipo] ?? 0), 0);
}

/** Cuántas filas de una tabla caen desde una fecha, sin bajarlas. */
async function contar(tabla: string, columna: string, desde: Date, filtro?: [string, string]) {
  const supabase = await crearClienteServidor();
  let consulta = supabase
    .from(tabla)
    .select("*", { count: "exact", head: true })
    .gte(columna, desde.toISOString());
  if (filtro) consulta = consulta.eq(filtro[0], filtro[1]);
  const { count } = await consulta;
  return count ?? 0;
}

export async function tableroDeActividad(periodo: Periodo) {
  const desde = desdeDe(periodo);
  const supabase = await crearClienteServidor();
  const p_desde = desde.toISOString();

  const [
    porSucursal,
    porDia,
    busquedas,
    paginas,
    redes,
    filtros,
    sucursales,
    resenas,
    calificaciones,
    favoritos,
    clientesNuevos,
    negociosNuevos,
    eventosNuevos,
    publicacionesNuevas,
    comentariosNuevos,
  ] = await Promise.all([
    supabase.rpc("actividad_por_sucursal", { p_desde }),
    supabase.rpc("actividad_por_dia", { p_desde }),
    supabase.rpc("detalles_frecuentes", { p_tipo: "busqueda", p_desde, p_limite: 15 }),
    supabase.rpc("detalles_frecuentes", { p_tipo: "vista_pagina", p_desde, p_limite: 15 }),
    supabase.rpc("detalles_frecuentes", { p_tipo: "red", p_desde, p_limite: 10 }),
    supabase.rpc("detalles_frecuentes", { p_tipo: "filtro", p_desde, p_limite: 15 }),
    todasLasSucursales(),
    supabase.from("resenas").select("sucursal_id").gte("fecha", p_desde),
    supabase.from("calificaciones").select("sucursal_id, estrellas").gte("fecha", p_desde),
    supabase.rpc("favoritos_por_sucursal", { p_desde }),
    contar("perfiles", "fecha_registro", desde, ["rol", "cliente"]),
    contar("perfiles", "fecha_registro", desde, ["rol", "negocio"]),
    contar("eventos", "fecha_publicacion", desde),
    contar("publicaciones", "fecha", desde),
    contar("comentarios", "fecha", desde),
  ]);

  // ---- Totales de la plataforma
  const totales: Conteo = {};
  for (const fila of (porDia.data ?? []) as { tipo: TipoDeActividad; total: number }[]) {
    totales[fila.tipo] = (totales[fila.tipo] ?? 0) + Number(fila.total);
  }

  // ---- Por día: visitas y contactos, del más viejo al más nuevo
  const dias = new Map<string, Conteo>();
  for (const fila of (porDia.data ?? []) as { dia: string; tipo: TipoDeActividad; total: number }[]) {
    const conteo = dias.get(fila.dia) ?? {};
    conteo[fila.tipo] = Number(fila.total);
    dias.set(fila.dia, conteo);
  }
  const serie = [...dias.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dia, conteo]) => ({
      dia,
      visitas: conteo.vista_pagina ?? 0,
      contactos: sumar(conteo, CONTACTOS),
    }));

  // ---- Por negocio
  const actividad = new Map<string, Conteo>();
  for (const fila of (porSucursal.data ?? []) as { sucursal_id: string; tipo: TipoDeActividad; total: number }[]) {
    const conteo = actividad.get(fila.sucursal_id) ?? {};
    conteo[fila.tipo] = Number(fila.total);
    actividad.set(fila.sucursal_id, conteo);
  }

  const cuantas = (filas: { sucursal_id: string }[] | null, id: string) =>
    (filas ?? []).filter((f) => f.sucursal_id === id).length;

  const negocios: FilaDeNegocio[] = sucursales
    .map((s) => {
      const conteo = actividad.get(s.id) ?? {};
      const estrellas = (calificaciones.data ?? [])
        .filter((c) => c.sucursal_id === s.id)
        .map((c) => Number(c.estrellas));

      return {
        id: s.id,
        slug: s.slug,
        negocio: s.marcas?.nombre_comercial ?? s.nombre_sucursal,
        sucursal: s.nombre_sucursal,
        estado: s.estado,
        plan: s.tier_id,
        actividad: conteo,
        contactos: sumar(conteo, CONTACTOS),
        resenas: cuantas(resenas.data, s.id),
        calificaciones: estrellas.length,
        promedio: estrellas.length
          ? estrellas.reduce((a, b) => a + b, 0) / estrellas.length
          : null,
        favoritos: Number(
          ((favoritos.data ?? []) as { sucursal_id: string; total: number }[]).find(
            (f) => f.sucursal_id === s.id,
          )?.total ?? 0,
        ),
      };
    })
    .sort(
      (a, b) =>
        b.contactos - a.contactos ||
        (b.actividad.vista_micrositio ?? 0) - (a.actividad.vista_micrositio ?? 0) ||
        a.negocio.localeCompare(b.negocio),
    );

  return {
    desde,
    totales,
    contactos: sumar(totales, CONTACTOS),
    serie,
    negocios,
    publicados: sucursales.filter((s) => s.estado === "publicado").length,
    resenas: resenas.data?.length ?? 0,
    calificaciones: calificaciones.data?.length ?? 0,
    favoritos: ((favoritos.data ?? []) as { total: number }[]).reduce(
      (total, f) => total + Number(f.total),
      0,
    ),
    clientesNuevos,
    negociosNuevos,
    eventosNuevos,
    publicacionesNuevas,
    comentariosNuevos,
    busquedas: (busquedas.data ?? []) as { detalle: string; total: number }[],
    paginas: (paginas.data ?? []) as { detalle: string; total: number }[],
    redes: (redes.data ?? []) as { detalle: string; total: number }[],
    filtros: (filtros.data ?? []) as { detalle: string; total: number }[],
  };
}

/**
 * Los números de un negocio: lo que se le enseña en su panel para que vea qué
 * le trae la guía. La base comprueba que la sucursal sea suya.
 */
export async function numerosDeSucursales(ids: string[], dias = 30) {
  const supabase = await crearClienteServidor();
  const p_desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();

  const respuestas = await Promise.all(
    ids.map((id) => supabase.rpc("actividad_de_sucursal", { p_sucursal: id, p_desde })),
  );

  const favoritos = await Promise.all(
    ids.map((id) => supabase.rpc("favoritos_de_sucursal", { p_sucursal: id })),
  );

  const conteo: Conteo = {};
  for (const { data } of respuestas) {
    for (const fila of (data ?? []) as { tipo: TipoDeActividad; total: number }[]) {
      conteo[fila.tipo] = (conteo[fila.tipo] ?? 0) + Number(fila.total);
    }
  }

  return {
    conteo,
    contactos: sumar(conteo, CONTACTOS),
    favoritos: favoritos.reduce((total, { data }) => total + Number(data ?? 0), 0),
  };
}
