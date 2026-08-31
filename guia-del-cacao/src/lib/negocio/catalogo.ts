"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { perfilActual } from "@/lib/auth/sesion";
import { revisarImagen } from "@/lib/imagenes";
import { LIMITES, revisarLargo } from "@/lib/limites";

export type EstadoCatalogo = { error?: string; ok?: string };

function texto(datos: FormData, campo: string) {
  const valor = (datos.get(campo)?.toString() ?? "").trim();
  return valor.length > 0 ? valor : null;
}

/**
 * La marca de quien manda la petición.
 *
 * El catálogo cuelga de la marca, así que todo lo de aquí se acota por ella y
 * no por la sucursal. RLS lo vuelve a comprobar con `posee_marca`, pero se
 * filtra a mano igual: la política de lectura de productos es tan ancha como su
 * lector legítimo más amplio —el público de un micrositio publicado—, y apoyarse
 * solo en ella dejaría ver catálogos ajenos.
 */
async function miMarca() {
  const perfil = await perfilActual();

  if (!perfil) redirect("/login");
  if (perfil.rol !== "negocio") redirect("/cuenta");

  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("marcas")
    .select("id")
    .eq("perfil_id", perfil.id)
    .limit(1)
    .maybeSingle();

  if (!data) redirect("/negocio/completar-marca");

  return data.id as string;
}

/** Lee nombre, precio y descripción de un formulario de producto. */
function leerProducto(datos: FormData) {
  const nombre = texto(datos, "nombre");
  if (!nombre) return { error: "El producto necesita un nombre." as const };

  const descripcion = texto(datos, "descripcion");
  const largo = revisarLargo(
    descripcion,
    LIMITES.descripcionProducto,
    "La descripción del producto",
  );
  if (largo) return { error: largo };

  const precioTexto = texto(datos, "precio");
  const precio = precioTexto ? Number(precioTexto) : null;

  if (precio !== null && (Number.isNaN(precio) || precio < 0)) {
    return { error: "El precio no es un número válido." as const };
  }

  return { nombre, descripcion, precio, sku: texto(datos, "sku") };
}

/**
 * Sube la foto del producto, si viene una.
 *
 * Va a la carpeta de la marca y no a la de una sucursal: el producto ya no es
 * de ninguna en particular, y guardarlo bajo una sucursal haría que borrarla se
 * llevara por delante la foto de un producto que las demás siguen usando.
 */
async function subirFoto(archivo: FormDataEntryValue | null, marcaId: string) {
  if (!(archivo instanceof File) || archivo.size === 0) return { ruta: null };

  const problema = revisarImagen(archivo);
  if (problema) return { error: problema };

  const extension = archivo.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const ruta = `catalogo/${marcaId}/${Date.now()}.${extension}`;

  const supabase = await crearClienteServidor();
  const { error } = await supabase.storage.from("micrositios").upload(ruta, archivo);

  if (error) return { error: "No se pudo subir la foto. Inténtalo de nuevo." };

  return { ruta };
}

export async function agregarAlCatalogo(
  _previo: EstadoCatalogo,
  datos: FormData,
): Promise<EstadoCatalogo> {
  const marcaId = await miMarca();

  const campos = leerProducto(datos);
  if ("error" in campos) return { error: campos.error };

  const foto = await subirFoto(datos.get("imagen"), marcaId);
  if (foto.error) return { error: foto.error };

  const supabase = await crearClienteServidor();

  const { error } = await supabase.from("productos_servicios").insert({
    marca_id: marcaId,
    nombre: campos.nombre,
    sku: campos.sku,
    descripcion: campos.descripcion,
    precio: campos.precio,
    imagen: foto.ruta,
  });

  if (error) {
    // Sin esto quedaría una foto huérfana en el bucket cada vez que falla.
    if (foto.ruta) await supabase.storage.from("micrositios").remove([foto.ruta]);
    return { error: "No se pudo agregar el producto." };
  }

  revalidatePath("/negocio/panel/catalogo");
  return { ok: "Producto agregado al catálogo." };
}

/**
 * Corrige un producto. El cambio se ve en todas las sucursales que lo manejan,
 * porque no hay copias: hay una fila y varias sucursales apuntando a ella.
 */
