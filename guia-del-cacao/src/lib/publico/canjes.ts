"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { perfilActual } from "@/lib/auth/sesion";

export type EstadoCanje = { error?: string; ok?: string };

/**
 * Canjear un cupón con las mazorcas propias.
 *
 * El cobro y el aviso al negocio los hace el trigger `cobrar_canje`, en la misma
 * transacción: si el cobro fallara después de guardar el canje, habría un cupón
 * regalado. Y el precio lo pone el cupón, no lo que llegue del formulario —
 * mandarlo desde fuera dejaría elegir cuánto pagar.
 */
export async function canjearCupon(
  _previo: EstadoCanje,
  datos: FormData,
): Promise<EstadoCanje> {
  const perfil = await perfilActual();

  if (!perfil) redirect("/login?volver=/cupones");
  if (perfil.rol !== "cliente") {
    return { error: "Los cupones son para las cuentas de cliente." };
  }

  const cuponId = datos.get("cupon_id")?.toString() ?? "";
  if (!cuponId) return { error: "No se supo qué cupón." };

  const supabase = await crearClienteServidor();

  const { error } = await supabase.from("canjes").insert({
    cupon_id: cuponId,
    usuario_id: perfil.id,
    // El trigger lo reemplaza por el precio real del cupón; va aquí solo porque
    // la columna no admite nulos.
    costo_mazorcas: 0,
  });

  if (error) {
    if (error.message.includes("Te faltan mazorcas")) {
      return { error: error.message.replace("Te faltan mazorcas", "Te faltan mazorcas") };
    }
    if (error.message.includes("ya caduco")) {
      return { error: "Ese cupón ya caducó." };
    }
    if (error.message.includes("canje_uno_por_persona")) {
      return { error: "Ya lo tienes. Es uno por persona." };
    }
    return { error: "No se pudo canjear. Inténtalo de nuevo." };
  }

  revalidatePath("/cupones");
  revalidatePath("/cuenta");

  return { ok: "¡Es tuyo! Preséntalo en la sucursal." };
}

/**
 * El negocio marca que ya se lo presentaron en el mostrador.
 *
 * Lo marca el negocio y no quien lo canjeó: es quien lo tiene delante, y dejar
 * que lo marcara el cliente convertiría el vale en algo que se gasta solo.
 */
export async function marcarCanjeUsado(datos: FormData) {
  const perfil = await perfilActual();

  if (!perfil) redirect("/login");
  if (perfil.rol !== "negocio") redirect("/cuenta");

  const id = datos.get("canje_id")?.toString() ?? "";
  const supabase = await crearClienteServidor();

  // Quién puede marcarlo lo decide RLS: la política pide poseer la sucursal del
  // cupón.
  await supabase
    .from("canjes")
    .update({ usado_en: new Date().toISOString() })
    .eq("id", id);

  revalidatePath("/negocio/panel/cupones");
}
