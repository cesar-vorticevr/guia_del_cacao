import { crearClienteServidor } from "@/lib/supabase/server";
import { pasaporteDe } from "@/lib/datos/puntos";
import { temasPermitidos } from "@/lib/vocabulario";

export type Tema = {
  id: string;
  autor_id: string;
  titulo: string | null;
  contenido: string;
  fecha: string;
  fecha_edicion: string | null;
  /** Las fotos, ya como rutas del bucket. La primera es la portada. */
  imagenes: string[];
  perfiles_publicos: { nombre: string; foto_perfil: string | null } | null;
  /** Cuántos comentarios y cuántos apoyos lleva. */
  comentarios: number;
  apoyos: number;
};

// El nombre del autor se pide por la llave foranea con nombre y apellido:
// desde temas_foro se puede llegar a perfiles_publicos por dos caminos —el
// autor y la tabla de apoyos—, y sin decir cual, PostgREST responde un error
// que aqui se veria como "no hay temas".
const CAMPOS =
  "id, autor_id, titulo, contenido, fecha, fecha_edicion, imagenes, perfiles_publicos!publicaciones_autor_id_fkey(nombre, foto_perfil)";

/**
 * Pega los conteos a una lista de temas, en una sola consulta.
 *
 * Los cuenta la vista `publicaciones_resumen`, que corre con los permisos de
 * quien pregunta: un comentario oculto no debe sumar para quien no lo ve.
 */
async function conConteos(
  supabase: Awaited<ReturnType<typeof crearClienteServidor>>,
  filas: Omit<Tema, "comentarios" | "apoyos">[],
): Promise<Tema[]> {
  if (filas.length === 0) return [];

  const { data } = await supabase
    .from("publicaciones_resumen")
    .select("publicacion_id, comentarios, apoyos")
    .in(
      "publicacion_id",
      filas.map((f) => f.id),
    );

  const porTema = new Map(
    (data ?? []).map((fila) => [
      fila.publicacion_id as string,
      { comentarios: Number(fila.comentarios), apoyos: Number(fila.apoyos) },
    ]),
  );

  return filas.map((fila) => ({
    ...fila,
    comentarios: porTema.get(fila.id)?.comentarios ?? 0,
    apoyos: porTema.get(fila.id)?.apoyos ?? 0,
  }));
}

/** El foro se lee sin cuenta: es parte de lo que invita a registrarse. */
export async function listarTemas() {
  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("publicaciones")
    .select(CAMPOS)
    .order("fecha", { ascending: false });

  return conConteos(supabase, (data ?? []) as unknown as Omit<Tema, "comentarios" | "apoyos">[]);
}

export async function temaPorId(id: string) {
  const supabase = await crearClienteServidor();

  const { data } = await supabase.from("publicaciones").select(CAMPOS).eq("id", id).maybeSingle();

  if (!data) return null;

  const [tema] = await conConteos(supabase, [
    data as unknown as Omit<Tema, "comentarios" | "apoyos">,
  ]);

  return tema ?? null;
}

export type Cupo = {
  monedas: number;
  /** Cuántos temas puede tener abiertos con esas mazorcas. */
  permitidos: number;
  abiertos: number;
};

/**
 * Cuánto le queda a alguien para abrir temas.
 *
 * El cálculo se repite en la base (`temas_permitidos`), y a propósito: la base
 * es la que manda y rechaza lo que no cumpla; esto es para poder decirlo antes,
 * en la pantalla, en vez de dejar escribir un tema completo para negarlo al
 * final.
 */
export async function miCupo(usuarioId: string): Promise<Cupo> {
  const supabase = await crearClienteServidor();

  const [pasaporte, { count }] = await Promise.all([
    pasaporteDe(usuarioId),
    supabase
      .from("publicaciones")
      .select("id", { count: "exact", head: true })
      .eq("autor_id", usuarioId),
  ]);

  return {
    monedas: pasaporte.puntos,
    permitidos: temasPermitidos(pasaporte.puntos),
    abiertos: count ?? 0,
  };
}

/** ¿Ya le regaló su mazorca a este tema? Una por persona y por tema. */
export async function yaApoye(usuarioId: string, temaId: string) {
  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("apoyos")
    .select("publicacion_id")
    .eq("usuario_id", usuarioId)
    .eq("publicacion_id", temaId)
    .maybeSingle();

  return data !== null;
}
