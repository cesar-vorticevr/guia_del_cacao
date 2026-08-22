"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { perfilActual } from "@/lib/auth/sesion";
import { comentoHoy, miCalificacion } from "@/lib/datos/publico";
import { BUCKET_RESENAS, revisarImagen } from "@/lib/imagenes";

export type EstadoResena = { error?: string; ok?: string };

/**
 * Reseñar: la calificación y el comentario, en un solo envío.
 *
 * Van juntos porque es un solo acto —"cómo me fue en este negocio"— aunque por
 * debajo sean dos tablas con dos reglas distintas: las estrellas se dan una vez
 * y para siempre; el comentario, una vez al día. De ahí que el formulario
 * cambie de forma según lo que ya hiciste, en vez de pedirte dos veces lo
 * mismo.
 *
 * Qué te falta por hacer se decide aquí, contra la base, y no con lo que mande
 * el formulario: un campo oculto se edita, la consulta no.
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

  const [yaCalifico, yaComento] = await Promise.all([
    miCalificacion(perfil.id, sucursalId),
    comentoHoy(perfil.id, sucursalId),
  ]);

  const estrellas = Number(datos.get("estrellas"));
  const texto = (datos.get("texto")?.toString() ?? "").trim();

  const faltaCalificar = yaCalifico === null;
  const faltaComentar = !yaComento;

  if (!faltaCalificar && !faltaComentar) {
    return { error: "Ya calificaste este negocio y ya comentaste hoy." };
  }

  if (faltaCalificar && (!Number.isInteger(estrellas) || estrellas < 1 || estrellas > 5)) {
    return { error: "Elige de 1 a 5 estrellas." };
  }

  if (faltaComentar && texto.length < 10) {
    return { error: "Escribe al menos unas palabras sobre tu visita." };
  }

  const supabase = await crearClienteServidor();

  // La calificación primero: es la que no se puede repetir nunca. Si el
  // comentario falla después, al menos el voto quedó y se dice claramente.
  if (faltaCalificar) {
    const { error } = await supabase.from("calificaciones").insert({
      usuario_id: perfil.id,
      sucursal_id: sucursalId,
      estrellas,
    });

    // 23505 es la llave duplicada: alguien mandó el formulario dos veces
    // seguidas. No es un fallo, es la regla funcionando.
    if (error && error.code !== "23505") {
      return { error: "No se pudo guardar tu calificación. Inténtalo de nuevo." };
    }
  }

  if (!faltaComentar) {
    revalidatePath(`/marca/${slug}`);
    return { ok: "Gracias, ya quedó tu calificación. El comentario, mañana." };
  }

  // La foto es opcional: un campo de archivo vacío llega como un File de 0
  // bytes, no como null, así que se mira el tamaño y no la existencia.
  const archivo = datos.get("foto");
  let foto: string | null = null;

  if (archivo instanceof File && archivo.size > 0) {
    const problema = revisarImagen(archivo);
    if (problema) return { error: problema };

    const extension = archivo.name.split(".").pop()?.toLowerCase() ?? "jpg";
    // La política de storage exige que la primera carpeta sea la de quien sube.
    const ruta = `${perfil.id}/${sucursalId}-${Date.now()}.${extension}`;

    const { error: errorSubida } = await supabase.storage
      .from(BUCKET_RESENAS)
      .upload(ruta, archivo);

    if (errorSubida) {
      return { error: "No se pudo subir la foto. Inténtalo de nuevo." };
    }

    foto = ruta;
  }

  const { error } = await supabase.from("resenas").insert({
    usuario_id: perfil.id,
    sucursal_id: sucursalId,
    texto,
    foto,
  });

  if (error) {
    // La foto ya está arriba y la reseña no entró: sin esto quedaría una
    // imagen huérfana en el bucket cada vez que alguien topa con el límite.
    if (foto) await supabase.storage.from(BUCKET_RESENAS).remove([foto]);

    if (error.message.includes("maximo 1 por dia")) {
      return {
        error: faltaCalificar
          ? "Tu calificación quedó, pero ya habías comentado hoy en este negocio."
          : "Ya dejaste un comentario hoy en este negocio. Vuelve mañana.",
      };
    }

    return { error: "No se pudo publicar tu reseña. Inténtalo de nuevo." };
  }

  revalidatePath(`/marca/${slug}`);

  return {
    ok: faltaCalificar
      ? "Gracias, ya quedaron tu calificación y tu reseña."
      : "Gracias, tu reseña ya está publicada.",
  };
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
