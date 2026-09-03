/** Los dos buckets: en uno escribe el negocio, en el otro el cliente. */
export const BUCKET_MICROSITIOS = "micrositios";
export const BUCKET_RESENAS = "resenas";

/** Tope de peso, igual al que impone el bucket en la migración de storage. */
export const TOPE_MB = 5;
export const TOPE_BYTES = TOPE_MB * 1024 * 1024;

export const FORMATOS = ["image/jpeg", "image/png", "image/webp", "image/avif"];

/** Lo que acepta el campo de archivo del navegador. */
export const ACEPTA = FORMATOS.join(",");

/**
 * Medidas sugeridas, no obligatorias: la plataforma recorta lo que le den.
 *
 * El logo es cuadrado porque se muestra en círculos y cuadros pequeños del
 * directorio; cualquier otra proporción se recortaría por los lados.
 *
 * La de fondo es horizontal porque encabeza el micrositio a todo lo ancho.
 * 8:3 es el punto medio entre el encabezado de escritorio (muy apaisado) y el
 * de celular (más alto): con esa proporción se recorta poco en ambos.
 */
export const MEDIDAS = {
  logo: "Cuadrada. Lo ideal: 512 × 512 px.",
  fondo: "Horizontal. Lo ideal: 1600 × 600 px (proporción 8:3).",
  galeria: "Horizontal se ve mejor. Lo ideal: 1200 × 800 px.",
  producto: "Cuadrada. Lo ideal: 800 × 800 px.",
  cupon: "Cuadrada. Lo ideal: 800 × 800 px. Es la que se ve en la lista.",
  resena: "La que tengas. Se muestra recortada a lo ancho.",
  publicacion:
    "En la lista se recorta en cuadrado; completa se ve al abrir la publicación.",
} as const;

export const PESO = `Máximo ${TOPE_MB} MB. JPG, PNG, WebP o AVIF.`;

/**
 * Revisa peso y formato antes de subir.
 *
 * El bucket rechaza lo que no cumpla, pero su error llega en inglés y sin
 * decir cuál fue el problema. Más vale decirlo aquí, con el número a la vista.
 */
export function revisarImagen(archivo: unknown): string | null {
  if (!(archivo instanceof File) || archivo.size === 0) {
    return "Elige una imagen.";
  }

  if (archivo.size > TOPE_BYTES) {
    const pesa = (archivo.size / 1024 / 1024).toFixed(1);
    return `Esa imagen pesa ${pesa} MB y el máximo son ${TOPE_MB} MB. Redúcela e inténtalo de nuevo.`;
  }

  if (!FORMATOS.includes(archivo.type)) {
    return "Ese formato no se acepta. Usa JPG, PNG, WebP o AVIF.";
  }

  return null;
}

/**
 * URL pública de una imagen del bucket.
 *
 * Se arma a mano en vez de pedírsela al cliente de Supabase porque es una
 * plantilla fija: en un directorio con decenas de tarjetas, crear un cliente
 * por imagen sería trabajo tirado.
 */
export function urlImagen(
  ruta: string | null | undefined,
  bucket: string = BUCKET_MICROSITIOS,
) {
  if (!ruta) return null;

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return `${base}/storage/v1/object/public/${bucket}/${ruta}`;
}

/** El bucket donde viven las fotos de la comunidad. */
export const BUCKET_COMUNIDAD = "comunidad";

/**
 * La URL de una foto de publicación.
 *
 * Hay fotos en dos buckets: las de las noticias que se migraron en la 000029
 * siguen en `micrositios`, colgando de su sucursal, y las nuevas van a
 * `comunidad`, colgando de su autor. No se distinguen por la forma de la ruta
 * —las dos empiezan por un uuid—, así que las nuevas se guardan con el bucket
 * escrito delante. Es feo de mirar en la base y es lo que evita tener que
 * adivinar, o mover archivos de sitio solo para uniformarlo.
 */
export function urlDePublicacion(ruta: string | null | undefined) {
  if (!ruta) return null;

  const prefijo = `${BUCKET_COMUNIDAD}/`;

  return ruta.startsWith(prefijo)
    ? urlImagen(ruta.slice(prefijo.length), BUCKET_COMUNIDAD)
    : urlImagen(ruta);
}

// ---------------------------------------------------------------------------
// Video
// ---------------------------------------------------------------------------

/**
 * Lo que se puede mandar con una reseña o como comprobante: foto o video.
 *
 * El video pesa otra cosa —con 5 MB no cabe nada grabado con celular—, así que
 * tiene su propio tope. Los dos límites tienen que coincidir con los del bucket
 * o el error llega en inglés y sin decir cuál fue el problema.
 */
export const TOPE_MEDIO_MB = 20;
export const TOPE_MEDIO_BYTES = TOPE_MEDIO_MB * 1024 * 1024;

export const FORMATOS_VIDEO = ["video/mp4", "video/webm", "video/quicktime"];
export const FORMATOS_MEDIO = [...FORMATOS, ...FORMATOS_VIDEO];

export const ACEPTA_MEDIO = FORMATOS_MEDIO.join(",");

export const PESO_MEDIO = `Máximo ${TOPE_MEDIO_MB} MB. Foto (JPG, PNG, WebP, AVIF) o video (MP4, WebM, MOV).`;

export function revisarMedio(archivo: unknown): string | null {
  if (!(archivo instanceof File) || archivo.size === 0) {
    return "Elige una foto o un video.";
  }

  if (archivo.size > TOPE_MEDIO_BYTES) {
    const pesa = (archivo.size / 1024 / 1024).toFixed(1);
    return `Eso pesa ${pesa} MB y el máximo son ${TOPE_MEDIO_MB} MB. Graba algo más corto o baja la calidad.`;
  }

  if (!FORMATOS_MEDIO.includes(archivo.type)) {
    return "Ese formato no se acepta. Manda una foto (JPG, PNG, WebP, AVIF) o un video (MP4, WebM, MOV).";
  }

  return null;
}

/**
 * ¿La ruta apunta a un video?
 *
 * Se decide por la extensión y no por una columna aparte porque el nombre del
 * archivo lo pone la aplicación al subirlo: guardarlo dos veces sería tener dos
 * versiones de la misma verdad, con una destinada a quedarse atrás.
 */
export function esVideo(ruta: string | null | undefined) {
  if (!ruta) return false;
  return /\.(mp4|webm|mov|m4v)$/i.test(ruta);
}
