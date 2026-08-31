import Link from "next/link";

export type Pestana = {
  clave: string;
  texto: string;
  cuenta?: number;
  /**
   * Destino propio, para las secciones que son una pantalla aparte. Sin él, la
   * pestaña se queda en el panel cambiando el `?ver=`.
   */
  href?: string;
  /** Late cuando hay algo nuevo sin ver. */
  destella?: boolean;
};

/**
 * Las secciones del panel, en una fila.
 *
 * Antes iban una debajo de otra y llegar al catálogo era bajar tres pantallas.
 * Puestas en fila, cada una es una pantalla completa y cambiar de sección es un
 * toque, no un recorrido.
 *
 * Son enlaces con `?ver=`, no estado del cliente: así la sección en la que uno
 * está sobrevive a recargar, se puede compartir y el botón de atrás del
 * navegador hace lo que se espera.
 */
export function Pestanas({
  pestanas,
  actual,
  base,
}: {
  pestanas: Pestana[];
  actual: string;
  /** Ruta a la que se le cuelga el `?ver=`. */
  base: string;
}) {
  return (
    <nav aria-label="Secciones del panel" className="border-b-2 border-ink/10">
      <ul className="flex flex-wrap gap-1">
        {pestanas.map((pestana) => {
          const activa = pestana.clave === actual;

          return (
            <li key={pestana.clave}>
              <Link
                href={pestana.href ?? `${base}?ver=${pestana.clave}`}
                aria-current={activa ? "page" : undefined}
                className={`-mb-0.5 inline-flex min-h-12 items-center gap-2 rounded-t-2xl border-b-4 px-5 font-bold transition-colors ${
                  activa
                    ? "border-selva text-selva-2"
                    : "border-transparent text-cacao/70 hover:text-cacao"
                }`}
              >
                {pestana.texto}
                {pestana.cuenta !== undefined && (
                  <span
                    className={`rounded-full px-2 py-0.5 font-mono text-xs ${
                      pestana.destella
                        ? "animate-pulse bg-guayaba font-bold text-ink motion-reduce:animate-none"
                        : activa
                          ? "bg-crema-2 text-selva-2"
                          : "bg-ink/5 text-cacao/70"
                    }`}
                  >
                    {pestana.cuenta}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
