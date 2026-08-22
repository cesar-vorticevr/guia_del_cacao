"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { perfilActual } from "@/lib/auth/sesion";
import { miCalificacion, miResena } from "@/lib/datos/publico";
import { BUCKET_RESENAS, revisarMedio } from "@/lib/imagenes";

export type EstadoResena = { error?: string; ok?: string };

/**
 * Reseñar: la calificación y el comentario, en un solo envío.
 *
 * Van juntos porque es un solo acto —"cómo me fue en este negocio"— y desde la
 * migración 000017 los dos se **actualizan**: cada quien tiene una calificación
 * y una reseña por negocio, no una colección. Lo que se lee en el micrositio es
 * lo que la gente piensa hoy, no un historial de visitas.
 *
 * Cambiarlas cuesta el mismo tope que pedir monedas: una vez al día. Ese tope
 * lo imponen los triggers `limitar_cambio_de_*`; aquí solo se traduce.
 */
export async function publicarResena(
  _previo: EstadoResena,
  datos: FormData,
): Promise<EstadoResena> {
  const perfil = await perfilActual();
  const slug = datos.get("slug")?.toString() ?? "";

  if (!perfil) redirect(`/login?volver=/marca/${slug}`);
  if (perfil.rol !== "cliente") {
    return { error: "Solo las cuentas de cliente pueden reseñar." };
  }

  const sucursalId = datos.get("sucursal_id")?.toString() ?? "";

  const [estrellasActuales, resenaActual] = await Promise.all([
    miCalificacion(perfil.id, sucursalId),
    miResena(perfil.id, sucursalId),
  ]);

  const estrellas = Number(datos.get("estrellas"));
  const texto = (datos.get("texto")?.toString() ?? "").trim();

  if (!Number.isInteger(estrellas) || estrellas < 1 || estrellas > 5) {
    return { error: "Elige de 1 a 5 estrellas." };
  }

  if (texto.length < 10) {
    return { error: "Escribe al menos unas palabras sobre tu visita." };
  }

  const supabase = await crearClienteServidor();

  // Las estrellas primero: son lo que alimenta el promedio, y si el comentario
  // falla después al menos la nota quedó y se dice claramente.
  const cambiaLaNota = estrellasActuales !== estrellas;

  if (estrellasActuales === null) {
    const { error } = await supabase.from("calificaciones").insert({
      usuario_id: perfil.id,
      sucursal_id: sucursalId,
      estrellas,
    });

    // 23505 es la llave duplicada: mandaron el formulario dos veces seguidas.
    if (error && error.code !== "23505") {
      return { error: "No se pudo guardar tu calificación. Inténtalo de nuevo." };
    }
  } else if (cambiaLaNota) {
    const { error } = await supabase
      .from("calificaciones")
      .update({ estrellas })
      .eq("usuario_id", perfil.id)
      .eq("sucursal_id", sucursalId);

    if (error) {
      return {
        error: error.message.includes("hoy en este negocio")
          ? "Ya cambiaste tu calificación hoy. Puedes volver a hacerlo mañana."
          : "No se pudo cambiar tu calificación.",
      };
    }
  }

  // El medio es opcional: un campo de archivo vacío llega como un File de 0
  // bytes, no como null, así que se mira el tamaño y no la existencia.
  const archivo = datos.get("medio");
  let medio: string | null = null;

  if (archivo instanceof File && archivo.size > 0) {
    const problema = revisarMedio(archivo);
    if (problema) return { error: problema };

    const extension = archivo.name.split(".").pop()?.toLowerCase() ?? "jpg";
    // La política de storage exige que la primera carpeta sea la de quien sube.
    const ruta = `${perfil.id}/${sucursalId}-${Date.now()}.${extension}`;

    const { error } = await supabase.storage.from(BUCKET_RESENAS).upload(ruta, archivo);

    if (error) return { error: "No se pudo subir la foto o el video." };

    medio = ruta;
  }

  const cambiaElTexto = resenaActual?.texto !== texto;

  if (!resenaActual) {
    const { error } = await supabase.from("resenas").insert({
      usuario_id: perfil.id,
      sucursal_id: sucursalId,
      texto,
      foto: medio,
    });

    if (error) {
      // Sin esto quedaría un archivo huérfano en el bucket cada vez que falla.
      if (medio) await supabase.storage.from(BUCKET_RESENAS).remove([medio]);
      return { error: "No se pudo publicar tu reseña. Inténtalo de nuevo." };
    }

    revalidatePath(`/marca/${slug}`);
    return { ok: "Gracias, ya quedaron tu calificación y tu reseña." };
  }

  if (!cambiaElTexto && !medio) {
    revalidatePath(`/marca/${slug}`);
    return { ok: cambiaLaNota ? "Actualizamos tu calificación." : "No cambiaste nada." };
  }

  const { error } = await supabase
    .from("resenas")
    .update({ texto, ...(medio ? { foto: medio } : {}) })
    .eq("id", resenaActual.id)
    .eq("usuario_id", perfil.id);

  if (error) {
    if (medio) await supabase.storage.from(BUCKET_RESENAS).remove([medio]);

    return {
      error: error.message.includes("hoy en este negocio")
        ? "Ya cambiaste tu reseña hoy. Puedes volver a hacerlo mañana."
        : "No se pudo guardar tu reseña.",
    };
  }

  // El medio anterior ya no lo referencia nadie: se va con el que reemplazó.
  if (medio && resenaActual.foto) {
    await supabase.storage.from(BUCKET_RESENAS).remove([resenaActual.foto]);
  }

  revalidatePath(`/marca/${slug}`);
  return { ok: "Listo, actualizamos tu reseña." };
}

/**
 * Respuesta pública de la marca.
 *
 * Solo puede responder, no editar el texto ajeno: eso lo impide el trigger
 * proteger_resena en la base, no esta función.
 */
export async function responderResena(
  _previo: EstadoResena,
  datos: FormData,
): Promise<EstadoResena> {
  const perfil = await perfilActual();
  const slug = datos.get("slug")?.toString() ?? "";

  if (!perfil) redirect("/login");
  if (perfil.rol !== "negocio") {
    return { error: "Solo el negocio puede responder una reseña." };
  }

  const respuesta = (datos.get("respuesta")?.toString() ?? "").trim();
  const resenaId = datos.get("resena_id")?.toString() ?? "";

  if (!respuesta) return { error: "Escribe tu respuesta." };

  const supabase = await crearClienteServidor();

  const { error } = await supabase
    .from("resenas")
    .update({ respuesta_marca: respuesta })
    .eq("id", resenaId);

  if (error) return { error: "No se pudo publicar la respuesta." };

  revalidatePath(`/marca/${slug}`);
  return { ok: "Respuesta publicada." };
}
