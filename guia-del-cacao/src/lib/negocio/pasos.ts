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

/**
 * Las secciones del editor de un micrositio ya dado de alta.
 *
 * Son los tres pasos del alta más las reseñas, que en el alta no existen
 * —nadie ha podido calificar algo que todavía no sale— y en cambio son de lo
 * primero que un negocio publicado viene a mirar.
 *
 * Editar también va por secciones, no de corrido. Antes el micrositio publicado
 * se editaba en una sola columna: logo, portada, galería, acerca de, ubicación,
 * contacto, cinco redes, el catálogo entero y las reseñas al final. Cambiar un
 * teléfono eran cuatro pantallas de recorrido, y el catálogo se quedaba tan
 * abajo que parecía no estar.
 *
 * Comparten el `?paso=` de la barra del alta, que ya existía: son la misma
 * pregunta —qué parte del micrositio estoy tocando— y dos parámetros para lo
 * mismo obligarían a traducir de uno a otro cada vez que se guarda.
 */
export const SECCIONES_DEL_EDITOR = [...PASOS_DEL_ALTA, "resenas"] as const;

export type SeccionDelEditor = (typeof SECCIONES_DEL_EDITOR)[number];

export function esSeccionDelEditor(
  valor: string | undefined,
): valor is SeccionDelEditor {
  return !!valor && (SECCIONES_DEL_EDITOR as readonly string[]).includes(valor);
}

/** Cómo se llama cada sección y qué se hace en ella. */
export const NOMBRE_DEL_PASO: Record<
  SeccionDelEditor,
  { titulo: string; detalle: string }
> = {
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
    /*
      Decía "y es lo que eligen tus clientes al pedir mazorcas", que describía
      el QR del mostrador: una función apagada desde el lanzamiento. El negocio
      leía en la pantalla de alta una instrucción sobre algo que no existe.

      Lo que el catálogo hace hoy son las otras dos cosas, y las dos importan:
      es la mitad del micrositio, y es lo que alguien se lleva en el PDF.
    */
    detalle:
      "Lo que vendes. Hace falta al menos un producto para poder publicar: es lo que se ve en tu micrositio y lo que cualquiera puede descargar en PDF.",
  },
  resenas: {
    titulo: "Reseñas",
    detalle: "Lo que escriben tus clientes. Puedes responder cada una, una vez.",
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
