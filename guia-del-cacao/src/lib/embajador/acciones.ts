"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { perfilActual } from "@/lib/auth/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";

export type EstadoEmbajador = { error?: string; ok?: string };

/**
 * Pedir ser Embajador del Cacao. Lo puede pedir cualquier cuenta; lo aprueba
 * el administrador, y entonces nace el código (migración 000059).
 */
export async function solicitarSerEmbajador(
  _previo: EstadoEmbajador,
  datos: FormData,
): Promise<EstadoEmbajador> {
  const perfil = await perfilActual();
  if (!perfil) redirect("/login?volver=/embajador");

  const motivo = (datos.get("motivo")?.toString() ?? "").trim().slice(0, 500);
  const supabase = await crearClienteServidor();

  const { error } = await supabase
    .from("embajadores")
    .insert({ perfil_id: perfil.id, motivo: motivo || null });

  if (error) {
    return {
      error:
        error.code === "23505"
          ? "Ya lo pediste: tu solicitud está en revisión."
          : "No se pudo enviar tu solicitud. Inténtalo de nuevo.",
    };
  }

  revalidatePath("/embajador");
  return { ok: "¡Listo! Te avisamos en cuanto la revisemos." };
}

/**
 * La cuenta donde el embajador recibe sus comisiones. La CLABE se pide con sus
 * 18 dígitos: con una de menos, la transferencia rebota y nadie sabe por qué.
 */
export async function guardarDatosDeCobro(
  _previo: EstadoEmbajador,
  datos: FormData,
): Promise<EstadoEmbajador> {
  const perfil = await perfilActual();
  if (!perfil) redirect("/login?volver=/embajador");

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

  revalidatePath("/embajador");
  return { ok: "Datos de cobro guardados." };
}
