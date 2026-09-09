import { nombrarNegocio } from "@/lib/nombres";
import { crearClienteServidor } from "@/lib/supabase/server";

/**
 * Consultas del sitio público.
 *
 * Aquí no hace falta acotar por dueño: lo público es justo lo que la política
 * de lectura deja ver a cualquiera. Aun así se filtra por `estado` de forma
 * explícita, para que la intención se lea en el código y no dependa de que
 * nadie afloje la política más adelante.
 */

export type TarjetaDirectorio = {
  id: string;
  /** Promedio de estrellas, o null si nadie la ha calificado. */
  calificacion?: Calificacion | null;
  slug: string;
  nombre_sucursal: string;
  logo: string | null;
  imagen_fondo: string | null;
  acerca_de: string | null;
  tier_id: number | null;
  /**
   * Si su plan incluye dar mazorcas.
   *
   * Sale del plan y no de comparar `tier_id >= 2` a mano: cuál es el primer plan
   * que las incluye es un dato de la tabla `tiers`, y escribir el número aquí
   * obligaría a acordarse de este sitio el día que cambien los planes.
   */
  tiers: { puede_dar_puntos: boolean; permite_resenas: boolean } | null;
  /** Entidad federativa. Es el filtro principal desde que la guía es nacional. */
  entidad: string;
  /** Ciudad o municipio; las sucursales anteriores al alcance nacional no la tienen. */
  ciudad: string | null;
  marcas: { nombre_comercial: string; categoria_id: number } | null;
};

export type MicrositioPublico = TarjetaDirectorio & {
  marca_id: string;
  ubicacion_maps_url: string | null;
  whatsapp: string | null;
  facebook: string | null;
  instagram: string | null;
  youtube: string | null;
  tiktok: string | null;
  correo_contacto: string | null;
  telefono: string | null;
  galeria: string[];
  marcas: { nombre_comercial: string; categoria_id: number } | null;
};

export type Publicacion = {
  id: string;
  titulo: string;
  subtitulo: string | null;
  contenido: string;
  imagenes: string[];
  fecha_evento?: string;
  /** Solo en eventos: si se canceló, sigue a la vista pero tachado. */
  cancelado_en?: string | null;
  fecha_publicacion: string;
  rango_exclusivo?: number | null;
  sucursales: {
    slug: string;
    nombre_sucursal: string;
    marcas: { nombre_comercial: string } | null;
  } | null;
};

/*
  `nombrarNegocio` se mudó a `lib/nombres.ts` y se reexporta aquí para no tocar
  a quien ya la importaba de este módulo. Es presentación pura y no puede vivir
  junto a las consultas: un componente de cliente que la importe de aquí se
  trae también el cliente de Supabase de servidor, y eso no compila.
*/
export { nombrarNegocio };

const CAMPOS_TARJETA =
  "id, slug, nombre_sucursal, logo, imagen_fondo, acerca_de, tier_id, entidad, ciudad, tiers(puede_dar_puntos, permite_resenas), marcas(nombre_comercial, categoria_id)";

/**
 * Directorio.
 *
 * El Tier 3 va primero: no es un adorno, es parte de lo que se paga
 * ("primeros lugares en el directorio", estructura §3).
 */
export async function listarDirectorio(
  categoriaId?: number,
  /** Entidad federativa, para el directorio nacional. */
  entidad?: string,
) {
  const supabase = await crearClienteServidor();

  // La entidad se filtra en la base y la categoría en memoria porque la
  // categoría cuelga de la marca —una tabla relacionada, que PostgREST no deja
  // filtrar sin traerse la lista entera igual— y la entidad es una columna de
  // la propia sucursal. Filtrar donde se puede evita traer el país completo
  // para enseñar Chiapas.
  let consulta = supabase
    .from("sucursales")
    .select(CAMPOS_TARJETA)
    .eq("estado", "publicado");

  if (entidad) consulta = consulta.eq("entidad", entidad);

  const { data } = await consulta
    .order("tier_id", { ascending: false })
    .order("fecha_publicacion", { ascending: false });

  const todas = (data ?? []) as unknown as TarjetaDirectorio[];

  const visibles = categoriaId
    ? todas.filter((s) => s.marcas?.categoria_id === categoriaId)
    : todas;

  return conCalificaciones(visibles);
}

