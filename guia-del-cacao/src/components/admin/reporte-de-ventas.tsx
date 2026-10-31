import type { Embudo, MesDeVentas } from "@/lib/datos/reporte-de-ventas";
import { ETAPAS } from "@/lib/ventas";
import { pesos } from "@/lib/tipos";

/**
 * Las piezas del reporte de ventas que comparten la página del equipo y la de
 * un vendedor: las cifras grandes, los meses y el embudo de la libreta.
 */

const NOMBRE_DEL_MES = new Intl.DateTimeFormat("es-MX", { month: "short", timeZone: "UTC" });

/** «2026-10» → «oct». */
function mesCorto(mes: string) {
  return NOMBRE_DEL_MES.format(new Date(`${mes}-15T12:00:00Z`)).replace(".", "");
}

export function Cifras({ datos }: { datos: { texto: string; valor: string; oro?: boolean }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {datos.map((dato) => (
        <div
          key={dato.texto}
          className="tarjeta-magica flex flex-col-reverse rounded-3xl border-2 border-ink/10 bg-white p-5"
        >
          <dt className="mt-1 text-sm font-bold uppercase tracking-wider text-cacao/70">{dato.texto}</dt>
          <dd className={`font-display text-3xl font-semibold ${dato.oro ? "text-mango" : ""}`}>{dato.valor}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Lo vendido mes por mes: una barra por mes con su monto encima, y debajo la
 * comisión, los cobros y los negocios nuevos. La barra es solo para ver la
 * tendencia de un golpe; el número exacto va escrito.
 */
export function VentasPorMes({ meses }: { meses: MesDeVentas[] }) {
  const tope = Math.max(...meses.map((m) => m.ventas), 1);

  return (
    <div className="rounded-3xl border-2 border-ink/10 bg-white p-5">
      <ol className="grid grid-cols-6 items-end gap-2 sm:gap-4" aria-label="Ventas de los últimos seis meses">
        {meses.map((m) => (
          <li key={m.mes} className="flex flex-col items-center gap-1 text-center">
            <span className="text-xs font-bold sm:text-sm">{m.ventas > 0 ? pesos(m.ventas) : "—"}</span>
            <span className="flex h-32 w-full items-end">
              <span
                className="w-full rounded-t-xl bg-mango"
                style={{ height: `${Math.max(2, (m.ventas / tope) * 100)}%`, opacity: m.ventas > 0 ? 1 : 0.25 }}
              />
            </span>
            <span className="font-bold capitalize">{mesCorto(m.mes)}</span>
          </li>
        ))}
      </ol>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[32rem] text-sm">
          <thead>
            <tr className="text-left text-cacao/70">
              <th className="py-2 pr-3 font-bold">Mes</th>
              <th className="py-2 pr-3 text-right font-bold">Vendido</th>
              <th className="py-2 pr-3 text-right font-bold">Comisión</th>
              <th className="py-2 pr-3 text-right font-bold">Cobros</th>
              <th className="py-2 text-right font-bold">Negocios nuevos</th>
            </tr>
          </thead>
          <tbody>
            {[...meses].reverse().map((m) => (
              <tr key={m.mes} className="border-t border-ink/10">
                <td className="py-2 pr-3 capitalize">
                  {mesCorto(m.mes)} {m.mes.slice(0, 4)}
                </td>
                <td className="py-2 pr-3 text-right font-bold">{pesos(m.ventas)}</td>
                <td className="py-2 pr-3 text-right">{pesos(m.comisiones)}</td>
                <td className="py-2 pr-3 text-right">{m.cobros}</td>
                <td className="py-2 text-right">{m.negociosNuevos}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Cuántos prospectos hay en cada paso de la libreta, en el orden del embudo. */
export function EmbudoDeVentas({
  embudo,
  vacio = "Todavía no hay prospectos apuntados en ninguna libreta.",
}: {
  embudo: Embudo;
  vacio?: string;
}) {
  const total = Object.values(embudo).reduce((s, n) => s + n, 0);

  if (total === 0) {
    return <p className="caja-vacia rounded-3xl bg-crema-2 p-6 text-cacao">{vacio}</p>;
  }

  return (
    <ul className="grid gap-2 rounded-3xl border-2 border-ink/10 bg-white p-5">
      {ETAPAS.map((etapa) => {
        const cuantos = embudo[etapa.valor];
        const ancho = (cuantos / total) * 100;
        return (
          <li key={etapa.valor} className="grid grid-cols-[9rem_1fr_2.5rem] items-center gap-3 text-sm sm:grid-cols-[11rem_1fr_3rem]">
            <span className="font-bold">{etapa.texto}</span>
            <span className="h-4 rounded-full bg-ink/5">
              <span
                className={`block h-4 rounded-full ${etapa.valor === "no_interesa" ? "bg-cacao/40" : etapa.valor === "pago" ? "bg-selva" : "bg-mango"}`}
                style={{ width: `${cuantos ? Math.max(3, ancho) : 0}%` }}
              />
            </span>
            <span className="text-right font-mono font-bold">{cuantos}</span>
          </li>
        );
      })}
    </ul>
  );
}
