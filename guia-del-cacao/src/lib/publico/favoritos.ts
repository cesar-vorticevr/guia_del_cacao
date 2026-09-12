"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
import { perfilActual } from "@/lib/auth/sesion";

export type EstadoFavorito = { guardado: boolean; error?: string };

/**
 * Pone o quita un negocio de los favoritos.
 *
 * Es una sola acción para las dos cosas porque desde el corazón es un solo
 * gesto: se toca y cambia. Recibe el estado al que se quiere llegar en vez de
 * calcularlo aquí, para que dos toques rápidos no se crucen y acaben dejando lo
 * contrario de lo que se ve en pantalla.
 */
export async function marcarFavorito(
  sucursalId: string,
  guardar: boolean,
): Promise<EstadoFavorito> {
  const perfil = await perfilActual();

  if (!perfil) {
    return { guardado: false, error: "Entra a tu cuenta para guardar negocios." };
  }

  if (perfil.rol !== "cliente") {
    return {
      guardado: false,
      error: "Los favoritos son de las cuentas de visitante.",
    };
  }

  const supabase = await crearClienteServidor();

  if (guardar) {
    /*
      `upsert` y no `insert`: si la persona toca dos veces seguidas, el segundo
      insert chocaría con la llave primaria y devolvería un error por algo que
      ya está como se pidió. Guardar lo guardado no es un fallo.
    */
    const { error } = await supabase
      .from("favoritos")
      .upsert(
        { usuario_id: perfil.id, sucursal_id: sucursalId },
        { onConflict: "usuario_id,sucursal_id" },
      );

    if (error) {
      return { guardado: false, error: "No se pudo guardar. Inténtalo de nuevo." };
    }
  } else {
    const { error } = await supabase
      .from("favoritos")
      .delete()
      .eq("usuario_id", perfil.id)
      .eq("sucursal_id", sucursalId);

    if (error) {
      return { guardado: true, error: "No se pudo quitar. Inténtalo de nuevo." };
    }
  }

  /*
    El explorador es el que enseña la lista, así que es el que hay que
    invalidar: quien quita un favorito con el filtro puesto tiene que ver que
    se fue. El corazón en sí lleva su propio estado en el cliente y no espera a
    esto. La cuenta también, por el contador de su atajo.
  */
  revalidatePath("/directorio");
  revalidatePath("/cuenta");

  return { guardado: guardar };
}
