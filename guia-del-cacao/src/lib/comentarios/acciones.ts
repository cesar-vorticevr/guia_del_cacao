"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { perfilActual } from "@/lib/auth/sesion";
import type { Contexto } from "@/lib/datos/comentarios";

export type EstadoComentario = { error?: string; ok?: string };

const MINIMO = 2;
const MAXIMO = 1000;

/**
 * Comentar un evento, una noticia o un tema del foro.
 *
 * Un solo módulo para los tres porque para quien escribe es el mismo gesto,
 * aunque por debajo sean dos tablas con topes distintos (uno por publicación,
 * cinco por tema). Los topes los impone la base; aquí se traducen sus errores
 * a algo legible.
 */

function contextoDe(datos: FormData): Contexto | null {
  const valor = datos.get("contexto")?.toString();
  return valor === "evento" || valor === "noticia" || valor === "foro" ? valor : null;
}

function dondeVive(contexto: Contexto, referenciaId: string) {
  if (contexto === "foro") {
    return {
      tabla: "comentarios_foro" as const,
      fila: { tema_id: referenciaId },
      ruta: `/comunidad/tema/${referenciaId}`,
    };
  }

  return {
    tabla: "comentarios_publicacion" as const,
    fila:
      contexto === "evento"
        ? { evento_id: referenciaId }
        : { noticia_id: referenciaId },
    ruta: `/${contexto === "evento" ? "eventos" : "noticias"}/${referenciaId}`,
  };
}

/** Traduce lo que gritan los índices y los triggers. */
function traducir(mensaje: string, contexto: Contexto) {
  if (mensaje.includes("comentario_unico_por")) {
    return "Ya comentaste esta publicación. Puedes editar lo que escribiste.";
  }
  if (mensaje.includes("5 comentarios")) {
    return "Ya dejaste tus 5 comentarios en este tema.";
  }
  if (mensaje.includes("row-level security")) {
    return contexto === "foro"
      ? "Comentar en el foro es de los clientes y de los negocios Tier 3."
      : "Solo las cuentas de cliente pueden comentar, y solo en micrositios publicados.";
  }
  return "No se pudo publicar tu comentario. Inténtalo de nuevo.";
}

function revisarTexto(texto: string) {
  if (texto.length < MINIMO) return "Escribe tu comentario.";
  if (texto.length > MAXIMO) return `El comentario no puede pasar de ${MAXIMO} caracteres.`;
  return null;
}

export async function comentar(
  _previo: EstadoComentario,
  datos: FormData,
): Promise<EstadoComentario> {
  const perfil = await perfilActual();
  const contexto = contextoDe(datos);
  const referenciaId = datos.get("referencia_id")?.toString() ?? "";

  if (!contexto) return { error: "No se reconoce dónde comentar." };
  if (!perfil) redirect("/login");

  // En una publicacion comentan los clientes; en el foro tambien los negocios
  // de Tier 3, que si no abririan una conversacion en la que no pueden estar.
  if (perfil.rol !== "cliente" && !(contexto === "foro" && perfil.rol === "negocio")) {
    return { error: "Solo las cuentas de cliente pueden comentar aquí." };
  }

  const texto = (datos.get("texto")?.toString() ?? "").trim();
  const problema = revisarTexto(texto);
  if (problema) return { error: problema };

  const { tabla, fila, ruta } = dondeVive(contexto, referenciaId);
  const supabase = await crearClienteServidor();

  const { error } = await supabase
    .from(tabla)
    .insert({ ...fila, usuario_id: perfil.id, texto });

  if (error) return { error: traducir(error.message, contexto) };

  revalidatePath(ruta);
  return { ok: "Listo, ya quedó tu comentario." };
}

export async function editarComentario(
  _previo: EstadoComentario,
  datos: FormData,
): Promise<EstadoComentario> {
  const perfil = await perfilActual();
  const contexto = contextoDe(datos);
  const referenciaId = datos.get("referencia_id")?.toString() ?? "";
  const comentarioId = datos.get("comentario_id")?.toString() ?? "";

  if (!contexto) return { error: "No se reconoce qué comentario editar." };
  if (!perfil) redirect("/login");

  const texto = (datos.get("texto")?.toString() ?? "").trim();
  const problema = revisarTexto(texto);
  if (problema) return { error: problema };

  const { tabla, ruta } = dondeVive(contexto, referenciaId);
  const supabase = await crearClienteServidor();

  // El `.eq("usuario_id")` no sobra aunque el trigger ya impida reescribir lo
  // ajeno: sin él, la política de moderación —que sí deja tocar la fila de
  // otro— haría que el error llegara desde el trigger y no desde aquí.
  const { error } = await supabase
    .from(tabla)
    .update({ texto })
    .eq("id", comentarioId)
    .eq("usuario_id", perfil.id);

  if (error) return { error: "No se pudo guardar el cambio." };

  revalidatePath(ruta);
  return { ok: "Comentario actualizado." };
}

export async function borrarComentario(datos: FormData) {
  const perfil = await perfilActual();
  const contexto = contextoDe(datos);
  const referenciaId = datos.get("referencia_id")?.toString() ?? "";
  const comentarioId = datos.get("comentario_id")?.toString() ?? "";

  if (!perfil || !contexto) redirect("/login");

  const { tabla, ruta } = dondeVive(contexto, referenciaId);
  const supabase = await crearClienteServidor();

  await supabase
    .from(tabla)
    .delete()
    .eq("id", comentarioId)
    .eq("usuario_id", perfil.id);

  revalidatePath(ruta);
}

/**
 * Ocultar y volver a mostrar, que es lo que puede hacer quien modera.
 *
 * No es borrar, y la diferencia importa: un comentario oculto lo sigue viendo
 * quien lo escribió. Borrarlo en silencio se siente como censura y además
 * confunde —la persona ve que desapareció y lo vuelve a escribir—.
 */
export async function ocultarComentario(datos: FormData) {
  const perfil = await perfilActual();
  const contexto = contextoDe(datos);
  const referenciaId = datos.get("referencia_id")?.toString() ?? "";
  const comentarioId = datos.get("comentario_id")?.toString() ?? "";
  const ocultar = datos.get("ocultar")?.toString() === "1";

  if (!perfil || !contexto) redirect("/login");

  const { tabla, ruta } = dondeVive(contexto, referenciaId);
  const supabase = await crearClienteServidor();

  // Quién puede hacerlo lo decide RLS: el dueño del micrositio en una
  // publicación, el autor del tema en el foro. Si no le toca, no afecta filas.
  await supabase.from(tabla).update({ oculto: ocultar }).eq("id", comentarioId);

  revalidatePath(ruta);
}