/**
 * Las entidades que de verdad tienen algo publicado.
 *
 * El filtro ofrece solo estas y no las 32: una lista donde 29 opciones llevan a
 * "no hay nada aquí" no es un filtro, es una trampa.
 */
export async function entidadesConNegocios(): Promise<string[]> {
  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("sucursales")
    .select("entidad")
    .eq("estado", "publicado");

  return [...new Set((data ?? []).map((fila) => fila.entidad as string))].sort(
    (a, b) => a.localeCompare(b, "es"),
  );
}

export async function micrositioPorSlug(slug: string) {
  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("sucursales")
    .select(
      `${CAMPOS_TARJETA}, marca_id, ubicacion_maps_url, whatsapp, facebook,
       instagram, youtube, tiktok, correo_contacto, telefono, galeria`,
    )
    .eq("slug", slug)
    .eq("estado", "publicado")
    .maybeSingle();

  return (data as unknown as MicrositioPublico) ?? null;
}

/**
 * Lo que rota en el banner de la portada.
 *
 * Todas las sucursales Tier 3 entran solas: el banner está incluido en el
 * precio del plan y no se compra aparte (estructura §6.2). Si el negocio subió
 * un banner propio se usa ese; si no, se echa mano de su imagen de fondo, para
 * que nadie quede fuera del carrusel por no haber subido una imagen más.
 */
export async function bannersDePortada() {
  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("sucursales")
    .select(
      "id, slug, nombre_sucursal, imagen_fondo, marcas(nombre_comercial), banners(imagen, texto, orden_rotacion)",
    )
    .eq("estado", "publicado")
    .eq("tier_id", 3)
    .order("fecha_publicacion", { ascending: false });

  type Fila = {
    id: string;
    slug: string;
    nombre_sucursal: string;
    imagen_fondo: string | null;
    marcas: { nombre_comercial: string } | null;
    banners: { imagen: string; texto: string | null; orden_rotacion: number }[];
  };

  return ((data ?? []) as unknown as Fila[])
    .map((fila) => {
      const propio = fila.banners?.[0];
      const nombres = nombrarNegocio(fila);

      return {
        id: fila.id,
        slug: fila.slug,
        nombre: nombres.marca ?? fila.nombre_sucursal,
        sucursal: nombres.sucursal,
        imagen: propio?.imagen ?? fila.imagen_fondo,
        texto: propio?.texto ?? null,
        orden: propio?.orden_rotacion ?? 99,
      };
    })
    .sort((a, b) => a.orden - b.orden);
}

const CAMPOS_PUBLICACION =
  "id, titulo, subtitulo, contenido, imagenes, fecha_publicacion, sucursales(slug, nombre_sucursal, marcas(nombre_comercial))";

export async function listarEventos() {
  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("eventos")
    .select(`${CAMPOS_PUBLICACION}, fecha_evento, cancelado_en, rango_exclusivo`)
    .order("fecha_evento", { ascending: false });

  const todos = (data ?? []) as unknown as Publicacion[];
  const ahora = Date.now();

  // "Próximo" o "pasado" se decide por la fecha, sin que nadie lo marque a
  // mano (spec §5.3).
  return {
    proximos: todos
      .filter((e) => new Date(e.fecha_evento!).getTime() >= ahora)
      .sort(
        (a, b) =>
          new Date(a.fecha_evento!).getTime() - new Date(b.fecha_evento!).getTime(),
      ),
    pasados: todos.filter((e) => new Date(e.fecha_evento!).getTime() < ahora),
  };
}

export async function listarNoticias() {
  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("noticias")
    .select(CAMPOS_PUBLICACION)
    .order("fecha_publicacion", { ascending: false });

  return (data ?? []) as unknown as Publicacion[];
}

export type Resena = {
  id: string;
  texto: string;
  fecha: string;
  fecha_edicion: string | null;
  foto: string | null;
  respuesta_marca: string | null;
  fecha_respuesta: string | null;
  usuario_id: string;
  perfiles_publicos: { nombre: string; foto_perfil: string | null } | null;
};

/**
 * Reseñas de un micrositio.
 *
 * El nombre de quien la escribió sale de la vista `perfiles_publicos`, que solo
 * expone nombre y foto: la tabla `perfiles` guarda además el correo y nunca
 * debe asomarse al público.
 */
