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
 * Cuántos archivos lleva una publicación de la comunidad: de uno a diez.
 *
 * Diez porque es lo que aguanta un carrusel antes de que nadie llegue al final.
 * Fueron cuatro hasta que el muro pasó a leerse como un feed.
 *
 * Vive aquí y no en `foro/acciones.ts` por lo mismo que el mínimo de la
 * contraseña: ese archivo es `"use server"` y ahí solo pueden exportarse
 * funciones asíncronas. El mismo `check` está en la base, que es la que manda.
 */
export const TOPE_FOTOS = 10;

/**
 * Cuánto puede durar un video de la comunidad.
 *
 * **Solo lo comprueba el navegador**, midiendo el archivo antes de subirlo:
 * Postgres no sabe cuánto dura un video y aquí no hay nada que lo recodifique.
 * Lo que sí acota de verdad es el tope de peso del bucket —20 MB—, que es el
 * número del que depende el costo, así que colar un video largo por fuera de
 * la interfaz no sale más caro que subir uno corto de buena calidad.
 *
 * Treinta segundos, además, no es solo cuenta: en un muro nadie mira más.
 */
export const TOPE_SEGUNDOS_VIDEO = 30;

/**
 * Lo más alta que se enseña una foto, en proporción ancho/alto.
 *
 * 4:5 es el vertical de cualquier muro: cabe una persona de cuerpo entero y un
 * cartel completo, y aun así deja ver que debajo sigue habiendo algo. Lo que
 * venga más alto —una captura de pantalla de teléfono, un 9:16 de reel— se
 * recorta por arriba y por abajo hasta aquí.
 *
 * Estuvo en un tope de píxeles (30rem) y era peor: la misma foto se recortaba
 * distinto según el ancho de la pantalla, así que no había forma de enseñar en
 * la vista previa cómo iba a quedar. Una proporción no depende del aparato.
 *
 * Vive aquí porque lo usan los dos sitios que tienen que coincidir: el carrusel
 * que la pinta y la vista previa que la promete. Si se separan, la vista previa
 * miente.
 */
export const PROPORCION_MINIMA = 4 / 5;

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
