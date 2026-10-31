import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Cifras, EmbudoDeVentas, VentasPorMes } from "@/components/admin/reporte-de-ventas";
import { detalleDeVendedor, type Embudo } from "@/lib/datos/reporte-de-ventas";
import { COMISION_DE_EMBAJADOR } from "@/lib/precios";
import { ETAPAS } from "@/lib/ventas";
import { pesos } from "@/lib/tipos";

export const metadata: Metadata = { title: "Vendedor · Administración" };

const FECHA = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "America/Mexico_City",
});

/** «2027-04-30» → «30 abr 2027», sin que la zona horaria lo corra un día. */
function dia(fecha: string) {
  return FECHA.format(new Date(fecha.length === 10 ? `${fecha}T12:00:00Z` : fecha));
}

const TEXTO_DE_ETAPA = Object.fromEntries(ETAPAS.map((e) => [e.valor, e.texto]));

/**
 * Cómo va un vendedor: lo mismo que ve él en /ventas —sus números, los
 * negocios que trajo y su libreta— más lo que solo ve el administrador. La
 * libreta se lee, no se edita: es suya.
 */
export default async function Vendedor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detalle = await detalleDeVendedor(id);
  if (!detalle) notFound();

  const { vendedor, negocios, meses, prospectos, pagos, cuentas } = detalle;
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(new Date());

  const embudo = ETAPAS.reduce(
    (cuenta, etapa) => ({ ...cuenta, [etapa.valor]: prospectos.filter((p) => p.etapa === etapa.valor).length }),
    {} as Embudo,
  );
  const cerrados = embudo.pago;
  const conversion = prospectos.length ? Math.round((cerrados / prospectos.length) * 100) : 0;

  return (
    <div className="grid gap-8">
      <Link href="/admin/embajadores" className="text-sm font-bold text-mango">
        ← Todo el equipo
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="antetitulo">Vendedor{vendedor.estado === "pausado" && " · en pausa"}</p>
          <h1 className="mt-2 font-display text-4xl font-medium tracking-tight">{vendedor.nombre}</h1>
          <p className="font-mono text-sm text-cacao/70">{vendedor.correo}</p>
        </div>
        <div className="text-right">
          <p className="font-mono text-2xl font-bold tracking-wider text-mango select-all">{vendedor.codigo}</p>
          <p className="text-sm text-cacao/70">
            {COMISION_DE_EMBAJADOR}% de cada cobro hasta el {dia(vendedor.comisionHasta)}
          </p>
        </div>
      </header>

      <Cifras
        datos={[
          { texto: "Vendido este mes", valor: pesos(meses[meses.length - 1].ventas), oro: true },
          { texto: "Ganó en total", valor: pesos(cuentas.acumulado) },
          { texto: "Se le debe", valor: pesos(cuentas.porCobrar) },
          { texto: "Ya se le pagó", valor: pesos(cuentas.cobrado) },
          { texto: "Negocios traídos", valor: String(cuentas.negocios) },
          { texto: "Siguen pagando", valor: String(cuentas.pagando) },
          { texto: "En su libreta", valor: String(prospectos.length) },
          { texto: "Cierre", valor: `${conversion}%` },
        ]}
      />

      <section className="grid gap-3">
        <h2 className="font-display text-2xl">Los negocios que trajo</h2>
        {negocios.length === 0 ? (
          <p className="caja-vacia rounded-3xl bg-crema-2 p-6 text-cacao">
            Ningún negocio ha puesto su código todavía.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-3xl border-2 border-ink/10 bg-white">
            <table className="w-full min-w-[44rem] text-sm">
              <thead>
                <tr className="text-left text-cacao/70">
                  <th className="px-4 py-3 font-bold">Negocio</th>
                  <th className="px-3 py-3 font-bold">Puso el código</th>
                  <th className="px-3 py-3 text-right font-bold">Cobros</th>
                  <th className="px-3 py-3 text-right font-bold">Pagó</th>
                  <th className="px-3 py-3 text-right font-bold">Comisión</th>
                  <th className="px-4 py-3 font-bold">Situación</th>
                </tr>
              </thead>
              <tbody>
                {negocios.map((n) => (
                  <tr key={`${n.marca}-${n.vinculadoEn}`} className="border-t border-ink/10">
                    <td className="px-4 py-3 font-bold">
                      {n.slug ? (
                        <Link href={`/marca/${n.slug}`} className="underline decoration-mango/50 underline-offset-4">
                          {n.marca}
                        </Link>
                      ) : (
                        n.marca
                      )}
                    </td>
                    <td className="px-3 py-3">{dia(n.vinculadoEn)}</td>
                    <td className="px-3 py-3 text-right">{n.cobros}</td>
                    <td className="px-3 py-3 text-right">{pesos(n.totalPagado)}</td>
                    <td className="px-3 py-3 text-right">{pesos(n.totalComision)}</td>
                    <td className="px-4 py-3">
                      {n.siguePagando ? (
                        <span className="font-bold text-selva">Sigue pagando</span>
                      ) : n.cobros === 0 ? (
                        <span className="text-cacao/70">Todavía no paga</span>
                      ) : (
                        <span className="font-bold text-guayaba">Dejó de pagar</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="grid gap-3">
        <h2 className="font-display text-2xl">Mes por mes</h2>
        <VentasPorMes meses={meses} />
      </section>

      <section className="grid gap-3">
        <h2 className="font-display text-2xl">Su libreta</h2>
        <EmbudoDeVentas embudo={embudo} vacio="Todavía no apunta ningún negocio en su libreta." />
        {prospectos.length > 0 && (
          <ul className="grid gap-2">
            {prospectos.map((p) => {
              const atrasado =
                p.siguienteEn && p.siguienteEn <= hoy && p.etapa !== "pago" && p.etapa !== "no_interesa";
              return (
                <li key={p.id} className="grid gap-1 rounded-2xl border-2 border-ink/10 bg-white px-5 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong>
                      {p.negocio}
                      {p.ciudad && <span className="font-normal text-cacao/70"> · {p.ciudad}</span>}
                    </strong>
                    <span className="rounded-full bg-mango/20 px-2.5 py-0.5 text-xs font-bold">
                      {TEXTO_DE_ETAPA[p.etapa]}
                    </span>
                  </div>
                  {(p.contacto || p.telefono) && (
                    <p className="text-sm text-cacao">{[p.contacto, p.telefono].filter(Boolean).join(" · ")}</p>
                  )}
                  {p.nota && <p className="text-sm text-cacao/80">{p.nota}</p>}
                  <p className="text-xs text-cacao/70">
                    Movido el {dia(p.actualizadoEn)}
                    {p.siguienteEn && (
                      <span className={atrasado ? "font-bold text-guayaba" : ""}>
                        {" "}
                        · seguimiento {dia(p.siguienteEn)}
                        {atrasado && " (atrasado)"}
                      </span>
                    )}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="grid gap-3">
        <h2 className="font-display text-2xl">Lo que se le ha pagado</h2>
        {pagos.length === 0 ? (
          <p className="caja-vacia rounded-3xl bg-crema-2 p-6 text-cacao">Todavía no se le ha transferido nada.</p>
        ) : (
          <ul className="grid gap-2">
            {pagos.map((p) => (
              <li
                key={p.pagadoEn}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 border-ink/10 bg-white px-5 py-3"
              >
                <span className="text-sm">
                  {dia(p.pagadoEn)}
                  {p.referencia && <span className="text-cacao/70"> · {p.referencia}</span>}
                </span>
                <span className="font-bold">{pesos(p.monto)}</span>
              </li>
            ))}
          </ul>
        )}
        {cuentas.porCobrar > 0 && (
          <Link href="/admin/embajadores?ver=pagos" className="text-sm font-bold text-mango">
            Registrar un pago →
          </Link>
        )}
      </section>
    </div>
  );
}