export async function resenasDe(sucursalId: string) {
  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("resenas")
    .select(
      "id, texto, fecha, fecha_edicion, foto, respuesta_marca, fecha_respuesta, usuario_id, perfiles_publicos(nombre, foto_perfil)",
    )
    .eq("sucursal_id", sucursalId)
    .order("fecha", { ascending: false });

  return (data ?? []) as unknown as Resena[];
}

export type Calificacion = { promedio: number; total: number };

/**
 * El promedio de estrellas de una sucursal, ya calculado por la base.
 *
 * Sale de la vista `calificaciones_sucursal` y no de un `avg` aquí: sumar en
 * el servidor obligaría a traerse todas las calificaciones para tirarlas
 * enseguida, y en un negocio con cientos eso es tráfico regalado.
 *
 * Sin calificaciones no hay renglón en la vista; eso no es un error, es un
 * negocio que nadie ha votado todavía.
 */
export async function calificacionDe(sucursalId: string): Promise<Calificacion | null> {
  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("calificaciones_sucursal")
    .select("promedio, total")
    .eq("sucursal_id", sucursalId)
    .maybeSingle();

  if (!data) return null;

  // `promedio` viaja como numeric y PostgREST lo entrega en texto para no
  // perder precisión; aquí sí conviene el número, que es para pintarlo.
  return { promedio: Number(data.promedio), total: data.total };
}

/** Las estrellas que ya dio esta persona aquí, o null si todavía no vota. */
export async function miCalificacion(usuarioId: string, sucursalId: string) {
  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("calificaciones")
    .select("estrellas")
    .eq("usuario_id", usuarioId)
    .eq("sucursal_id", sucursalId)
    .maybeSingle();

  return data?.estrellas ?? null;
}

/**
 * ¿Ya comentó hoy en este negocio?
 *
 * El tope de uno al día lo impone el trigger `limitar_resena_diaria`; esto es
 * para decírselo antes de que escriba, no para sustituirlo. El día se cuenta
 * en hora de Tabasco, igual que en la base, porque si aquí se contara en UTC
 * la pantalla y el trigger no coincidirían en la madrugada.
 */
export async function comentoHoy(usuarioId: string, sucursalId: string) {
  const supabase = await crearClienteServidor();

  const hoy = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Mexico_City",
  });

  const { data } = await supabase
    .from("resenas")
    .select("id, fecha")
    .eq("usuario_id", usuarioId)
    .eq("sucursal_id", sucursalId)
    .order("fecha", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return false;

  const dia = new Date(data.fecha).toLocaleDateString("en-CA", {
    timeZone: "America/Mexico_City",
  });

  return dia === hoy;
}

/**
 * Pega el promedio de estrellas a un puñado de tarjetas, en una sola consulta.
 *
 * Preguntar por cada tarjeta sería una consulta por negocio: con treinta en el
 * directorio, treinta viajes a la base para pintar una fila de estrellas. Con
 * un solo `in` se traen todos los promedios y se reparten aquí.
 */
export async function calificacionesDe(
  sucursalIds: string[],
): Promise<Map<string, Calificacion>> {
  if (sucursalIds.length === 0) return new Map();

  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("calificaciones_sucursal")
    .select("sucursal_id, promedio, total")
    .in("sucursal_id", sucursalIds);

  return new Map(
    (data ?? []).map((fila) => [
      fila.sucursal_id as string,
      { promedio: Number(fila.promedio), total: fila.total as number },
    ]),
  );
}

async function conCalificaciones(
  tarjetas: TarjetaDirectorio[],
): Promise<TarjetaDirectorio[]> {
  if (tarjetas.length === 0) return tarjetas;

  const porSucursal = await calificacionesDe(tarjetas.map((t) => t.id));

  return tarjetas.map((tarjeta) => ({
    ...tarjeta,
    calificacion: porSucursal.get(tarjeta.id) ?? null,
  }));
}

/**
 * Un evento o una noticia sueltos, para su propia página.
 *
 * Se apoyan en RLS: la política de lectura solo deja ver lo de un micrositio
 * publicado, así que un evento de un borrador devuelve null y la página
 * responde 404, igual que si no existiera.
 */
