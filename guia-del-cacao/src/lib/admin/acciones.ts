"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { perfilActual } from "@/lib/auth/sesion";

export type EstadoAccion = { error?: string; ok?: string };

async function exigirAdmin() {
  const perfil = await perfilActual();

  if (!perfil) redirect("/login");
  if (perfil.rol !== "admin") redirect("/cuenta");

  return perfil;
}

/**
 * Aprueba un micrositio y lo saca al directorio.
 *
 * Turismo no participa en esta decisión (spec §3.3): es exclusiva del
 * administrador. Quien lo garantiza es el trigger proteger_estado_sucursal, no
 * esta función.
 */
export async function aprobarSucursal(datos: FormData) {
  await exigirAdmin();

  const id = datos.get("sucursal_id")?.toString() ?? "";
  const supabase = await crearClienteServidor();

  await supabase
    .from("sucursales")
    .update({ estado: "publicado", motivo_rechazo: null })
    .eq("id", id);

  revalidatePath("/admin");
}

export async function rechazarSucursal(
  _previo: EstadoAccion,
  datos: FormData,
): Promise<EstadoAccion> {
  await exigirAdmin();

  const id = datos.get("sucursal_id")?.toString() ?? "";
  const motivo = (datos.get("motivo")?.toString() ?? "").trim();

  if (!motivo) {
    return { error: "Escribe el motivo: el negocio necesita saber qué corregir." };
  }

  const supabase = await crearClienteServidor();

  const { error } = await supabase
    .from("sucursales")
    .update({ estado: "rechazado", motivo_rechazo: motivo })
    .eq("id", id);

  if (error) return { error: "No se pudo rechazar." };

  revalidatePath("/admin");
  return { ok: "Micrositio rechazado." };
}

// ---------------------------------------------------------------------------
// Moderacion
// ---------------------------------------------------------------------------

/**
 * Saca un micrositio del directorio sin borrarlo.
 *
 * Queda marcado como pausa de moderacion, asi que el negocio no puede
 * reactivarlo por su cuenta; eso lo decide el trigger de la base con la
 * columna pausado_por_admin, no esta funcion.
 */
export async function pausarSucursal(datos: FormData) {
  await exigirAdmin();

  const id = datos.get("sucursal_id")?.toString() ?? "";
  const supabase = await crearClienteServidor();

  await supabase.from("sucursales").update({ estado: "pausado" }).eq("id", id);

  revalidatePath("/admin/micrositios");
  revalidatePath("/directorio");
}

export async function reactivarSucursal(datos: FormData) {
  await exigirAdmin();

  const id = datos.get("sucursal_id")?.toString() ?? "";
  const supabase = await crearClienteServidor();

  await supabase.from("sucursales").update({ estado: "publicado" }).eq("id", id);

  revalidatePath("/admin/micrositios");
  revalidatePath("/directorio");
}

/**
 * Borra una resena.
 *
 * Se borra en vez de ocultarse: si algo amerita moderacion es porque no deberia
 * existir, y guardar el texto "por si acaso" solo alarga el tiempo que un
 * insulto o un dato personal siguen en la base.
 */
export async function eliminarResena(datos: FormData) {
  await exigirAdmin();

  const id = datos.get("resena_id")?.toString() ?? "";
  const supabase = await crearClienteServidor();

  await supabase.from("resenas").delete().eq("id", id);

  revalidatePath("/admin/moderacion");
}

export async function eliminarPublicacion(datos: FormData) {
  await exigirAdmin();

  const id = datos.get("publicacion_id")?.toString() ?? "";
  const tipo = datos.get("tipo")?.toString();

  if (tipo !== "eventos" && tipo !== "noticias") return;

  const supabase = await crearClienteServidor();
  await supabase.from(tipo).delete().eq("id", id);

  revalidatePath("/admin/moderacion");
  revalidatePath(`/${tipo}`);
}

/**
 * Cambia el rol de una persona.
 *
 * Es la unica via para crear un administrador: el registro publico nunca lo
 * acepta (spec §2). El trigger proteger_rol vuelve a comprobar que quien lo
 * pide sea admin.
 */
export async function cambiarRol(
  _previo: EstadoAccion,
  datos: FormData,
): Promise<EstadoAccion> {
  const yo = await exigirAdmin();

  const perfilId = datos.get("perfil_id")?.toString() ?? "";
  const rol = datos.get("rol")?.toString() ?? "";

  if (!["cliente", "negocio", "admin"].includes(rol)) {
    return { error: "Rol no reconocido." };
  }

  // Quitarse a uno mismo el rol de admin deja el panel sin quien lo atienda, y
  // si no hay otro administrador ya no habria como recuperarlo.
  if (perfilId === yo.id && rol !== "admin") {
    return { error: "No puedes quitarte a ti mismo el rol de administrador." };
  }

  const supabase = await crearClienteServidor();

  const { error } = await supabase
    .from("perfiles")
    .update({ rol })
    .eq("id", perfilId);

  if (error) return { error: "No se pudo cambiar el rol." };

  revalidatePath("/admin/usuarios");
  return { ok: "Rol actualizado." };
}
