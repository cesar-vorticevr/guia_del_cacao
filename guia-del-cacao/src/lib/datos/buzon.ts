import { crearClienteServidor } from "@/lib/supabase/server";
import { BUCKET_BUZON, type TipoDeAdjunto } from "@/lib/buzon/adjuntos";

export type ConversacionDeBuzon = {
  id: string;
  otro_id: string;
  otro_nombre: string;
  otro_tipo: string;
  ultimo_texto: string;
  ultimo_es_mio: boolean;
  ultimo_mensaje_en: string;
  sin_leer: number;
};

export type Participante = {
  usuario_id: string;
  nombre: string;
  tipo: string;
  inicio: boolean;
};

export type Mensaje = {
  id: string;
  autor_id: string;
  texto: string;
  creado_en: string;
  adjunto: string | null;
  adjunto_tipo: TipoDeAdjunto | null;
  adjunto_nombre: string | null;
  adjunto_bytes: number | null;
  /** URL firmada del adjunto, una hora: el bucket es privado. */
  adjunto_url: string | null;
};

export type Destinatario = { id: string; nombre: string; tipo: string };

/**
 * El buzón de quien mira, la conversación más reciente arriba.
 *
 * Sale de `mis_conversaciones()` y no de la tabla: RLS deja al administrador
 * leerlas todas para moderar, y su buzón no debe enseñarle las de los demás
 * (RLS autoriza, no acota). La función filtra por quien pregunta.
 */
export async function misConversaciones() {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.rpc("mis_conversaciones");

  return ((data ?? []) as ConversacionDeBuzon[]).map((c) => ({
    ...c,
    sin_leer: Number(c.sin_leer),
  }));
}

/** Cuántos mensajes ajenos sin leer tiene quien mira: el número del sobre. */
export async function mensajesSinLeer() {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.rpc("mensajes_sin_leer");

  return Number(data ?? 0);
}

/**
 * Una conversación entera: las dos partes y los mensajes, del primero al
 * último. Null si no existe o quien mira no es parte ni administrador.
 */
export async function conversacionDe(id: string) {
  const supabase = await crearClienteServidor();

  const [{ data: participantes }, { data: mensajes }] = await Promise.all([
    supabase.rpc("participantes_de", { p_conversacion: id }),
    supabase
      .from("mensajes")
      .select("id, autor_id, texto, creado_en, adjunto, adjunto_tipo, adjunto_nombre, adjunto_bytes")
      .eq("conversacion_id", id)
      .order("creado_en")
      .order("id"),
  ]);

  const partes = (participantes ?? []) as Participante[];
  if (partes.length === 0) return null;

  const filas = (mensajes ?? []) as Omit<Mensaje, "adjunto_url">[];

  // Los adjuntos se firman todos de una vez, una hora: la conversación se
  // refresca cada 20 segundos y vuelve a firmarlos.
  const rutas = filas.flatMap((m) => (m.adjunto ? [m.adjunto] : []));
  const firmadas = new Map<string, string>();

  if (rutas.length > 0) {
    const { data } = await supabase.storage.from(BUCKET_BUZON).createSignedUrls(rutas, 60 * 60);
    for (const f of data ?? []) {
      if (f.path && f.signedUrl) firmadas.set(f.path, f.signedUrl);
    }
  }

  return {
    participantes: partes,
    mensajes: filas.map((m) => ({
      ...m,
      adjunto_url: m.adjunto ? (firmadas.get(m.adjunto) ?? null) : null,
    })),
  };
}

/**
 * Lo que quien mira ya reportó en esta conversación y sigue pendiente:
 * los mensajes por su id, y `conversacion` si reportó la conversación entera.
 */
export async function misReportesEn(conversacionId: string, perfilId: string) {
  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("reportes_conversacion")
    .select("mensaje_id")
    .eq("conversacion_id", conversacionId)
    .eq("usuario_id", perfilId)
    .is("atendido_en", null);

  const filas = (data ?? []) as { mensaje_id: string | null }[];

  return {
    mensajes: new Set(filas.flatMap((f) => (f.mensaje_id ? [f.mensaje_id] : []))),
    conversacion: filas.some((f) => f.mensaje_id === null),
  };
}

/**
 * Deja constancia de que quien mira leyó la conversación y apaga su aviso.
 *
 * Vive aquí y no entre las acciones por lo mismo que `anotarMonedasVistas`:
 * se llama desde el render, y una acción con `revalidatePath` revienta ahí.
 */
export async function marcarConversacionLeida(id: string) {
  const supabase = await crearClienteServidor();
  await supabase.rpc("marcar_conversacion_leida", { p_conversacion: id });
}

/** A quién se le puede escribir: la base decide (`buscar_destinatarios`). */
export async function buscarDestinatarios(texto: string) {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.rpc("buscar_destinatarios", { p_texto: texto });

  return (data ?? []) as Destinatario[];
}

export type ConversacionReportada = {
  conversacion_id: string;
  reportes: number;
  motivos: string[];
  detalles: string[];
  mensajes_reportados: string[];
  quienes: string[];
  ultimo: string;
};

/** La cola del administrador: conversaciones con reportes sin revisar. */
export async function conversacionesReportadas() {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.rpc("conversaciones_reportadas");

  return (data ?? []) as ConversacionReportada[];
}

export type AvisoDeMensaje = {
  id: string;
  titulo: string;
  detalle: string | null;
  enlace: string;
  fecha: string;
};

/**
 * Los avisos de mensaje sin leer de quien mira. Solo existen si pidió que se
 * le avisara (`perfiles.avisar_mensajes`): los escribe el trigger del buzón.
 */
export async function avisosDeMensajes() {
  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("notificaciones")
    .select("id, titulo, detalle, enlace, fecha")
    .eq("tipo", "mensaje")
    .eq("leida", false)
    .order("fecha", { ascending: false })
    .limit(5);

  return (data ?? []) as AvisoDeMensaje[];
}

/** Si quien mira pidió aviso de mensajes nuevos. */
export async function quiereAvisoDeMensajes(perfilId: string) {
  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("perfiles")
    .select("avisar_mensajes")
    .eq("id", perfilId)
    .single();

  return Boolean((data as { avisar_mensajes?: boolean } | null)?.avisar_mensajes);
}
