import { crearClienteServidor } from "@/lib/supabase/server";
import { urlImagen } from "@/lib/imagenes";

/**
 * Los cupones que un negocio ofrece a cambio de mazorcas.
 *
 * Es donde las mazorcas dejan de ser un número y se cambian por algo: hasta
 * ahora solo se juntaban visitando y se regalaban en la comunidad.
 */
export type Cupon = {
  id: string;
  nombre: string;
  descripcion: string;
  costo: number;
  /** ISO del último día en que sirve. */
  vigencia: string;
  /** Ya formateada por el servidor, para que no baile con el navegador. */
  vigenciaTexto: string;
  imagen: string | null;
  sucursal: string;
  /**
   * Si ya pasó su día.
   *
   * Se calcula aquí y no se guarda: una columna «caducado» habría que apagarla
   * cada noche, y el día que falle el proceso el cupón sigue vivo sin serlo.
   */
  caducado: boolean;
};

export const TOPE_CUPONES = 10;

const CUANDO = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

type Fila = {
  id: string;
  nombre: string;
  descripcion: string;
  costo_mazorcas: number;
  vigencia: string;
  imagen: string | null;
  sucursales: { nombre_sucursal: string } | null;
};

function armar(fila: Fila, hoy: string): Cupon {
  return {
    id: fila.id,
    nombre: fila.nombre,
    descripcion: fila.descripcion,
    costo: fila.costo_mazorcas,
    vigencia: fila.vigencia,
    // La fecha llega como `2026-09-30` y se lee a mediodía UTC: construirla con
    // `new Date("2026-09-30")` la interpreta a medianoche y en Tabasco cae el 29.
    vigenciaTexto: CUANDO.format(new Date(`${fila.vigencia}T12:00:00Z`)),
    imagen: urlImagen(fila.imagen),
    sucursal: fila.sucursales?.nombre_sucursal ?? "",
    caducado: fila.vigencia < hoy,
  };
}

/** Hoy en Tabasco, en el mismo formato que guarda la columna. */
function hoyEnTabasco() {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Mexico_City",
  });
}

/** Los cupones de un negocio, vigentes primero y caducados al final. */
export async function misCupones(sucursalIds: string[]) {
  if (sucursalIds.length === 0) return [];

  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("cupones")
    .select(
      "id, nombre, descripcion, costo_mazorcas, vigencia, imagen, sucursales(nombre_sucursal)",
    )
    .in("sucursal_id", sucursalIds)
    .order("vigencia", { ascending: false });

  const hoy = hoyEnTabasco();

  return ((data ?? []) as unknown as Fila[]).map((fila) => armar(fila, hoy));
}

/**
 * Cuántos le quedan por publicar.
 *
 * Solo cuentan los vigentes, igual que en el trigger: si contaran los caducados,
 * un negocio con dos años de historia no podría publicar nunca más sin ponerse a
 * borrar lo viejo.
 */
export function cuposLibres(cupones: Cupon[]) {
  const vigentes = cupones.filter((cupon) => !cupon.caducado).length;
  return Math.max(0, TOPE_CUPONES - vigentes);
}

/**
 * Los cupones que alguien puede canjear hoy.
 *
 * Solo vigentes y de sucursales publicadas —eso ya lo acota RLS— y se marca
 * cuáles tiene ya, para no ofrecer dos veces el mismo: es uno por persona.
 */
export async function cuponesDelMercado(perfilId: string | undefined) {
  const supabase = await crearClienteServidor();
  const hoy = hoyEnTabasco();

  const [{ data }, mios] = await Promise.all([
    supabase
      .from("cupones")
      .select(
        "id, nombre, descripcion, costo_mazorcas, vigencia, imagen, sucursales(nombre_sucursal, slug, marcas(nombre_comercial))",
      )
      .gte("vigencia", hoy)
      .order("costo_mazorcas"),
    perfilId ? misCanjes(perfilId) : Promise.resolve([]),
  ]);

  const yaTengo = new Set(mios.map((canje) => canje.cuponId));

  type ConMarca = Fila & {
    sucursales:
      | {
          nombre_sucursal: string;
          slug: string;
          marcas: { nombre_comercial: string } | null;
        }
      | null;
  };

  return ((data ?? []) as unknown as ConMarca[]).map((fila) => ({
    ...armar(fila, hoy),
    marca: fila.sucursales?.marcas?.nombre_comercial ?? fila.sucursales?.nombre_sucursal ?? "",
    slug: fila.sucursales?.slug ?? null,
    yaEsMio: yaTengo.has(fila.id),
  }));
}

