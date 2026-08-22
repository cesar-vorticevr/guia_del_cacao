import { crearClienteServidor } from "@/lib/supabase/server";

/**
 * Los comentarios, que son de dos clases con las mismas palabras.
 *
 * En un evento o una noticia se comenta UNA vez: es "qué me parece esto", no
 * una conversación. En un tema del foro se puede ir y venir hasta cinco veces.
 * Por eso son dos tablas y no una con una bandera: las reglas son opuestas y
 * mezclarlas obligaría a preguntar "¿de cuál eres?" en cada consulta.
 *
 * Lo que sí comparten es la forma de leerse y de moderarse, y eso vive aquí.
 */

export type Contexto = "evento" | "noticia" | "foro";

export const TOPE_COMENTARIOS: Record<Contexto, number> = {
  evento: 1,
  noticia: 1,
  foro: 5,
};

export type Comentario = {
  id: string;
  usuario_id: string;
  texto: string;
  oculto: boolean;
  fecha: string;
  fecha_edicion: string | null;
  perfiles_publicos: { nombre: string; foto_perfil: string | null } | null;
};

const CAMPOS =
  "id, usuario_id, texto, oculto, fecha, fecha_edicion, perfiles_publicos(nombre, foto_perfil)";

function tablaYLlave(contexto: Contexto) {
  if (contexto === "foro") {
    return { tabla: "comentarios_foro" as const, llave: "tema_id" as const };
  }

  return {
    tabla: "comentarios_publicacion" as const,
    llave: (contexto === "evento" ? "evento_id" : "noticia_id") as
      | "evento_id"
      | "noticia_id",
  };
}

/**
 * Los comentarios que le tocan ver a quien está mirando.
 *
 * No se filtra por `oculto` aquí: lo hace RLS, que además deja pasar los
 * propios. Si se filtrara también en la consulta, quien escribió un comentario
 * oculto dejaría de verlo y volvería a escribirlo sin entender por qué.
 */
export async function comentariosDe(contexto: Contexto, referenciaId: string) {
  const { tabla, llave } = tablaYLlave(contexto);
  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from(tabla)
    .select(CAMPOS)
    .eq(llave, referenciaId)
    .order("fecha", { ascending: contexto === "foro" });

  return (data ?? []) as unknown as Comentario[];
}

/** Cuántos lleva esta persona aquí, para saber si le queda cupo. */
export function cuantosSon(comentarios: Comentario[], usuarioId: string | undefined) {
  if (!usuarioId) return 0;
  return comentarios.filter((c) => c.usuario_id === usuarioId).length;
}

/**
 * El propio primero, el resto después.
 *
 * Quien acaba de escribir quiere ver lo suyo sin buscarlo, sobre todo si se lo
 * ocultaron: es la única señal de que sigue ahí.
 */
export function conElPropioArriba(comentarios: Comentario[], usuarioId: string | undefined) {
  if (!usuarioId) return comentarios;

  return [
    ...comentarios.filter((c) => c.usuario_id === usuarioId),
    ...comentarios.filter((c) => c.usuario_id !== usuarioId),
  ];
}

/**
 * ¿Quien mira es el negocio dueño de esta publicación?
 *
 * Es lo que decide si ve el botón de ocultar. No se puede deducir de RLS: el
 * evento es público y cualquiera lo lee, así que hay que preguntarlo aparte.
 */
export async function moderaLaPublicacion(
  perfil: { id: string; rol: string } | null,
  contexto: Exclude<Contexto, "foro">,
  referenciaId: string,
) {
  if (perfil?.rol !== "negocio") return false;

  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from(contexto === "evento" ? "eventos" : "noticias")
    .select("sucursales(marcas(perfil_id))")
    .eq("id", referenciaId)
    .maybeSingle();

  const duenio = (
    data as unknown as { sucursales: { marcas: { perfil_id: string } | null } | null } | null
  )?.sucursales?.marcas?.perfil_id;

  return duenio === perfil.id;
}
