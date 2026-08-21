const BUCKET = "micrositios";

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
