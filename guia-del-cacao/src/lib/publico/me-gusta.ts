"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
import { perfilActual } from "@/lib/auth/sesion";

export type Clase = "publicacion" | "evento";

export type EstadoMeGusta = { dado: boolean; error?: string };

/**
 * Pone o quita el corazón de una publicación o de un evento.
 *
 * Una sola acción para las dos cosas, porque desde el botón es un solo gesto:
 * se toca y cambia. Recibe el estado al que se quiere llegar y no lo calcula
 * aquí, para que dos toques rápidos no se crucen y acaben dejando lo contrario
 * de lo que se ve en pantalla.
 *
 * Las dos clases viven en tablas distintas —`apoyos` y `apoyos_evento`— porque
 * cuelgan de cosas distintas, así que lo único que se comparte es esto.
 */
export async function marcarMeGusta(
  clase: Clase,
  id: string,
  dar: boolean,
): Promise<EstadoMeGusta> {
  const perfil = await perfilActual();

  if (!perfil) {
    return { dado: false, error: "Entra a tu cuenta para dar corazones." };
  }

  const supabase = await crearClienteServidor();

  const tabla = clase === "evento" ? "apoyos_evento" : "apoyos";
  const columna = clase === "evento" ? "evento_id" : "publicacion_id";

  if (dar) {
    /*
      `upsert` y no `insert`: si alguien toca dos veces seguidas, el segundo
      chocaría con la llave primaria y devolvería un error por algo que ya está
      como se pidió. Dar lo ya dado no es un fallo.
    */
    const { error } = await supabase
      .from(tabla)
      .upsert(
        { [columna]: id, usuario_id: perfil.id },
        { onConflict: `${columna},usuario_id` },
      );

    if (error) return { dado: false, error: "No se pudo. Inténtalo de nuevo." };
  } else {
    const { error } = await supabase
      .from(tabla)
      .delete()
      .eq(columna, id)
      .eq("usuario_id", perfil.id);

    if (error) return { dado: true, error: "No se pudo. Inténtalo de nuevo." };
  }

  /*
    Se invalidan las listas donde se ve el contador. El botón lleva su propio
    número en el cliente y no espera a esto; esto es para que al volver a la
    página el número ya venga bien del servidor.
  */
  revalidatePath(clase === "evento" ? "/eventos" : "/comunidad");
  revalidatePath("/");

  return { dado: dar };
}
