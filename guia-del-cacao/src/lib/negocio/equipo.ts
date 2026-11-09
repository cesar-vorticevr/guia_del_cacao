"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { marcaActiva } from "@/lib/negocio/marca-activa";

/**
 * Compartir, quitar, ceder y dejar un negocio (cuentas compartidas, fase 3).
 *
 * Todo pasa por las funciones de la migración 000079, que deciden quién puede
 * qué y contestan en español: aquí solo se elige sobre qué marca —la activa— y
 * se traduce lo que no venga ya traducido.
 */

export type EstadoEquipo = { error?: string; ok?: string };

function explicar(error: { code?: string; message: string }) {
  return error.code === "P0001" ? error.message : "No se pudo completar. Inténtalo de nuevo.";
}

/**
 * Quien se queda sin negocios cae en /negocio/completar-marca, que crea la
 * marca sola con el nombre que se escribió al registrarse (si lo hay). Después
 * de ceder o dejar un negocio eso lo volvería a crear: se borra ese recuerdo.
 */
async function olvidarAltaInicial() {
  const supabase = await crearClienteServidor();
  await supabase.auth.updateUser({ data: { nombre_comercial: null, categoria_id: null } });
}

async function marcaOSalir() {
  const marca = await marcaActiva();
  if (!marca) redirect("/negocio/completar-marca");
  return marca;
}

export async function compartirNegocio(_previo: EstadoEquipo, datos: FormData): Promise<EstadoEquipo> {
  const marca = await marcaOSalir();
  const usuario = (datos.get("usuario")?.toString() ?? "").trim();
  if (!usuario) return { error: "Escribe el @usuario de la persona." };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("compartir_marca", { p_marca: marca.marca_id, p_usuario: usuario });
  if (error) return { error: explicar(error) };

  revalidatePath("/negocio/panel/equipo");
  return { ok: `Listo: @${usuario.replace(/^@+/, "").toLowerCase()} ya administra ${marca.nombre_comercial}.` };
}

export async function quitarAdministrador(datos: FormData) {
  const marca = await marcaOSalir();
  const perfilId = datos.get("perfil_id")?.toString() ?? "";

  const supabase = await crearClienteServidor();
  await supabase.rpc("quitar_administrador", { p_marca: marca.marca_id, p_perfil: perfilId });
  revalidatePath("/negocio/panel/equipo");
}

export async function cederNegocio(_previo: EstadoEquipo, datos: FormData): Promise<EstadoEquipo> {
  const marca = await marcaOSalir();
  const usuario = (datos.get("usuario")?.toString() ?? "").trim();
  const quedarme = datos.get("quedarme") === "on";
  if (!usuario) return { error: "Escribe el @usuario de quien recibe el negocio." };
  if (datos.get("confirmo") !== "on") {
    return { error: "Marca la casilla para confirmar: ceder no se deshace desde tu cuenta." };
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("ceder_marca", {
    p_marca: marca.marca_id,
    p_usuario: usuario,
    p_quedarme: quedarme,
  });
  if (error) return { error: explicar(error) };

  revalidatePath("/negocio/panel", "layout");
  if (!quedarme) {
    await olvidarAltaInicial();
    redirect("/negocio/panel");
  }
  return { ok: `${marca.nombre_comercial} ahora es de @${usuario.replace(/^@+/, "").toLowerCase()}. Tú sigues como administrador.` };
}

export async function dejarNegocio(): Promise<EstadoEquipo> {
  const marca = await marcaOSalir();

  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("dejar_marca", { p_marca: marca.marca_id });
  if (error) return { error: explicar(error) };

  await olvidarAltaInicial();
  revalidatePath("/negocio/panel", "layout");
  redirect("/negocio/panel");
}
