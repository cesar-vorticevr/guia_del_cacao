/**
 * Búsqueda tolerante, para escribir mal y encontrar igual.
 *
 * Quien busca en la feria escribe con una mano, con prisa y sin acentos:
 * "chocolateria", "grijalba", "musseo". Un filtro que exija la palabra exacta
 * y desde la primera letra no le sirve a nadie. Aquí una coincidencia vale por
 * tres caminos distintos, del más obvio al más flexible:
 *
 *   1. El texto contiene lo escrito ("choco" → "Chocolatería").
 *   2. Las letras aparecen en orden aunque falten otras ("chclt" → "Chocolate").
 *   3. Alguna palabra se parece lo bastante, contando erratas ("grijalba" →
 *      "Grijalva").
 *
 * Es a propósito una comparación de texto y no una consulta a Postgres: el
 * directorio de una feria son decenas de negocios, no millones, y filtrar en
 * el navegador hace que la lista se mueva mientras se escribe, sin esperar al
 * servidor. Si algún día son miles, esto se cambia por `pg_trgm`.
 */

/** Sin acentos, sin mayúsculas, sin espacios de sobra. */
export function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** ¿Aparecen todas las letras de `aguja` en `pajar`, en orden? */
function esSubsecuencia(aguja: string, pajar: string) {
  let i = 0;

  for (const letra of pajar) {
    if (letra === aguja[i]) i++;
    if (i === aguja.length) return true;
  }

  return i === aguja.length;
}

/**
 * Distancia de edición, cortada en `tope`.
 *
 * Se corta a propósito: sin el tope, comparar contra un texto largo cuesta
 * tiempo para acabar devolviendo un número enorme que de todos modos se iba a
 * descartar.
 */
function distancia(a: string, b: string, tope: number) {
  if (Math.abs(a.length - b.length) > tope) return tope + 1;

  let previa = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i++) {
    const actual = [i];
    let mejor = i;

    for (let j = 1; j <= b.length; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      actual[j] = Math.min(actual[j - 1] + 1, previa[j] + 1, previa[j - 1] + costo);
      mejor = Math.min(mejor, actual[j]);
    }

    if (mejor > tope) return tope + 1;
    previa = actual;
  }

  return previa[b.length];
}

/**
 * ¿Este texto responde a lo que se escribió?
 *
 * `campos` son todos los textos del negocio donde vale la pena buscar: marca,
 * sucursal, categoría, descripción. Basta con que uno responda.
 */
export function parecido(consulta: string, campos: (string | null | undefined)[]) {
  const busca = normalizar(consulta);
  if (busca.length === 0) return true;

  const texto = normalizar(campos.filter(Boolean).join(" "));
  if (texto.length === 0) return false;

  if (texto.includes(busca)) return true;

  // Con una o dos letras, lo demás es demasiado flexible: devolvería medio
  // directorio y la lista dejaría de moverse al escribir.
  if (busca.length < 3) return false;

  if (esSubsecuencia(busca, texto)) return true;

  // Una errata por cada cuatro letras, hasta dos. "grijalba" alcanza a
  // "grijalva"; "chocolate" no alcanza a "cafetería".
  const tope = Math.min(2, Math.floor(busca.length / 4));
  if (tope === 0) return false;

  return texto
    .split(/\s+/)
    .some((palabra) => distancia(busca, palabra, tope) <= tope);
}
