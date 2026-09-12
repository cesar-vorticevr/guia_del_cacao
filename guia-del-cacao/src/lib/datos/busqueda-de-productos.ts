import { crearClienteServidor } from "@/lib/supabase/server";

/** Lo mínimo del catálogo que hace falta para buscar y para decir qué encontró. */
export type ProductoBuscable = {
  nombre: string;
  precio: number | null;
};

/**
 * El catálogo de cada marca, para que el buscador encuentre por producto.
 *
 * Quien llega a esta guía no conoce ningún negocio por su nombre: busca
 * «molinillo» o «chocolate de mesa». Hasta ahora el buscador solo miraba
 * nombres de marca, de sucursal, el «acerca de» y la categoría, así que esas
 * dos búsquedas no devolvían nada aunque media docena de negocios los
 * vendieran.
 *
 * Se pide el lote entero y no producto por sucursal porque la búsqueda es en el
 * navegador: los datos tienen que estar en la página antes de la primera letra.
 * El catálogo cuelga de la marca desde la migración 000022, así que el mapa va
 * por `marca_id`.
 */
export async function catalogoPorMarca(
  marcaIds: string[],
): Promise<Record<string, ProductoBuscable[]>> {
  if (marcaIds.length === 0) return {};

  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("productos_servicios")
    .select("marca_id, nombre, precio")
    .in("marca_id", [...new Set(marcaIds)])
    .order("nombre");

  const porMarca: Record<string, ProductoBuscable[]> = {};

  for (const fila of data ?? []) {
    const marca = fila.marca_id as string;
    porMarca[marca] ??= [];
    porMarca[marca].push({
      nombre: fila.nombre as string,
      precio: fila.precio === null ? null : Number(fila.precio),
    });
  }

  return porMarca;
}

/*
  Palabras que no dicen de qué es un producto: unen o miden. No entran en los
  atajos ni solas ni al final de una frase — "barra de" no es nada, "barra" sí.
*/
const VACIAS = new Set([
  "de", "del", "con", "en", "y", "o", "la", "el", "los", "las", "un", "una",
  "para", "por", "al", "sin", "a",
]);

/** Medidas y cantidades: "250", "g", "70%", "ml". Tampoco dicen qué es. */
const UNIDADES = ["g", "gr", "kg", "ml", "l", "pz", "pza"];

function esMedida(palabra: string) {
  return /^[\d.,%]+$/.test(palabra) || UNIDADES.includes(palabra);
}

/**
 * Las palabras con las que la gente busca, sacadas del catálogo real.
 *
 * No son los nombres completos de los productos —"Cacao en polvo 500 g",
 * "Barra 70% cacao"— sino el trozo que se repite entre negocios: "cacao en
 * polvo", "barra". Nadie escribe los gramos al buscar.
 *
 * Cómo se saca: cada nombre se parte en tramos por sus medidas, y de cada tramo
 * salen las palabras solas y las frases que **acaban donde acaba el tramo**.
 *
 * Las dos reglas son por lo mismo. La medida **corta** en vez de caerse, porque
 * si solo se quitara, "barra 70% cacao" dejaría pegadas dos palabras que nunca
 * estuvieron juntas y saldría el atajo "barra cacao", que nadie dice. Y solo
 * valen los finales porque en español el sustantivo va primero y lo que lo
 * matiza va detrás: de "barra con chile amashito", lo que se busca es "barra" o
 * "chile amashito", nunca "barra con chile", que se queda a medias.
 *
 * Cada frase se apunta con **en cuántos negocios** aparece, no cuántas veces: un
 * negocio con ocho barras no debe pesar más que ocho negocios con una.
 *
 * Después se queda la más larga de las que valen lo mismo. Si "cacao en polvo"
 * y "polvo" aparecen en los mismos cinco negocios, "polvo" sobra: la frase
 * larga dice lo mismo y se entiende sola. Pero si "barra" está en ocho y
 * "cacao en polvo" en seis, se quedan las dos: son búsquedas distintas.
 *
 * Solo entran las que están en **dos o más** negocios publicados. Un atajo que
 * lleva a un solo resultado no es un atajo: es un enlace a ese negocio, y para
 * eso ya está el directorio.
 */
export async function palabrasQueSeRepiten(limite = 8): Promise<string[]> {
  const supabase = await crearClienteServidor();

  /*
    Se filtra por sucursal publicada y no solo por producto: el catálogo de una
    marca en borrador existe en la base pero no se puede visitar, y ofrecer un
    atajo a algo invisible manda a una lista vacía.
  */
  const { data } = await supabase
    .from("productos_servicios")
    .select("nombre, marca_id, marcas!inner(sucursales!inner(estado))")
    .eq("marcas.sucursales.estado", "publicado");

  const marcasPorFrase = new Map<string, Set<string>>();

  for (const fila of data ?? []) {
    const marca = fila.marca_id as string;

    const palabras = (fila.nombre as string)
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .split(/[^a-z0-9%.,]+/)
      .filter(Boolean);

    // Los tramos: lo que hay entre medida y medida. "cacao en polvo 500 g" da
    // uno solo, ["cacao", "en", "polvo"]; "barra 70% cacao" da dos.
    const tramos: string[][] = [[]];
    for (const palabra of palabras) {
      if (esMedida(palabra)) tramos.push([]);
      else tramos[tramos.length - 1].push(palabra);
    }

    const apuntar = (trozo: string[]) => {
      // Una frase no empieza ni acaba en palabra vacía: "de cacao" y
      // "cacao en" no son cosas que alguien escriba en un buscador.
      if (VACIAS.has(trozo[0]) || VACIAS.has(trozo[trozo.length - 1])) return;

      const frase = trozo.join(" ");
      const yaEstan = marcasPorFrase.get(frase) ?? new Set<string>();
      yaEstan.add(marca);
      marcasPorFrase.set(frase, yaEstan);
    };

    for (const tramo of tramos) {
      for (const palabra of tramo) apuntar([palabra]);

      for (let n = 2; n <= 3 && n <= tramo.length; n++) {
        apuntar(tramo.slice(tramo.length - n));
      }
    }
  }

  const candidatas = [...marcasPorFrase.entries()]
    .filter(([, marcas]) => marcas.size >= 2)
    .map(([frase, marcas]) => ({ frase, cuantas: marcas.size }));

  // Fuera las que una frase más larga ya cubre con el mismo peso.
  const sobrevive = candidatas.filter(
    (corta) =>
      !candidatas.some(
        (larga) =>
          larga.frase !== corta.frase &&
          larga.cuantas === corta.cuantas &&
          larga.frase.split(" ").length > corta.frase.split(" ").length &&
          ` ${larga.frase} `.includes(` ${corta.frase} `),
      ),
  );

  return sobrevive
    .sort(
      (a, b) =>
        b.cuantas - a.cuantas ||
        b.frase.split(" ").length - a.frase.split(" ").length ||
        a.frase.localeCompare(b.frase, "es"),
    )
    .slice(0, limite)
    .map(({ frase }) => frase);
}
