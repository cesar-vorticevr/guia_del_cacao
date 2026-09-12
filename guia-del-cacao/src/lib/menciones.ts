import { normalizar } from "@/lib/busqueda";

/**
 * Etiquetar a alguien con un arroba, dentro de una conversación.
 *
 * La mención **no se guarda aparte**: vive en el texto del comentario, como la
 * escribió quien la escribió. No hay tabla de menciones ni columna que apunte a
 * nadie, y es a propósito — lo que hace falta es que se lea a quién le hablas,
 * y para eso basta el texto. El día que haya avisos («te etiquetaron») habrá
 * que guardarlas; hoy no los hay, y una tabla que nadie lee es una tabla que se
 * desincroniza en silencio.
 *
 * Los nombres llevan espacios —«César García»— así que no se pueden delimitar
 * con la palabra siguiente. Se resuelven **contra la lista de quienes
 * participaron**: al pintar se busca, después de cada arroba, el nombre más
 * largo de esa lista que encaje. Un arroba seguido de algo que no es de nadie
 * de la conversación se queda como texto llano, que es lo honesto: no señala a
 * nadie porque no hay nadie a quien señalar.
 */

/** Un trozo de comentario: o es texto, o es una etiqueta. */
export type Trozo = { texto: string; mencion: boolean };

/**
 * Parte el texto en trozos para pintar las etiquetas distintas del resto.
 *
 * Los nombres se prueban de más largo a más corto: si en la conversación están
 * «Ana» y «Ana María», `@Ana María` tiene que salir entera y no como «Ana»
 * seguida de « María».
 *
 * La comparación es sin mayúsculas pero **con acentos**: normalizarlos cambia
 * el largo de la cadena (la NFD separa la tilde en otro carácter) y entonces el
 * trozo que se corta ya no coincide con el que se midió. Como el nombre lo
 * inserta el propio selector, escrito a mano solo falla quien se salta la
 * tilde, y eso se queda en texto llano.
 */
export function trozosConMenciones(texto: string, nombres: string[]): Trozo[] {
  const ordenados = [...nombres]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  if (ordenados.length === 0) return [{ texto, mencion: false }];

  const trozos: Trozo[] = [];
  let llano = "";

  const cerrarLlano = () => {
    if (llano) {
      trozos.push({ texto: llano, mencion: false });
      llano = "";
    }
  };

  let i = 0;

  while (i < texto.length) {
    if (texto[i] === "@") {
      const resto = texto.slice(i + 1);
      const nombre = ordenados.find((candidato) =>
        resto.toLowerCase().startsWith(candidato.toLowerCase()),
      );

      if (nombre) {
        cerrarLlano();
        trozos.push({ texto: `@${resto.slice(0, nombre.length)}`, mencion: true });
        i += 1 + nombre.length;
        continue;
      }
    }

    llano += texto[i];
    i++;
  }

  cerrarLlano();

  return trozos;
}

/**
 * ¿Está escribiendo una etiqueta ahora mismo?
 *
 * Devuelve dónde empieza el arroba y lo escrito desde él hasta el cursor, o
 * `null` si no hay etiqueta en curso. Es lo que decide si se abre el selector.
 */
export function mencionEnCurso(texto: string, cursor: number) {
  const antes = texto.slice(0, cursor);
  const arroba = antes.lastIndexOf("@");

  if (arroba === -1) return null;

  /*
    El arroba tiene que abrir palabra. Sin esto, escribir un correo en un
    comentario —«escríbeme a hola@sitio.mx»— abriría el selector a media
    dirección.
  */
  const anterior = arroba === 0 ? "" : antes[arroba - 1];
  if (anterior && !/\s/.test(anterior)) return null;

  const consulta = antes.slice(arroba + 1);

  // Un nombre no lleva saltos de línea, y pasadas cuarenta letras ya no está
  // escribiendo un nombre: está escribiendo y el arroba se quedó atrás.
  if (consulta.includes("\n") || consulta.length > 40) return null;

  return { desde: arroba, consulta };
}

/**
 * A quién ofrecerle, dado lo que va escrito.
 *
 * Con el arroba a secas salen todos: es el gesto de «a ver quién hay». Se
 * limita a seis para que el selector no tape el comentario que se está
 * contestando.
 */
export function candidatosDeMencion<T extends { nombre: string }>(
  participantes: T[],
  consulta: string,
  tope = 6,
): T[] {
  const busca = normalizar(consulta);

  const encajan = busca
    ? participantes.filter((p) => normalizar(p.nombre).includes(busca))
    : participantes;

  return encajan.slice(0, tope);
}
