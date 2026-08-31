"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { perfilActual } from "@/lib/auth/sesion";
import { MONEDA } from "@/lib/vocabulario";

export type EstadoRegalo = { error?: string; ok?: string };

/**
 * Regalarle una mazorca a alguien de la comunidad.
 *
 * La mazorca **no sale del saldo de quien regala**: la plataforma da cinco cada
 * día para repartir aquí. Apoyar costaba una propia y por eso casi nadie
 * apoyaba —quien las junta visitando no las quiere gastar—; las de la bolsa
 * caducan cada noche, así que la única forma de aprovecharlas es usarlas.
 *
 * Se puede dar a quien publicó y a quien comentó, pero **una sola al día a la
 * misma persona**: lo impide un índice único, no una comprobación aquí, porque
 * dos pulsaciones seguidas llegarían a la vez.
 */
export async function regalarMazorca(
  _previo: EstadoRegalo,
  datos: FormData,
): Promise<EstadoRegalo> {
  const perfil = await perfilActual();
  if (!perfil) redirect("/login");

  const aPerfil = datos.get("a_perfil")?.toString() ?? "";
  const publicacionId = datos.get("publicacion_id")?.toString() || null;
  const comentarioId = datos.get("comentario_id")?.toString() || null;

  if (!aPerfil) return { error: "No se supo a quién dársela." };

  const supabase = await crearClienteServidor();

  const { error } = await supabase.from("regalos_mazorca").insert({
    de_perfil: perfil.id,
    a_perfil: aPerfil,
    publicacion_id: publicacionId,
    comentario_id: comentarioId,
  });

  if (error) {
    if (error.message.includes("regalo_uno_por_persona_al_dia")) {
      return { error: "Ya le diste una hoy. Mañana puedes darle otra." };
    }
    if (error.message.includes("5 mazorcas de hoy")) {
      return { error: "Ya repartiste tus 5 de hoy. Mañana tienes otras cinco." };
    }
    if (error.message.includes("a ti mismo")) {
      return { error: "Esa es tuya: no puedes regalártela." };
    }
    return { error: "No se pudo dar la mazorca. Inténtalo de nuevo." };
  }

  if (publicacionId) revalidatePath(`/comunidad/${publicacionId}`);
  revalidatePath("/comunidad");
  revalidatePath("/cuenta");

  return { ok: `Le diste una ${MONEDA.singular}.` };
}
