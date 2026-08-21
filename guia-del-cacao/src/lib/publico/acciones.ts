"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { perfilActual } from "@/lib/auth/sesion";

export type EstadoResena = { error?: string; ok?: string };

/**
 * Deja una reseña. Solo clientes: un negocio no reseña a otro.
 *
 * La regla de fondo la impone RLS —la política exige `usuario_id = auth.uid()`
 * y sucursal publicada—; aquí solo se traduce el fallo a algo legible.
 */
export async function dejarResena(
  _previo: EstadoResena,
  datos: FormData,
): Promise<EstadoResena> {
  const perfil = await perfilActual();
  const slug = datos.get("slug")?.toString() ?? "";

  if (!perfil) redirect(`/login?volver=/marca/${slug}`);
  if (perfil.rol !== "cliente") {
    return { error: "Solo las cuentas de cliente pueden dejar reseñas." };
  }

  const texto = (datos.get("texto")?.toString() ?? "").trim();
  const sucursalId = datos.get("sucursal_id")?.toString() ?? "";

  if (texto.length < 10) {
    return { error: "Escribe al menos unas palabras sobre tu visita." };
  }

  const supabase = await crearClienteServidor();

  const { error } = await supabase.from("resenas").insert({
    usuario_id: perfil.id,
    sucursal_id: sucursalId,
    texto,
  });

  if (error) return { error: "No se pudo publicar tu reseña. Inténtalo de nuevo." };

  revalidatePath(`/marca/${slug}`);
  return { ok: "Gracias, tu reseña ya está publicada." };
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
