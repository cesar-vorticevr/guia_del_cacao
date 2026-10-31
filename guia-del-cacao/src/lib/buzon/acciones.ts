"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { perfilActual } from "@/lib/auth/sesion";
import { esMotivoDeMensaje, LARGO_DE_MENSAJE } from "@/lib/buzon/textos";
import { crearClienteServidor } from "@/lib/supabase/server";

export type EstadoBuzon = { error?: string; ok?: string; texto?: string };

async function exigirSesion(volver = "/buzon") {
  const perfil = await perfilActual();
  if (!perfil) redirect(`/login?volver=${encodeURIComponent(volver)}`);
  return perfil;
}

/** Los errores de la base que traen su propia explicación (P0001) se dicen tal cual. */
function explicar(error: { code?: string; message: string } | null, otro: string) {
  if (!error) return null;
  return error.code === "P0001" ? error.message : otro;
}

/**
 * Abre (o retoma) la conversación con una cuenta y lleva a ella. A quién se
 * le puede escribir lo decide `abrir_conversacion` en la base.
 */
export async function abrirConversacion(datos: FormData) {
  await exigirSesion();

  const destino = datos.get("destino")?.toString() ?? "";
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("abrir_conversacion", { p_destino: destino });

  if (error || !data) {
    const motivo = explicar(error, "No se pudo abrir la conversación.");
    redirect(`/buzon?nuevo=1&error=${encodeURIComponent(motivo ?? "No se pudo abrir la conversación.")}`);
  }

  redirect(`/buzon/${data}`);
}

/** «Escribir al negocio» desde un micrositio: le escribe al dueño de la marca. */
export async function escribirAMarca(datos: FormData) {
  const slug = datos.get("slug")?.toString() ?? "";
  await exigirSesion(slug ? `/marca/${slug}` : "/buzon");

  const marca = datos.get("marca_id")?.toString() ?? "";
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("abrir_conversacion_con_marca", { p_marca: marca });

  if (error || !data) {
    const motivo = explicar(error, "No se pudo abrir la conversación.");
    redirect(`/buzon?error=${encodeURIComponent(motivo ?? "No se pudo abrir la conversación.")}`);
  }

  redirect(`/buzon/${data}`);
}

/**
 * Manda un mensaje. Quien escribe y la hora los pone la base; la política
 * exige que sea una de las dos partes.
 *
 * Si falla, devuelve el texto: React 19 vacía el formulario al terminar la
 * acción, y perder lo escrito por un tropiezo de la red es lo que más molesta.
 */
export async function enviarMensaje(
  _previo: EstadoBuzon,
  datos: FormData,
): Promise<EstadoBuzon> {
  const perfil = await exigirSesion();

  const conversacion = datos.get("conversacion_id")?.toString() ?? "";
  const texto = (datos.get("texto")?.toString() ?? "").trim();

  if (!texto) return { error: "Escribe algo antes de mandar.", texto };
  if (texto.length > LARGO_DE_MENSAJE) {
    return { error: `Un mensaje lleva hasta ${LARGO_DE_MENSAJE} letras.`, texto };
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("mensajes")
    .insert({ conversacion_id: conversacion, autor_id: perfil.id, texto });

  if (error) {
    return {
      error:
        error.code === "42501"
          ? "En esta conversación no puedes escribir."
          : (explicar(error, "No se pudo mandar. Inténtalo de nuevo.") ?? undefined),
      texto,
    };
  }

  revalidatePath(`/buzon/${conversacion}`);
  revalidatePath("/buzon");
  return { ok: "Enviado" };
}

/** Reporta un mensaje (o la conversación entera) al administrador. */
export async function reportarEnBuzon(
  _previo: EstadoBuzon,
  datos: FormData,
): Promise<EstadoBuzon> {
  const perfil = await exigirSesion();

  const conversacion = datos.get("conversacion_id")?.toString() ?? "";
  const mensaje = datos.get("mensaje_id")?.toString() || null;
  const motivo = datos.get("motivo")?.toString() ?? "";
  const detalle = (datos.get("detalle")?.toString() ?? "").trim().slice(0, 500);

  if (!esMotivoDeMensaje(motivo)) return { error: "Elige por qué lo reportas." };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("reportes_conversacion").insert({
    conversacion_id: conversacion,
    mensaje_id: mensaje,
    usuario_id: perfil.id,
    motivo,
    detalle: detalle || null,
  });

  // 23505: ya lo había reportado y sigue pendiente. Para quien lo manda es lo mismo.
  if (error && error.code !== "23505") {
    return { error: explicar(error, "No se pudo enviar el reporte. Inténtalo de nuevo.") ?? undefined };
  }

  revalidatePath("/admin/moderacion");
  return { ok: "Gracias. La administración lo revisa; la otra persona no sabe que lo reportaste." };
}

/** El administrador da por revisados los reportes de una conversación. */
export async function atenderReportesDeConversacion(datos: FormData) {
  const perfil = await exigirSesion();
  if (perfil.rol !== "admin") redirect("/buzon");

  const conversacion = datos.get("conversacion_id")?.toString() ?? "";
  const supabase = await crearClienteServidor();
  await supabase.rpc("atender_reportes_de_conversacion", { p_conversacion: conversacion });

  revalidatePath("/admin/moderacion");
  revalidatePath("/admin");
}

/** El negocio enciende o apaga el aviso de mensajes nuevos en su cuenta. */
export async function guardarAvisoDeMensajes(datos: FormData) {
  const perfil = await exigirSesion();

  const supabase = await crearClienteServidor();
  await supabase
    .from("perfiles")
    .update({ avisar_mensajes: datos.get("avisar_mensajes") === "on" })
    .eq("id", perfil.id);

  revalidatePath("/negocio/panel/cuenta");
  revalidatePath("/negocio/panel");
}
