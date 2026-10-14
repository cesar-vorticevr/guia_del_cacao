"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { perfilActual } from "@/lib/auth/sesion";
import { normalizarCodigo } from "@/lib/tipos";

export type EstadoAccion = { error?: string; ok?: string };

async function exigirAdmin() {
  const perfil = await perfilActual();

  if (!perfil) redirect("/login");
  if (perfil.rol !== "admin") redirect("/cuenta");

  return perfil;
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

  revalidatePath("/admin");
  revalidatePath("/admin/moderacion");
}

/**
 * Descarta los reportes de una reseña y la deja publicada: se revisó y no
 * amerita borrarse. Si la vuelven a reportar, vuelve a la cola.
 */
export async function descartarReportes(datos: FormData) {
  await exigirAdmin();

  const id = datos.get("resena_id")?.toString() ?? "";
  const supabase = await crearClienteServidor();

  await supabase.from("reportes_resena").delete().eq("resena_id", id);

  revalidatePath("/admin");
  revalidatePath("/admin/moderacion");
}

export async function eliminarPublicacion(datos: FormData) {
  await exigirAdmin();

  const id = datos.get("publicacion_id")?.toString() ?? "";
  const tipo = datos.get("tipo")?.toString();

  // `noticias` quedó en desuso con la migración 000029: lo de la comunidad
  // vive en `publicaciones`.
  if (tipo !== "eventos" && tipo !== "publicaciones") return;

  const supabase = await crearClienteServidor();
  await supabase.from(tipo).delete().eq("id", id);

  revalidatePath("/admin/moderacion");
  revalidatePath(tipo === "eventos" ? "/eventos" : "/comunidad");
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

/**
 * Da de alta un código de promoción: qué plan da, con cuánto descuento (100 =
 * gratis), hasta cuándo dura y cuántas veces se puede usar.
 *
 * El código se guarda sin espacios ni guiones y en mayúsculas, igual que como
 * lo compara la base: «Festival Chocolate» y «festival-chocolate» son el mismo.
 */
export async function crearConvenio(
  _previo: EstadoAccion,
  datos: FormData,
): Promise<EstadoAccion> {
  await exigirAdmin();

  const codigo = normalizarCodigo(datos.get("codigo")?.toString() ?? "");
  const descripcion = datos.get("descripcion")?.toString().trim() ?? "";
  const desde = datos.get("vigente_desde")?.toString() ?? "";
  const hasta = datos.get("vigente_hasta")?.toString() ?? "";
  const descuento = Number(datos.get("descuento")?.toString() || 0);
  const planId = Number(datos.get("plan_id")?.toString() || 0) || null;
  const cubreHasta = datos.get("cubre_hasta")?.toString() || null;
  const usos = Number(datos.get("usos_maximos")?.toString() || 0);

  if (!codigo) return { error: "Escribe el código, solo letras y números." };
  if (!descripcion) return { error: "Escribe para qué es el código." };
  if (!desde || !hasta) return { error: "Elige desde y hasta cuándo sirve." };
  if (hasta < desde) return { error: "La fecha final va después de la inicial." };
  if (!Number.isInteger(usos) || usos < 1) {
    return { error: "Di cuántos negocios pueden usar el código: 1 o más." };
  }
  if (!planId) return { error: "Elige qué plan da el código." };
  if (!Number.isInteger(descuento) || descuento < 1 || descuento > 100) {
    return { error: "El descuento va de 1 a 100 (100 es gratis)." };
  }
  if (!cubreHasta) return { error: "Elige hasta cuándo dura la promoción." };
  if (cubreHasta < hasta) {
    return {
      error:
        "La promoción tiene que durar al menos hasta el último día en que se puede usar el código.",
    };
  }

  const supabase = await crearClienteServidor();

  const { error } = await supabase.from("convenios").insert({
    codigo,
    descripcion,
    vigente_desde: desde,
    vigente_hasta: hasta,
    descuento,
    plan_id: planId,
    cubre_hasta: cubreHasta,
    usos_maximos: usos,
  });

  if (error) {
    return {
      error:
        error.code === "23505"
          ? `Ya existe el código ${codigo}.`
          : "No se pudo crear el código.",
    };
  }

  revalidatePath("/admin/convenios");
  return { ok: `Listo: ${codigo} ya funciona en sus fechas, para ${usos} negocios.` };
}
