/**
 * Cuánto lleva algo ahí, en una o dos letras.
 *
 * Hay **dos escalas** y no una, porque se leen en dos sitios con prisas
 * distintas:
 *
 * - `enDiasYSemanas` es la del muro. Se eligió a propósito con solo `d` y `s`:
 *   en una retícula de cuatro columnas, seis unidades distintas —min, h, d, s,
 *   m, a— obligaban a leer la letra para saber de qué se hablaba; con dos, el
 *   número se entiende de un vistazo.
 * - `haceCuanto` es la de los comentarios. Ahí sí importan los minutos: una
 *   conversación de la última hora y una de anteayer son cosas distintas, y
 *   decirle "hoy" a las dos las iguala justo donde se nota.
 *
 * **Las dos se calculan en el servidor.** Calculadas en el navegador dirían un
 * número distinto al de la primera pintada —pasan segundos entre una y otra— y
 * React avisaría del desajuste en cada fila.
 */

const MINUTO = 60_000;
const HORA = 60 * MINUTO;
const DIA = 24 * HORA;
const SEMANA = 7 * DIA;

/**
 * La escala del muro: «hoy», «3d», «22s».
 *
 * Lo de hoy dice "hoy" y no "0d": cero días es un número que nadie usa para
 * decir que algo acaba de pasar. Y no hay meses ni años — una publicación de
 * hace cinco meses dice "22s", que es menos exacto que "5 meses" y más rápido
 * de comparar contra la de al lado.
 */
export function enDiasYSemanas(iso: string, ahora = Date.now()): string {
  const dias = Math.floor((ahora - new Date(iso).getTime()) / DIA);

  if (dias < 1) return "hoy";
  if (dias < 7) return `${dias}d`;

  return `${Math.floor(dias / 7)}s`;
}

/**
 * La escala de los comentarios: «ahora», «5m», «3h», «2d», «6s», «2a».
 *
 * Sube de unidad cuando la de abajo se queda sin sitio: a los sesenta minutos
 * pasa a horas, a las veinticuatro horas a días, a los siete días a semanas y
 * al año a años. Lo de hace menos de un minuto dice "ahora" — «0m» es un cero
 * que solo confunde en la cosa que la persona acaba de escribir.
 *
 * El futuro se trata como "ahora" en vez de dar un número negativo: puede
 * pasar por unos segundos de diferencia entre el reloj de la base y el del
 * servidor, y «-1m» parecería un error del sitio.
 */
export function haceCuanto(iso: string, ahora = Date.now()): string {
  const desde = Math.max(0, ahora - new Date(iso).getTime());

  if (desde < MINUTO) return "ahora";
  if (desde < HORA) return `${Math.floor(desde / MINUTO)}m`;
  if (desde < DIA) return `${Math.floor(desde / HORA)}h`;
  if (desde < SEMANA) return `${Math.floor(desde / DIA)}d`;

  const semanas = Math.floor(desde / SEMANA);
  if (semanas < 52) return `${semanas}s`;

  return `${Math.floor(semanas / 52)}a`;
}
