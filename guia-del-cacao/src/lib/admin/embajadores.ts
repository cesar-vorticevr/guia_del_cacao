"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { perfilActual } from "@/lib/auth/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { pesos } from "@/lib/tipos";

export type EstadoPagoEmbajador = { error?: string; ok?: string };

async function exigirAdmin() {
  const perfil = await perfilActual();
  if (!perfil) redirect("/login");
  if (perfil.rol !== "admin") redirect("/cuenta");
  return perfil;
}

/**
 * Aprobar, pausar o rechazar a un embajador. Aprobar le da su código; la base
 * vuelve a comprobar que quien llama es administrador (`decidir_embajador`).
 */
export async function decidirEmbajador(datos: FormData) {
  await exigirAdmin();

  const perfilId = datos.get("perfil_id")?.toString() ?? "";
  const estado = datos.get("estado")?.toString() ?? "";

  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("decidir_embajador", {
    p_perfil: perfilId,
    p_estado: estado,
  });

  if (error) console.error("No se pudo decidir el embajador:", error);

  revalidatePath("/admin/embajadores");
  revalidatePath("/admin");
}

/**
 * Ya se le transfirió a un embajador: se anota el pago con su referencia y
 * quedan cubiertas todas las comisiones que se le debían.
 */
export async function registrarPagoAEmbajador(
  _previo: EstadoPagoEmbajador,
  datos: FormData,
): Promise<EstadoPagoEmbajador> {
  await exigirAdmin();

  const perfilId = datos.get("perfil_id")?.toString() ?? "";
  const referencia = (datos.get("referencia")?.toString() ?? "").trim().slice(0, 120);

  if (!referencia) {
    return { error: "Anota la referencia de la transferencia (SPEI, folio…)." };
  }

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("registrar_pago_a_embajador", {
    p_embajador: perfilId,
    p_referencia: referencia,
  });

  if (error) {
    return {
      error: error.code === "P0001" ? error.message : "No se pudo registrar el pago.",
    };
  }

  revalidatePath("/admin/embajadores");
  revalidatePath("/admin");
  return { ok: `Pago de ${pesos(Number(data))} registrado.` };
}
