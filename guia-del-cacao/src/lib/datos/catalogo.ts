import { crearClienteServidor } from "@/lib/supabase/server";
import type { Producto } from "@/lib/tipos";

const CAMPOS = "id, nombre, sku, descripcion, precio, imagen";

/**
 * El catálogo de una marca: sus productos, una sola vez.
 *
 * Antes cada sucursal cargaba los suyos y una marca con tres locales tenía la
 * misma barra escrita tres veces. Aquí hay una fila por producto y las
 * sucursales apuntan a ella, así que corregir un precio se ve en todas sin
 * tocarlas.
 */
export async function catalogoDeMarca(marcaId: string): Promise<Producto[]> {
  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("productos_servicios")
    .select(CAMPOS)
    .eq("marca_id", marcaId)
    .order("nombre");

  return (data ?? []) as Producto[];
}

/**
 * Los productos que una sucursal maneja, con sus datos del catálogo.
 *
 * La consulta va por la tabla puente y no al revés porque lo que se pide es
 * "lo de esta sucursal": pedir el catálogo entero y filtrarlo aquí traería de
 * más en cuanto una marca tenga cien productos y dos sucursales pequeñas.
 */
export async function productosDeSucursal(sucursalId: string): Promise<Producto[]> {
  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("productos_sucursal")
    .select(`productos_servicios(${CAMPOS})`)
    .eq("sucursal_id", sucursalId);

  type Fila = { productos_servicios: Producto | null };

  return ((data ?? []) as unknown as Fila[])
    .map((fila) => fila.productos_servicios)
    .filter((producto): producto is Producto => producto !== null)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

/** Solo los ids, para marcar las casillas de la pantalla de selección. */
export async function idsDeSucursal(sucursalId: string): Promise<string[]> {
  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("productos_sucursal")
    .select("producto_id")
    .eq("sucursal_id", sucursalId);

  return ((data ?? []) as { producto_id: string }[]).map((f) => f.producto_id);
}

/**
 * En cuántas sucursales se está usando cada producto.
 *
 * Lo pide la pantalla del catálogo para poder avisar antes de borrar: "esto se
 * quita de tus tres sucursales" es una advertencia; "¿seguro?" no lo es.
 */
export async function usoEnSucursales(marcaId: string): Promise<Map<string, number>> {
  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("productos_sucursal")
    .select("producto_id, productos_servicios!inner(marca_id)")
    .eq("productos_servicios.marca_id", marcaId);

  const cuenta = new Map<string, number>();

  for (const fila of (data ?? []) as { producto_id: string }[]) {
    cuenta.set(fila.producto_id, (cuenta.get(fila.producto_id) ?? 0) + 1);
  }

  return cuenta;
}
