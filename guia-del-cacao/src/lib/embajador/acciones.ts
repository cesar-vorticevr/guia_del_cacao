"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { perfilActual } from "@/lib/auth/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { ETAPAS, type EtapaDeProspecto } from "@/lib/ventas";

export type EstadoEmbajador = { error?: string; ok?: string };

/**
 * Las acciones del panel de ventas (`/ventas`). Nadie pide ser vendedor: la
 * cuenta la crea el administrador (migración 000067). Aquí el vendedor solo
 * corrige su nombre, deja su CLABE y lleva su libreta. Lo demás —código,
 * estado, vigencia, correo y contraseña— es del administrador.
 */

async function exigirSesion() {
  const perfil = await perfilActual();
  if (!perfil) redirect("/login?volver=/ventas");
  return perfil;
}

/** El nombre con el que aparece: lo único de su cuenta que el vendedor edita. */
export async function guardarMiNombre(
  _previo: EstadoEmbajador,
  datos: FormData,
): Promise<EstadoEmbajador> {
  const perfil = await exigirSesion();
  const nombre = (datos.get("nombre")?.toString() ?? "").trim().slice(0, 80);
  if (nombre.length < 2) return { error: "Escribe tu nombre." };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("perfiles").update({ nombre }).eq("id", perfil.id);
  if (error) return { error: "No se pudo guardar tu nombre. Inténtalo de nuevo." };

  revalidatePath("/ventas");
  return { ok: "Nombre guardado." };
}

/**
 * La cuenta donde el vendedor recibe sus comisiones. La CLABE se pide con sus
 * 18 dígitos: con una de menos, la transferencia rebota y nadie sabe por qué.
 */
export async function guardarDatosDeCobro(
  _previo: EstadoEmbajador,
  datos: FormData,
): Promise<EstadoEmbajador> {
  const perfil = await exigirSesion();

  const titular = (datos.get("titular")?.toString() ?? "").trim().slice(0, 120);
  const banco = (datos.get("banco")?.toString() ?? "").trim().slice(0, 60);
  const clabe = (datos.get("clabe")?.toString() ?? "").replace(/\D/g, "");

  if (!titular) return { error: "Escribe a nombre de quién está la cuenta." };
  if (clabe.length !== 18) {
    return { error: "La CLABE lleva 18 dígitos. Revisa que no falte ninguno." };
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("embajadores")
    .update({ titular, banco: banco || null, clabe })
    .eq("perfil_id", perfil.id);

  if (error) return { error: "No se pudieron guardar tus datos. Inténtalo de nuevo." };

  revalidatePath("/ventas");
  return { ok: "Datos de cobro guardados." };
}

function texto(datos: FormData, campo: string, limite: number) {
  const valor = (datos.get(campo)?.toString() ?? "").trim().slice(0, limite);
  return valor || null;
}

function etapaDe(datos: FormData): EtapaDeProspecto {
  const valor = datos.get("etapa")?.toString();
  return ETAPAS.some((e) => e.valor === valor) ? (valor as EtapaDeProspecto) : "por_contactar";
}

/**
 * Apuntar un negocio en la libreta, o corregirlo si trae `id`. La política
 * de la base comprueba que la libreta sea suya y que siga siendo vendedor.
 */
export async function guardarProspecto(
  _previo: EstadoEmbajador,
  datos: FormData,
): Promise<EstadoEmbajador> {
  const perfil = await exigirSesion();

  const negocio = texto(datos, "negocio", 120);
  if (!negocio) return { error: "Escribe el nombre del negocio." };

  const siguiente = datos.get("siguiente_en")?.toString() ?? "";
  const fila = {
    negocio,
    contacto: texto(datos, "contacto", 120),
    telefono: texto(datos, "telefono", 30),
    ciudad: texto(datos, "ciudad", 80),
    nota: texto(datos, "nota", 1000),
    etapa: etapaDe(datos),
    siguiente_en: /^\d{4}-\d{2}-\d{2}$/.test(siguiente) ? siguiente : null,
  };

  const id = datos.get("id")?.toString();
  const supabase = await crearClienteServidor();
  const { error } = id
    ? await supabase.from("prospectos").update(fila).eq("id", id).eq("embajador_id", perfil.id)
    : await supabase.from("prospectos").insert({ ...fila, embajador_id: perfil.id });

  if (error) return { error: "No se pudo guardar. Inténtalo de nuevo." };

  revalidatePath("/ventas");
  return { ok: id ? "Cambios guardados." : `${negocio} quedó en tu libreta.` };
}

/** Mover un prospecto de etapa con un solo toque, desde la lista. */
export async function cambiarEtapa(datos: FormData) {
  const perfil = await exigirSesion();
  const id = datos.get("id")?.toString() ?? "";

  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("prospectos")
    .update({ etapa: etapaDe(datos) })
    .eq("id", id)
    .eq("embajador_id", perfil.id);

  if (error) console.error("No se pudo cambiar la etapa:", error);
  revalidatePath("/ventas");
}

export async function borrarProspecto(datos: FormData) {
  const perfil = await exigirSesion();
  const id = datos.get("id")?.toString() ?? "";

  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("prospectos").delete().eq("id", id).eq("embajador_id", perfil.id);

  if (error) console.error("No se pudo borrar el prospecto:", error);
  revalidatePath("/ventas");
}
