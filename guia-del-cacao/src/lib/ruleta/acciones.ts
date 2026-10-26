"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { perfilActual } from "@/lib/auth/sesion";
import { miSucursal } from "@/lib/datos/sucursales";
import { crearClienteServidor } from "@/lib/supabase/server";

/**
 * Lo que se hace con la Ruleta Mágica (migración 000060): girarla, armarla y
 * canjear lo que se ganó. Las reglas —quién gira, cada cuánto, qué premio
 * sale— viven en la base; aquí solo se llaman y se traducen los errores.
 */

export type ResultadoDeGiro =
  | { orden: number; premio: string; codigo: string; venceEn: string }
  | { error: string; entrar?: boolean };

/** Girar. El premio lo decide `girar_ruleta`; el navegador solo lo anima. */
export async function girarRuleta(sucursalId: string): Promise<ResultadoDeGiro> {
  const perfil = await perfilActual();
  if (!perfil) return { error: "Inicia sesión para girar la ruleta.", entrar: true };

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("girar_ruleta", { p_sucursal: sucursalId });

  if (error) {
    return {
      error: error.code === "P0001" ? error.message : "La ruleta se atoró. Inténtalo de nuevo.",
    };
  }

  const fila = (data as { orden: number; premio: string; codigo: string; vence_en: string }[])[0];
  revalidatePath("/cuenta");
  return {
    orden: Number(fila.orden),
    premio: fila.premio,
    codigo: fila.codigo,
    venceEn: fila.vence_en,
  };
}

export type EstadoRuleta = { error?: string; ok?: string };

async function exigirNegocio() {
  const perfil = await perfilActual();
  if (!perfil) redirect("/login");
  if (perfil.rol !== "negocio") redirect("/cuenta");
  return perfil;
}

/**
 * Guardar la ruleta de una sucursal: si está encendida, cada cuánto se gira,
 * cuántos días vale lo que se gana y sus premios. Las probabilidades suman
 * cien para que se lean como porcentajes, que es como las entiende cualquiera.
 */
export async function guardarRuleta(
  _previo: EstadoRuleta,
  datos: FormData,
): Promise<EstadoRuleta> {
  const perfil = await exigirNegocio();
  const sucursalId = datos.get("sucursal_id")?.toString() ?? "";
  const sucursal = await miSucursal(perfil.id, sucursalId);
  if (!sucursal) return { error: "Esa sucursal no es tuya." };

  const frecuencia = datos.get("frecuencia")?.toString() ?? "diaria";
  if (!["una_vez", "diaria", "ilimitada"].includes(frecuencia)) {
    return { error: "Elige cada cuánto se puede girar." };
  }

  const vigencia = Number(datos.get("vigencia_dias") ?? 30);
  if (!Number.isInteger(vigencia) || vigencia < 1 || vigencia > 365) {
    return { error: "Los premios valen entre 1 y 365 días." };
  }

  const premios = [1, 2, 3]
    .map((orden) => ({
      orden,
      texto: (datos.get(`premio_${orden}`)?.toString() ?? "").trim().slice(0, 60),
      probabilidad: Number(datos.get(`probabilidad_${orden}`) ?? 0),
    }))
    .filter((p) => p.texto);

  if (premios.length === 0) return { error: "Escribe al menos un premio." };
  if (premios.some((p) => !Number.isInteger(p.probabilidad) || p.probabilidad < 1)) {
    return { error: "Cada premio necesita una probabilidad de al menos 1%." };
  }
  const suma = premios.reduce((total, p) => total + p.probabilidad, 0);
  if (suma !== 100) {
    return { error: `Las probabilidades tienen que sumar 100%. Ahora suman ${suma}%.` };
  }

  const activa = datos.get("activa") === "si";
  const supabase = await crearClienteServidor();

  const { error } = await supabase.from("ruletas").upsert({
    sucursal_id: sucursalId,
    activa,
    frecuencia,
    vigencia_dias: vigencia,
  });
  if (error) {
    return { error: error.code === "P0001" ? error.message : "No se pudo guardar la ruleta." };
  }

  // Los premios se reemplazan enteros: lo ya ganado guarda su propio texto en
  // `giros`, así que cambiarlos no toca ningún premio entregado.
  await supabase.from("premios_ruleta").delete().eq("sucursal_id", sucursalId);
  const { error: errorPremios } = await supabase
    .from("premios_ruleta")
    .insert(premios.map((p) => ({ ...p, sucursal_id: sucursalId })));
  if (errorPremios) return { error: "La ruleta se guardó, pero sus premios no. Inténtalo de nuevo." };

  revalidatePath("/negocio/panel/ruleta");
  revalidatePath(`/marca/${sucursal.slug}`);
  return { ok: activa ? "¡Tu ruleta está girando!" : "Ruleta guardada, apagada por ahora." };
}

/** El cliente enseña su código en la sucursal: se marca como entregado. */
export async function canjearCodigo(
  _previo: EstadoRuleta,
  datos: FormData,
): Promise<EstadoRuleta> {
  await exigirNegocio();
  const codigo = (datos.get("codigo")?.toString() ?? "").trim();
  if (!codigo) return { error: "Escribe el código que te enseñan." };

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("canjear_premio", { p_codigo: codigo });

  if (error) {
    return { error: error.code === "P0001" ? error.message : "No se pudo canjear. Inténtalo de nuevo." };
  }

  const fila = (data as { premio: string; cliente: string }[])[0];
  revalidatePath("/negocio/panel/ruleta");
  return { ok: `✓ Entrega «${fila.premio}» a ${fila.cliente}.` };
}
