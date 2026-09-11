import { crearClienteServidor } from "@/lib/supabase/server";

/** Lo mínimo del catálogo que hace falta para buscar y para decir qué encontró. */
export type ProductoBuscable = {
  nombre: string;
  precio: number | null;
};

/**
 * El catálogo de cada marca, para que el buscador encuentre por producto.
 *
 * Quien llega a esta guía no conoce ningún negocio por su nombre: busca
 * «molinillo» o «chocolate de mesa». Hasta ahora el buscador solo miraba
 * nombres de marca, de sucursal, el «acerca de» y la categoría, así que esas
 * dos búsquedas no devolvían nada aunque media docena de negocios los
 * vendieran.
 *
 * Se pide el lote entero y no producto por sucursal porque la búsqueda es en el
 * navegador: los datos tienen que estar en la página antes de la primera letra.
 * El catálogo cuelga de la marca desde la migración 000022, así que el mapa va
 * por `marca_id`.
 */
export async function catalogoPorMarca(
  marcaIds: string[],
): Promise<Record<string, ProductoBuscable[]>> {
  if (marcaIds.length === 0) return {};

  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("productos_servicios")
    .select("marca_id, nombre, precio")
    .in("marca_id", [...new Set(marcaIds)])
    .order("nombre");

  const porMarca: Record<string, ProductoBuscable[]> = {};

  for (const fila of data ?? []) {
    const marca = fila.marca_id as string;
    porMarca[marca] ??= [];
    porMarca[marca].push({
      nombre: fila.nombre as string,
      precio: fila.precio === null ? null : Number(fila.precio),
    });
  }

  return porMarca;
}

/**
 * Los productos que varios negocios tienen, para ofrecerlos como atajo.
 *
 * Es el «qué buscas» de quien no sabe ni un nombre. Sale del catálogo real y no
 * de una lista de categorías escrita a mano: una taxonomía de productos de
 * cacao habría que mantenerla, y el día que alguien cargue «tablilla de
 * chocolate» se quedaría fuera de su cajón sin que nadie se enterara. Aquí, si
 * tres negocios cargan tablillas, «tablilla» aparece sola.
 *
 * Solo entran los que están en **dos o más** negocios publicados. Un atajo que
 * lleva a un solo resultado no es un atajo: es un enlace a ese negocio, y para
 * eso ya está el directorio.
 */
export async function productosEnVariosNegocios(
  limite = 8,
): Promise<string[]> {
  const supabase = await crearClienteServidor();

  /*
    Se filtra por sucursal publicada y no solo por producto: el catálogo de una
    marca en borrador existe en la base pero no se puede visitar, y ofrecer un
    atajo a algo invisible manda a una lista vacía.
  */
  const { data } = await supabase
    .from("productos_servicios")
    .select("nombre, marca_id, marcas!inner(sucursales!inner(estado))")
    .eq("marcas.sucursales.estado", "publicado");

  const marcasPorProducto = new Map<string, Set<string>>();

  for (const fila of data ?? []) {
    const nombre = (fila.nombre as string).trim();
    if (!nombre) continue;

    const yaEstan = marcasPorProducto.get(nombre) ?? new Set<string>();
    yaEstan.add(fila.marca_id as string);
    marcasPorProducto.set(nombre, yaEstan);
  }

  return [...marcasPorProducto.entries()]
    .filter(([, marcas]) => marcas.size >= 2)
    .sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0], "es"))
    .slice(0, limite)
    .map(([nombre]) => nombre);
}