export async function editarDelCatalogo(
  _previo: EstadoCatalogo,
  datos: FormData,
): Promise<EstadoCatalogo> {
  const marcaId = await miMarca();
  const productoId = datos.get("producto_id")?.toString() ?? "";

  const campos = leerProducto(datos);
  if ("error" in campos) return { error: campos.error };

  const foto = await subirFoto(datos.get("imagen"), marcaId);
  if (foto.error) return { error: foto.error };

  const supabase = await crearClienteServidor();

  const { error } = await supabase
    .from("productos_servicios")
    .update({
      nombre: campos.nombre,
      sku: campos.sku,
      descripcion: campos.descripcion,
      precio: campos.precio,
      // Sin foto nueva se conserva la que había: subir una imagen y cambiar el
      // precio son dos gestos distintos y no tienen por qué ir juntos.
      ...(foto.ruta ? { imagen: foto.ruta } : {}),
    })
    .eq("id", productoId)
    .eq("marca_id", marcaId);

  if (error) return { error: "No se pudo guardar el producto." };

  revalidatePath("/negocio/panel/catalogo");
  redirect("/negocio/panel/catalogo?guardado=1");
}

/**
 * Saca un producto del catálogo y, con él, de todas las sucursales.
 *
 * Las filas de `productos_sucursal` se van solas por `on delete cascade`, que es
 * justo lo que se pidió: lo que se borra del catálogo desaparece de todos lados.
 * Lo que no se toca son las solicitudes de mazorcas ya cursadas — ahí el producto
 * es parte de un recibo, no del catálogo de hoy.
 */
export async function eliminarDelCatalogo(datos: FormData) {
  const marcaId = await miMarca();
  const productoId = datos.get("producto_id")?.toString() ?? "";

  const supabase = await crearClienteServidor();

  await supabase
    .from("productos_servicios")
    .delete()
    .eq("id", productoId)
    .eq("marca_id", marcaId);

  revalidatePath("/negocio/panel/catalogo");
  revalidatePath("/negocio/panel");
}

/**
 * Qué productos del catálogo maneja una sucursal.
 *
 * Se borra la selección anterior y se escribe la nueva en vez de calcular altas
 * y bajas: la lista completa es lo que la pantalla ya sabe, y comparar dos
 * conjuntos aquí solo abriría la puerta a que se queden desincronizados.
 */
export async function guardarSeleccion(
  _previo: EstadoCatalogo,
  datos: FormData,
): Promise<EstadoCatalogo> {
  const perfil = await perfilActual();
  if (!perfil) redirect("/login");
  if (perfil.rol !== "negocio") redirect("/cuenta");

  const sucursalId = datos.get("sucursal_id")?.toString() ?? "";
  const elegidos = datos.getAll("producto").map((v) => v.toString());

  const supabase = await crearClienteServidor();

  // Que la sucursal sea suya lo garantiza `productos_sucursal_escritura`; aquí
  // se comprueba antes para poder contestar con algo legible.
  const { data: propia } = await supabase
    .from("sucursales")
    .select("id, marcas!inner(perfil_id)")
    .eq("id", sucursalId)
    .eq("marcas.perfil_id", perfil.id)
    .maybeSingle();

  if (!propia) return { error: "Esa sucursal no es tuya." };

  const { error: errorBorrado } = await supabase
    .from("productos_sucursal")
    .delete()
    .eq("sucursal_id", sucursalId);

  if (errorBorrado) return { error: "No se pudo guardar la selección." };

  if (elegidos.length > 0) {
    const { error } = await supabase.from("productos_sucursal").insert(
      elegidos.map((producto_id) => ({ sucursal_id: sucursalId, producto_id })),
    );

    if (error) return { error: "No se pudo guardar la selección." };
  }

  revalidatePath(`/negocio/panel/sucursal/${sucursalId}`);
  revalidatePath("/negocio/panel");

  return {
    ok:
      elegidos.length === 0
        ? "Esta sucursal se quedó sin productos. Necesita al menos uno para publicarse."
        : `Listo: ${elegidos.length} ${elegidos.length === 1 ? "producto" : "productos"} en esta sucursal.`,
  };
}
