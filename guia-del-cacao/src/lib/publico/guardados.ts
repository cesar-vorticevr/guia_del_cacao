"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
import { perfilActual } from "@/lib/auth/sesion";

export type EstadoGuardado = { guardada: boolean; error?: string };

/**
 * Guarda una publicación para después, o la saca de los guardados.
 *
 * **Guardar es privado**, a diferencia del corazón. El corazón se cuenta a la
 * vista de todos y es una señal pública; esto es un apartado personal, y nadie
 * más ve lo que alguien guardó. Lo impone la política de la tabla
 * (migración 000049), no esta función.
 *
 * Recibe el estado al que se quiere llegar y no lo calcula aquí, por lo mismo
 * que el corazón: dos toques rápidos seguidos se cruzarían y acabarían dejando
 * lo contrario de lo que se ve en pantalla.
 */
export async function marcarGuardada(
  publicacionId: string,
  guardar: boolean,
): Promise<EstadoGuardado> {
  const perfil = await perfilActual();

  if (!perfil) {
    return { guardada: false, error: "Entra a tu cuenta para guardar." };
  }

  const supabase = await crearClienteServidor();

  if (guardar) {
    /*
      `upsert` y no `insert`: la llave primaria compuesta ya impide guardar dos
      veces la misma, así que un segundo intento no es un error que haya que
      contarle a nadie — es alguien que tocó dos veces.
    */
    const { error } = await supabase
      .from("guardados")
      .upsert(
        { usuario_id: perfil.id, publicacion_id: publicacionId },
        { onConflict: "usuario_id,publicacion_id" },
      );

    if (error) return { guardada: false, error: "No se pudo guardar." };
  } else {
    const { error } = await supabase
      .from("guardados")
      .delete()
      .eq("usuario_id", perfil.id)
      .eq("publicacion_id", publicacionId);

    if (error) {
      return { guardada: true, error: "No se pudo quitar de guardados." };
    }
  }

  // El muro puede estar filtrando por guardados: sin esto, quitar una la
  // dejaría a la vista hasta recargar.
  revalidatePath("/comunidad");

  return { guardada: guardar };
}
