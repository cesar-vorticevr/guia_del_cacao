import { crearClienteServidor } from "@/lib/supabase/server";
import { urlImagen } from "@/lib/imagenes";

/**
 * Los cupones del mercado.
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
