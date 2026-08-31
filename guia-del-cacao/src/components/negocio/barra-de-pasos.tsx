import Link from "next/link";
import { NOMBRE_DEL_PASO, PASOS_DEL_ALTA, type PasoDelAlta } from "@/lib/negocio/pasos";

/**
 * Dónde va uno dentro del alta guiada.
 *
 * Se puede saltar a cualquier paso tocándolo: el orden es una sugerencia, no un
 * carril. Quien ya sabe qué le falta —porque el panel se lo dijo— no debería
 * tener que pasar por los tres para llegar al que le importa.
 */
export function BarraDePasos({
  sucursalId,
  actual,
}: {
  sucursalId: string;
  actual: PasoDelAlta;
}) {
  const enCurso = PASOS_DEL_ALTA.indexOf(actual);

  return (
    <nav aria-label="Pasos del micrositio">
      <ol className="flex flex-wrap gap-2">
        {PASOS_DEL_ALTA.map((paso, i) => {
          const esActual = paso === actual;
          const yaPaso = i < enCurso;

          return (
            <li key={paso}>
              <Link
                href={`/negocio/panel/sucursal/${sucursalId}?paso=${paso}`}
                aria-current={esActual ? "step" : undefined}
                className={`flex min-h-11 items-center gap-2 rounded-full border-2 px-4 font-bold transition-transform active:translate-y-0.5 ${
                  esActual
                    ? "border-ink/10 bg-selva text-crema shadow-dura-sm"
                    : "border-selva/25 bg-white text-selva-2"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`grid size-6 shrink-0 place-items-center rounded-full font-mono text-xs ${
                    esActual
                      ? "bg-crema/25 text-crema"
                      : yaPaso
                        ? "bg-selva text-crema"
                        : "bg-ink/10 text-cacao/70"
                  }`}
                >
                  {yaPaso ? "✓" : i + 1}
                </span>
                {NOMBRE_DEL_PASO[paso].titulo}
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
