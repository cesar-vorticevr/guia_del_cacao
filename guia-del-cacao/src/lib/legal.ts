/**
 * Los datos del responsable, en un solo sitio.
 *
 * Los piden las dos páginas legales y la ley: el aviso de privacidad mexicano
 * (LFPDPPP, art. 16) exige identidad y domicilio de quien trata los datos, y
 * quien revisa el sitio —Google incluido— los busca ahí. Repetirlos en cada
 * página era garantizar que el día que cambie el domicilio quede uno viejo.
 *
 * `ACTUALIZADO` se cambia **a mano y solo cuando el texto cambia de fondo**. No
 * se pone la fecha de hoy con `new Date()`: una fecha que se mueve sola cada vez
 * que alguien entra dice «revisado hoy» de un documento que nadie tocó en un
 * año, y es justo el dato que sirve para saber si lo que aceptaste sigue
 * vigente.
 */
export const RESPONSABLE = "Vórtice VR";

export const DOMICILIO = "Villahermosa, Tabasco, México";

/** Última vez que estos textos cambiaron de fondo. */
export const ACTUALIZADO = "11 de septiembre de 2026";
