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
  slug: string;
  nombre_sucursal: string;
  logo: string | null;
  imagen_fondo: string | null;
  acerca_de: string | null;
  tier_id: number | null;
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
  fecha_publicacion: string;
  rango_exclusivo?: number | null;
  sucursales: { slug: string; nombre_sucursal: string } | null;
};

const CAMPOS_TARJETA =
  "id, slug, nombre_sucursal, logo, imagen_fondo, acerca_de, tier_id, marcas(nombre_comercial, categoria_id)";

/**
 * Directorio.
 *
 * El Tier 3 va primero: no es un adorno, es parte de lo que se paga
 * ("primeros lugares en el directorio", estructura §3).
 */
export async function listarDirectorio(categoriaId?: number) {
  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("sucursales")
    .select(CAMPOS_TARJETA)
    .eq("estado", "publicado")
    .order("tier_id", { ascending: false })
    .order("fecha_publicacion", { ascending: false });

  const todas = (data ?? []) as unknown as TarjetaDirectorio[];

  if (!categoriaId) return todas;
  return todas.filter((s) => s.marcas?.categoria_id === categoriaId);
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
    .select("id, slug, nombre_sucursal, imagen_fondo, banners(imagen, texto, orden_rotacion)")
    .eq("estado", "publicado")
    .eq("tier_id", 3)
    .order("fecha_publicacion", { ascending: false });

  type Fila = {
    id: string;
    slug: string;
    nombre_sucursal: string;
    imagen_fondo: string | null;
    banners: { imagen: string; texto: string | null; orden_rotacion: number }[];
  };

  return ((data ?? []) as unknown as Fila[])
    .map((fila) => {
      const propio = fila.banners?.[0];
      return {
        slug: fila.slug,
        nombre: fila.nombre_sucursal,
        imagen: propio?.imagen ?? fila.imagen_fondo,
        texto: propio?.texto ?? null,
        orden: propio?.orden_rotacion ?? 99,
      };
    })
    .sort((a, b) => a.orden - b.orden);
}

const CAMPOS_PUBLICACION =
  "id, titulo, subtitulo, contenido, imagenes, fecha_publicacion, sucursales(slug, nombre_sucursal)";

export async function listarEventos() {
  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("eventos")
    .select(`${CAMPOS_PUBLICACION}, fecha_evento, rango_exclusivo`)
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
      "id, texto, fecha, respuesta_marca, fecha_respuesta, usuario_id, perfiles_publicos(nombre, foto_perfil)",
    )
    .eq("sucursal_id", sucursalId)
    .order("fecha", { ascending: false });

  return (data ?? []) as unknown as Resena[];
}
