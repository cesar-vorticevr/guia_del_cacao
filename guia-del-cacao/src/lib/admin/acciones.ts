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