export type CanjeMio = {
  id: string;
  cuponId: string;
  nombre: string;
  descripcion: string;
  costo: number;
  imagen: string | null;
  marca: string;
  sucursal: string;
  vigenciaTexto: string;
  caducado: boolean;
  /** Cuándo lo presentó en el mostrador, si ya lo hizo. */
  usadoEn: string | null;
};

/** Lo que alguien ya cambió por sus mazorcas. */
export async function misCanjes(perfilId: string): Promise<CanjeMio[]> {
  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("canjes")
    .select(
      "id, cupon_id, costo_mazorcas, usado_en, cupones(nombre, descripcion, imagen, vigencia, sucursales(nombre_sucursal, marcas(nombre_comercial)))",
    )
    .eq("usuario_id", perfilId)
    .order("fecha", { ascending: false });

  const hoy = hoyEnTabasco();

  type FilaCanje = {
    id: string;
    cupon_id: string;
    costo_mazorcas: number;
    usado_en: string | null;
    cupones: {
      nombre: string;
      descripcion: string;
      imagen: string | null;
      vigencia: string;
      sucursales: {
        nombre_sucursal: string;
        marcas: { nombre_comercial: string } | null;
      } | null;
    } | null;
  };

  return ((data ?? []) as unknown as FilaCanje[]).map((fila) => ({
    id: fila.id,
    cuponId: fila.cupon_id,
    nombre: fila.cupones?.nombre ?? "Cupón",
    descripcion: fila.cupones?.descripcion ?? "",
    costo: fila.costo_mazorcas,
    imagen: urlImagen(fila.cupones?.imagen),
    marca: fila.cupones?.sucursales?.marcas?.nombre_comercial ?? "",
    sucursal: fila.cupones?.sucursales?.nombre_sucursal ?? "",
    vigenciaTexto: fila.cupones?.vigencia
      ? CUANDO.format(new Date(`${fila.cupones.vigencia}T12:00:00Z`))
      : "",
    caducado: (fila.cupones?.vigencia ?? "9999-12-31") < hoy,
    usadoEn: fila.usado_en,
  }));
}

export type CanjePendiente = {
  id: string;
  cupon: string;
  cliente: string;
  sucursal: string;
  fechaTexto: string;
  usadoEn: string | null;
};

/**
 * Quién canjeó qué, para el negocio.
 *
 * Es lo que convierte el aviso en algo accionable: sin esta lista, «alguien
 * canjeó un cupón» no dice a quién hay que entregarle nada.
 */
export async function canjesDeMisCupones(
  sucursalIds: string[],
): Promise<CanjePendiente[]> {
  if (sucursalIds.length === 0) return [];

  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("canjes")
    .select(
      "id, fecha, usado_en, perfiles_publicos(nombre), cupones!inner(nombre, sucursal_id, sucursales(nombre_sucursal))",
    )
    .in("cupones.sucursal_id", sucursalIds)
    .order("fecha", { ascending: false })
    .limit(60);

  const CUANDO_CORTO = new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  type Fila = {
    id: string;
    fecha: string;
    usado_en: string | null;
    perfiles_publicos: { nombre: string } | null;
    cupones: {
      nombre: string;
      sucursales: { nombre_sucursal: string } | null;
    } | null;
  };

  return ((data ?? []) as unknown as Fila[]).map((fila) => ({
    id: fila.id,
    cupon: fila.cupones?.nombre ?? "Cupón",
    cliente: fila.perfiles_publicos?.nombre ?? "Cliente",
    sucursal: fila.cupones?.sucursales?.nombre_sucursal ?? "",
    fechaTexto: CUANDO_CORTO.format(new Date(fila.fecha)),
    usadoEn: fila.usado_en,
  }));
}
