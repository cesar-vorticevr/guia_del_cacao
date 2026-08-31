/**
 * Cuánto texto cabe en cada campo largo.
 *
 * No son caprichos: son las medidas de donde ese texto se va a ver. El "acerca
 * de" encabeza el micrositio y se recorta a tres renglones en la tarjeta del
 * directorio; la descripción de un producto vive en un renglón junto a su
 * precio. Sin tope, un negocio pega ahí su folleto entero y la tarjeta del
 * directorio se descuadra para todos los demás.
 *
 * Se aplican en dos sitios y los dos hacen falta: `maxLength` en el campo para
 * que nadie escriba de más sin darse cuenta, y una comprobación en la acción
 * del servidor, porque el atributo del navegador no detiene a quien manda la
 * petición a mano.
 */
/**
 * El mínimo de la contraseña, en un solo lugar para que el texto de ayuda del
 * formulario y la comprobación del servidor no se separen.
 *
 * Vive aquí y no en `auth/acciones.ts` porque ese archivo es `"use server"`:
 * ahí solo pueden exportarse funciones asíncronas, y una constante exportada
 * deja el módulo entero sin exportaciones. La app deja de compilar de golpe y
 * el error que se ve es "cerrarSesion doesn't exist", que no apunta a nada.
 */
export const MINIMO_CONTRASENA = 8;

/**
 * Cuántas fotos lleva una publicación de la comunidad: de una a cuatro.
 *
 * Vive aquí y no en `foro/acciones.ts` por lo mismo que el mínimo de la
 * contraseña: ese archivo es `"use server"` y ahí solo pueden exportarse
 * funciones asíncronas. El mismo `check` está en la base, que es la que manda.
 */
export const TOPE_FOTOS = 4;

export const LIMITES = {
  /** Un párrafo largo: alcanza para contar el negocio sin volverse un folleto. */
  acercaDe: 600,
  /** Dos renglones. Es un descriptor, no una ficha técnica. */
  descripcionProducto: 160,
  /** Lo que cabe en la tarjeta de un evento o una noticia antes del "ver más". */
  cuerpoPublicacion: 1200,
  /** Los mismos que impone la base en `publicaciones`. */
  tituloPublicacion: 120,
  contenidoPublicacion: 3000,
} as const;

/**
 * Comprueba un texto contra su tope. Devuelve el reclamo, o null si cabe.
 * El nombre va en la frase para que el error diga cuál de los campos se pasó.
 */
export function revisarLargo(
  texto: string | null,
  limite: number,
  campo: string,
): string | null {
  if (!texto || texto.length <= limite) return null;

  return `${campo} se pasa por ${texto.length - limite} caracteres: el tope son ${limite}.`;
}
