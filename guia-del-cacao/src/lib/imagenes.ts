const BUCKET = "micrositios";

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
export function urlImagen(ruta: string | null | undefined) {
  if (!ruta) return null;

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return `${base}/storage/v1/object/public/${BUCKET}/${ruta}`;
}
