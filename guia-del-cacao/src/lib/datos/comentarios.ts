import { crearClienteServidor } from "@/lib/supabase/server";

/**
 * Los comentarios, que son de dos clases con las mismas palabras.
 *
 * En un evento se comenta UNA vez: es "qué me parece esto", no una
 * conversación. En una publicación de la comunidad se puede ir y venir hasta
 * cinco veces. Por eso son dos tablas y no una con una bandera: las reglas son
 * opuestas y mezclarlas obligaría a preguntar "¿de cuál eres?" en cada consulta.
 *
 * Lo que sí comparten es la forma de leerse y de moderarse, y eso vive aquí.
 */

export type Contexto = "evento" | "publicacion";

export const TOPE_COMENTARIOS: Record<Contexto, number> = {
  evento: 1,
  publicacion: 5,
};

export type Comentario = {
  id: string;
  usuario_id: string;
  texto: string;
  oculto: boolean;
  fecha: string;
  fecha_edicion: string | null;
  /** El comentario al que contesta, si contesta a alguno. Un solo nivel. */
  responde_a: string | null;
  perfiles_publicos: { nombre: string; foto_perfil: string | null } | null;
};

/*
  El autor se pide **por el nombre de su llave**, no como
  `perfiles_publicos(...)` a secas.

  Desde la migracion 000047 hay dos caminos de `comentarios` a `perfiles`: la
  columna `usuario_id` y la tabla de corazones, que tambien apunta a un perfil.
  Con dos caminos PostgREST no elige: responde PGRST201, y ese error llega como
  `data` en null — que aqui se lee igual que "nadie ha comentado". Se vio al
  abrir una publicacion con seis comentarios y encontrarla vacia.

  Es el tercer caso del mismo tropiezo en el repo, despues de
  `perfiles_publicos` desde `temas_foro` y de `categorias` desde `marcas`. Cada
  vez que una migracion agrega un segundo camino entre dos tablas hay que
  repasar los embeds de las dos.
*/
/*
  Y `responde_a` **solo se pide en la tabla que la tiene**.

  La lista de campos era una sola para las dos tablas e incluia `responde_a`,
  que existe en `comentarios` y no en `comentarios_publicacion`: del lado de
  los eventos, PostgREST respondia 42703 -column does not exist- y ese error
  tambien llega como `data` en null. Resultado: los comentarios de un evento
  no se veian nunca, con el comentario ahi guardado. No lo delataba ningun
  error en pantalla, solo el texto de 'Todavia nadie ha comentado'.

  Es el hilo del que no hay que tirar de mas: las dos tablas se leen igual,
  pero no son la misma tabla.
*/
const COMUNES = "id, usuario_id, texto, oculto, fecha, fecha_edicion";

function tablaYLlave(contexto: Contexto) {
  if (contexto === "publicacion") {
    return {
      tabla: "comentarios" as const,
      llave: "publicacion_id" as const,
      campos: `${COMUNES}, responde_a, perfiles_publicos!comentarios_usuario_id_fkey(nombre, foto_perfil)`,
    };
  }

  return {
    tabla: "comentarios_publicacion" as const,
    llave: "evento_id" as const,
    campos: `${COMUNES}, perfiles_publicos!comentarios_publicacion_usuario_id_fkey(nombre, foto_perfil)`,
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
  const { tabla, llave, campos } = tablaYLlave(contexto);
  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from(tabla)
    .select(campos)
    .eq(llave, referenciaId)
    .order("fecha", { ascending: contexto === "publicacion" });

  return (data ?? []) as unknown as Comentario[];
}

/** Un corazón: cuántos tiene y si es mío. */
export type Apoyo = { cuantos: number; mio: boolean };

/**
 * Los corazones de una tanda de comentarios, en una sola consulta.
 *
 * Una por comentario serían veintiocho consultas en una publicación con
 * veintiocho respuestas. Se piden todas juntas y se cuentan aquí: son filas de
 * dos columnas, y la lista de comentarios ya está en memoria.
 *
 * Solo existen para los comentarios de la comunidad (migración 000047). Los de
 * un evento no llevan corazón: ahí se comenta una vez y no hay hilo al que
 * asentir.
 */
export async function apoyosDeComentarios(
  ids: string[],
  usuarioId?: string,
): Promise<Map<string, Apoyo>> {
  const cuenta = new Map<string, Apoyo>();
  if (ids.length === 0) return cuenta;

  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("apoyos_comentario")
    .select("comentario_id, usuario_id")
    .in("comentario_id", ids);

  for (const fila of data ?? []) {
    const id = fila.comentario_id as string;
    const previo = cuenta.get(id) ?? { cuantos: 0, mio: false };

    cuenta.set(id, {
      cuantos: previo.cuantos + 1,
      mio: previo.mio || fila.usuario_id === usuarioId,
    });
  }

  return cuenta;
}

/** Alguien a quien se puede etiquetar aquí. */
export type Participante = { id: string; nombre: string };

/**
 * A quién se puede etiquetar en esta conversación.
 *
 * **Solo a quien ya participó**: quien publicó y quien comentó. No es una
 * limitación técnica, es la regla — un buscador de toda la gente del sitio
 * dentro de un comentario convierte una conversación en un sitio desde donde
 * llamar la atención de desconocidos, y lo primero que llega por ahí es el
 * spam.
 *
 * Se saca de los comentarios que ya están en memoria y del autor, sin consultar
 * nada: las dos cosas se acaban de leer para pintar la página.
 *
 * Los comentarios ocultos **sí cuentan**: su autor participó, y que el negocio
 * le haya escondido un comentario no lo borra de la conversación. Quien lo lee
 * lo tiene delante —el propio autor lo sigue viendo— y no poder contestarle
 * sería más raro que poder.
 */
export function participantesDe(
  comentarios: Comentario[],
  autor?: Participante | null,
): Participante[] {
  const porId = new Map<string, string>();

  if (autor?.nombre) porId.set(autor.id, autor.nombre);

  for (const comentario of comentarios) {
    const nombre = comentario.perfiles_publicos?.nombre;
    if (nombre) porId.set(comentario.usuario_id, nombre);
  }

  return [...porId]
    .map(([id, nombre]) => ({ id, nombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
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
