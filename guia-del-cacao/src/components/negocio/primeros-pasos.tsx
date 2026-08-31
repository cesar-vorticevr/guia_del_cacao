import Link from "next/link";

export type EstadoDePaso = "hecho" | "ahora" | "despues";

export type Paso = {
  titulo: string;
  detalle: string;
  estado: EstadoDePaso;
  /** Los renglones que faltan, cuando el paso es una lista de pendientes. */
  pendientes?: string[];
  accion?: { href: string; texto: string };
  /** Un formulario dentro del paso, cuando la acción no es ir a otra pantalla. */
  contenido?: React.ReactNode;
};

/**
 * El camino de un negocio nuevo, dibujado.
 *
 * Existe porque el panel recién creado enseñaba tres botones al mismo nivel
 * —Mazorcas, Eventos y noticias, Nueva sucursal— y un aviso de que no había
 * nada. Los tres se ven igual de importantes y solo uno se puede usar: quien
 * llega por primera vez tiene que adivinar por dónde empezar.
 *
 * Los pasos se numeran y solo uno está activo a la vez. El que sigue se ve, pero
 * apagado: saber qué viene después es lo que hace que el primero no se sienta
 * un trámite suelto.
 */
export function PrimerosPasos({
  titulo,
  entrada,
  pasos,
}: {
  titulo: string;
  entrada?: string;
  pasos: Paso[];
}) {
  return (
    <section className="mt-6 rounded-[2rem] border-2 border-ink/10 bg-white p-6 shadow-dura sm:p-8">
      <h2 className="font-display text-2xl text-selva-2">{titulo}</h2>
      {entrada && <p className="mt-2 max-w-prose text-cacao">{entrada}</p>}

      <ol className="mt-6 grid gap-4">
        {pasos.map((paso, i) => (
          <li
            key={paso.titulo}
            className={`flex gap-4 rounded-3xl border-2 p-5 ${
              paso.estado === "ahora"
                ? "border-mango bg-mango/10"
                : "border-ink/10 bg-crema-2/50"
            }`}
          >
            {/*
              El número se apaga cuando el paso ya pasó y se convierte en una
              palomita: de un vistazo se ve cuánto queda, que es lo que sostiene
              las ganas de terminar.
            */}
            <span
              aria-hidden="true"
              className={`grid size-9 shrink-0 place-items-center rounded-full font-display font-bold ${
                paso.estado === "hecho"
                  ? "bg-selva text-crema"
                  : paso.estado === "ahora"
                    ? "bg-mango text-ink"
                    : "bg-ink/10 text-cacao/60"
              }`}
            >
              {paso.estado === "hecho" ? "✓" : i + 1}
            </span>

            <div className="min-w-0 flex-1">
              <p
                className={`font-display text-lg font-semibold ${
                  paso.estado === "despues" ? "text-cacao/60" : "text-selva-2"
                }`}
              >
                {paso.titulo}
                {paso.estado === "hecho" && (
                  <span className="sr-only"> (hecho)</span>
                )}
              </p>

              <p
                className={
                  paso.estado === "despues" ? "mt-1 text-cacao/60" : "mt-1 text-cacao"
                }
              >
                {paso.detalle}
              </p>

              {paso.pendientes && paso.pendientes.length > 0 && (
                <ul className="mt-3 grid gap-1.5">
                  {paso.pendientes.map((pendiente) => (
                    <li key={pendiente} className="flex items-center gap-2 text-cacao">
                      <span
                        aria-hidden="true"
                        className="size-2 shrink-0 rounded-full bg-guayaba"
                      />
                      Falta {pendiente}
                    </li>
                  ))}
                </ul>
              )}

              {paso.contenido && paso.estado === "ahora" && (
                <div className="mt-4">{paso.contenido}</div>
              )}

              {paso.accion && paso.estado !== "despues" && (
                <Link
                  href={paso.accion.href}
                  className="mt-4 inline-flex min-h-11 items-center rounded-full bg-selva px-5 py-2.5 font-bold text-crema shadow-dura-sm transition-transform active:translate-y-0.5"
                >
                  {paso.accion.texto}
                </Link>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
