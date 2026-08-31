/**
 * El alta guiada de un micrositio, en orden.
 *
 * Vive aparte de `acciones.ts` porque ese archivo es `"use server"` y ahí solo
 * pueden exportarse funciones asíncronas. Y aparte del editor porque la acción
 * de guardar también necesita saber qué pasos existen: es ella quien redirige
 * al siguiente, y solo acepta un nombre que esté en esta lista.
 */
export const PASOS_DEL_ALTA = ["imagenes", "datos", "catalogo"] as const;

export type PasoDelAlta = (typeof PASOS_DEL_ALTA)[number];

/** Cómo se llama cada paso y qué se hace en él. */
export const NOMBRE_DEL_PASO: Record<PasoDelAlta, { titulo: string; detalle: string }> = {
  imagenes: {
    titulo: "Fotos",
    detalle:
      "Tu logo, la imagen que encabeza el micrositio y las fotos del carrusel. Se guardan solas al elegirlas.",
  },
  datos: {
    titulo: "Datos",
    detalle:
      "De qué va tu negocio, dónde está y por dónde te pueden contactar.",
  },
  catalogo: {
    titulo: "Catálogo",
    detalle:
      "Lo que vendes. Hace falta al menos un producto para poder publicar, y es lo que eligen tus clientes al pedir monedas.",
  },
};

export function esPasoDelAlta(valor: string | undefined): valor is PasoDelAlta {
  return !!valor && (PASOS_DEL_ALTA as readonly string[]).includes(valor);
}

/** El paso anterior y el siguiente, o `null` en las puntas. */
export function vecinos(paso: PasoDelAlta) {
  const i = PASOS_DEL_ALTA.indexOf(paso);

  return {
    anterior: i > 0 ? PASOS_DEL_ALTA[i - 1] : null,
    siguiente: i < PASOS_DEL_ALTA.length - 1 ? PASOS_DEL_ALTA[i + 1] : null,
  };
}