export async function eventoPorId(id: string) {
  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("eventos")
    .select(`${CAMPOS_PUBLICACION}, fecha_evento, rango_exclusivo`)
    .eq("id", id)
    .maybeSingle();

  return (data as unknown as Publicacion) ?? null;
}

export async function noticiaPorId(id: string) {
  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("noticias")
    .select(CAMPOS_PUBLICACION)
    .eq("id", id)
    .maybeSingle();

  return (data as unknown as Publicacion) ?? null;
}

/** Cuánto dura una noticia en el micrositio de quien la publicó. */
export const DIAS_DE_NOTICIA = 30;

/**
 * Lo que el propio micrositio anuncia hoy.
 *
 * El micrositio no es un archivo histórico: enseña lo que todavía sirve. Un
 * evento que ya pasó desaparece solo, y una noticia se cae al mes de
 * publicada. Las dos siguen existiendo en sus secciones y en su propia página
 * —nada se borra—, pero dejan de ocupar el espacio del negocio.
 */
export async function agendaDe(sucursalId: string) {
  const supabase = await crearClienteServidor();
  const ahora = new Date();

  const desde = new Date(ahora);
  desde.setDate(desde.getDate() - DIAS_DE_NOTICIA);

  const [eventos, noticias] = await Promise.all([
    supabase
      .from("eventos")
      .select(`${CAMPOS_PUBLICACION}, fecha_evento, rango_exclusivo`)
      .eq("sucursal_id", sucursalId)
      .gte("fecha_evento", ahora.toISOString())
      .order("fecha_evento"),
    // Desde la migración 000029 las noticias son publicaciones de la comunidad
    // firmadas por una sucursal. La tabla `noticias` sigue ahí para poder mirar
    // atrás, pero nadie la lee: leerla ahora enseñaría cada una dos veces.
    supabase
      .from("publicaciones")
      .select(
        "id, titulo, contenido, imagenes, fecha_publicacion:fecha, sucursales(nombre_sucursal, slug, marcas(nombre_comercial))",
      )
      .eq("sucursal_id", sucursalId)
      .is("oculta_en", null)
      .gte("fecha", desde.toISOString())
      .order("fecha", { ascending: false }),
  ]);

  return {
    eventos: (eventos.data ?? []) as unknown as Publicacion[],
    noticias: (noticias.data ?? []) as unknown as Publicacion[],
  };
}

/**
 * Las estrellas que dio cada persona en una sucursal, por usuario.
 *
 * Sirve para poner la calificación al lado de cada reseña: son dos tablas
 * distintas —el comentario y el voto— y esto es lo que las une. Se trae de un
 * jalón y no una consulta por reseña.
 */
export async function estrellasPorUsuario(sucursalId: string) {
  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("calificaciones")
    .select("usuario_id, estrellas")
    .eq("sucursal_id", sucursalId);

  return new Map<string, number>(
    (data ?? []).map((fila) => [fila.usuario_id as string, fila.estrellas as number]),
  );
}

export type MiResena = {
  id: string;
  texto: string;
  foto: string | null;
  /** Falso si ya la cambió hoy: el tope es un cambio al día. */
  puedeCambiarla: boolean;
};

/**
 * La reseña que esta persona tiene en este negocio, si tiene.
 *
 * Desde la migración 000017 es una sola y se actualiza: no hay historial de
 * comentarios de la misma persona, hay lo que piensa hoy. Cambiarla cuesta el
 * mismo tope que pedir mazorcas —una vez al día—, y eso se calcula aquí en hora
 * de Tabasco para que la pantalla y el trigger digan lo mismo de madrugada.
 */
export async function miResena(
  usuarioId: string,
  sucursalId: string,
): Promise<MiResena | null> {
  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("resenas")
    .select("id, texto, foto, fecha, fecha_edicion")
    .eq("usuario_id", usuarioId)
    .eq("sucursal_id", sucursalId)
    .maybeSingle();

  if (!data) return null;

  const enTabasco = (fecha: string) =>
    new Date(fecha).toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });

  const hoy = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Mexico_City",
  });

  return {
    id: data.id,
    texto: data.texto,
    foto: data.foto,
    puedeCambiarla: enTabasco(data.fecha_edicion ?? data.fecha) !== hoy,
  };
}
