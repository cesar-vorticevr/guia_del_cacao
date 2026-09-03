"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { perfilActual } from "@/lib/auth/sesion";
import { miSucursal } from "@/lib/datos/sucursales";
import { revisarImagen } from "@/lib/imagenes";

export type EstadoCupon = { error?: string; ok?: string };

/**
 * Publicar un cupón.
 *
 * El tope de diez vigentes lo cuenta la base (`tope_de_cupones`), que es la que
 * puede hacerlo sin que dos altas a la vez se cuelen las dos. Aquí se valida lo
 * que se escribió y se traduce su negativa.
 */
export async function crearCupon(
  _previo: EstadoCupon,
  datos: FormData,
): Promise<EstadoCupon> {
  const perfil = await perfilActual();

  if (!perfil) redirect("/login");
  if (perfil.rol !== "negocio") redirect("/cuenta");

  const sucursalId = datos.get("sucursal_id")?.toString() ?? "";

  // Que la sucursal sea suya se comprueba aquí y además en RLS.
  const sucursal = await miSucursal(perfil.id, sucursalId);
  if (!sucursal) return { error: "Elige una de tus sucursales." };

  const nombre = (datos.get("nombre")?.toString() ?? "").trim();
  const descripcion = (datos.get("descripcion")?.toString() ?? "").trim();
  const costo = Number(datos.get("costo_mazorcas"));
  const vigencia = datos.get("vigencia")?.toString() ?? "";

  if (nombre.length < 3)
    return { error: "Ponle un nombre de al menos 3 letras." };
  if (nombre.length > 80)
    return { error: "El nombre no puede pasar de 80 caracteres." };
  if (descripcion.length < 10) {
    return { error: "Explica un poco más de qué va la oferta." };
  }
  if (descripcion.length > 400) {
    return { error: "La descripción no puede pasar de 400 caracteres." };
  }
  if (!Number.isInteger(costo) || costo < 1 || costo > 999) {
    return { error: "El costo va de 1 a 999 mazorcas." };
  }
  if (!vigencia) return { error: "Elige hasta qué día sirve." };

  /*
    Una vigencia que ya pasó nace caducada: nadie puede canjearla y ocupa un
    hueco de los diez. Se compara con el día en Tabasco, no con el del servidor.
  */
  const hoy = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Mexico_City",
  });

  if (vigencia < hoy) {
    return { error: "Esa fecha ya pasó. Elige una de hoy en adelante." };
  }

  const supabase = await crearClienteServidor();

  // La foto es lo que se ve en el mercado: sin ella el cupón es un renglón de
  // texto entre otros nueve.
  const archivo = datos.get("imagen");
  const problema = revisarImagen(archivo);
  if (problema) return { error: problema };

  const imagen = archivo as File;
  const extension = imagen.name.split(".").pop()?.toLowerCase() ?? "jpg";
  // La política del bucket exige que la primera carpeta sea una sucursal suya.
  const ruta = `${sucursalId}/cupon-${Date.now()}.${extension}`;

  const { error: errorSubida } = await supabase.storage
    .from("micrositios")
    .upload(ruta, imagen);

  if (errorSubida) {
    return { error: "No se pudo subir la imagen. Inténtalo de nuevo." };
  }

  const { error } = await supabase.from("cupones").insert({
    sucursal_id: sucursalId,
    nombre,
    descripcion,
    costo_mazorcas: costo,
    vigencia,
    imagen: ruta,
  });

  if (error) {
    // La imagen ya subió: si el cupón no entra, se retira para no dejar
    // huérfanos en el bucket.
    await supabase.storage.from("micrositios").remove([ruta]);

    return {
      error: error.message.includes("10 cupones vigentes")
        ? "Ya tienes 10 cupones vigentes. Espera a que caduque alguno o borra uno."
        : "No se pudo publicar el cupón. Inténtalo de nuevo.",
    };
  }

  revalidatePath("/negocio/panel/mercado");
  return { ok: "Cupón publicado." };
}

/**
 * Borrar un cupón.
 *
 * Es la única salida: un cupón no se edita, porque alguien pudo canjearlo ya y
 * cambiarle el precio o la letra chica después sería cambiarle el trato a quien
 * pagó. Se borra y se hace otro.
 */
export async function borrarCupon(datos: FormData) {
  const perfil = await perfilActual();

  if (!perfil) redirect("/login");
  if (perfil.rol !== "negocio") redirect("/cuenta");

  const id = datos.get("cupon_id")?.toString() ?? "";
  const supabase = await crearClienteServidor();

  // La imagen se va con él: dejarla sería basura en el bucket que nadie
  // volverá a mirar.
  const { data: cupon } = await supabase
    .from("cupones")
    .select("imagen")
    .eq("id", id)
    .maybeSingle();

  // Quién puede borrarlo lo decide RLS: la política pide `posee_sucursal`.
  await supabase.from("cupones").delete().eq("id", id);

  if (cupon?.imagen) {
    await supabase.storage.from("micrositios").remove([cupon.imagen]);
  }

  revalidatePath("/negocio/panel/mercado");
}
