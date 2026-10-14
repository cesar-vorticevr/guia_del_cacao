import Link from "next/link";

/**
 * Buscador y paginación de las listas del panel de administración.
 *
 * Micrositios y personas se pintaban enteros, uno debajo de otro: con seis
 * personas no se notaba, con el Festival serían cientos de tarjetas. Ahora van
 * de 20 en 20 (`POR_PAGINA` en `lib/datos/admin.ts`) y con buscador.
 *
 * Todo viaja en la URL (`?q=`, `?pagina=`), no en estado del cliente: recargar
 * no pierde la búsqueda, se puede compartir y el botón de atrás funciona.
 */

/** Arma la URL de la lista con los parámetros que se le pasan, sin los vacíos. */
export function enlaceDeLista(base: string, parametros: Record<string, string | number | undefined>) {
  const buscados = new URLSearchParams();

  for (const [clave, valor] of Object.entries(parametros)) {
    // La página 1 no se escribe: es la que se abre sin decir nada.
    if (valor === undefined || valor === "" || (clave === "pagina" && Number(valor) <= 1)) continue;
    buscados.set(clave, String(valor));
  }

  const texto = buscados.toString();
  return texto ? `${base}?${texto}` : base;
}

/** El número de página de la URL, o 1 si no viene o no es un número. */
export function numeroDePagina(valor: string | undefined) {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero > 0 ? numero : 1;
}

export function Buscador({
  base,
  busqueda,
  ayuda,
  ocultos = {},
}: {
  base: string;
  busqueda: string;
  /** Qué se puede buscar, dicho en el propio campo. */
  ayuda: string;
  /** Otros filtros que tienen que sobrevivir a una búsqueda nueva. */
  ocultos?: Record<string, string | undefined>;
}) {
  return (
    <form action={base} method="get" role="search" className="flex gap-2">
      {Object.entries(ocultos).map(([clave, valor]) =>
        valor ? <input key={clave} type="hidden" name={clave} value={valor} /> : null,
      )}
      <label htmlFor="busqueda" className="sr-only">
        Buscar
      </label>
      <input
        id="busqueda"
        name="q"
        type="search"
        defaultValue={busqueda}
        placeholder={ayuda}
        className="min-w-0 flex-1 rounded-full border-2 border-selva/20 bg-white px-5 py-3 text-base text-ink focus:border-selva"
      />
      <button
        type="submit"
        className="min-h-12 shrink-0 rounded-full bg-selva px-5 font-bold text-crema"
      >
        Buscar
      </button>
      {busqueda && (
        <Link
          href={enlaceDeLista(base, ocultos)}
          className="flex min-h-12 shrink-0 items-center rounded-full border-2 border-selva/25 px-4 font-bold text-selva-2"
        >
          Limpiar
        </Link>
      )}
    </form>
  );
}

/**
 * «Anterior · página 2 de 9 · Siguiente», más cuántos hay en total.
 *
 * Son enlaces y no botones: cada página es una dirección propia.
 */
export function Paginacion({
  base,
  pagina,
  paginas,
  total,
  parametros = {},
  nombre,
}: {
  base: string;
  pagina: number;
  paginas: number;
  total: number;
  /** Los demás filtros de la lista, para que cambiar de página no los pierda. */
  parametros?: Record<string, string | undefined>;
  /** Cómo se cuentan: «micrositios», «personas»… */
  nombre: string;
}) {
  const clase =
    "flex min-h-11 items-center rounded-full border-2 border-selva/25 bg-white px-5 font-bold text-selva-2";

  return (
    <nav
      aria-label="Páginas"
      className="mt-6 flex flex-wrap items-center justify-between gap-3"
    >
      <p className="text-sm text-cacao/70">
        {total} {nombre}
        {paginas > 1 && ` · página ${pagina} de ${paginas}`}
      </p>

      {paginas > 1 && (
        <div className="flex gap-2">
          {pagina > 1 ? (
            <Link href={enlaceDeLista(base, { ...parametros, pagina: pagina - 1 })} className={clase}>
              ← Anterior
            </Link>
          ) : null}
          {pagina < paginas ? (
            <Link href={enlaceDeLista(base, { ...parametros, pagina: pagina + 1 })} className={clase}>
              Siguiente →
            </Link>
          ) : null}
        </div>
      )}
    </nav>
  );
}
