import Link from "next/link";
import type { Metadata } from "next";
import { EditarCuentaDeVentas, NuevaCuentaDeVentas, RegistrarPago } from "@/components/admin/embajadores";
import { Cifras, EmbudoDeVentas, VentasPorMes } from "@/components/admin/reporte-de-ventas";
import { Pestanas } from "@/components/negocio/pestanas";
import { pagosHechos, type EmbajadorParaAdmin } from "@/lib/datos/embajadores";
import { reporteDeVentas } from "@/lib/datos/reporte-de-ventas";
import { COMISION_DE_EMBAJADOR, DESCUENTO_DE_EMBAJADOR } from "@/lib/precios";
import { pesos } from "@/lib/tipos";

export const metadata: Metadata = { title: "Ventas · Administración" };

const FECHA = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "America/Mexico_City",
});

/** «2027-04-30» → «30 abr 2027», sin que la zona horaria lo corra un día. */
function dia(fecha: string) {
  return FECHA.format(new Date(`${fecha}T12:00:00Z`));
}

/** Hace cuántos días, para «última actividad». */
function haceDias(instante: string | null) {
  if (!instante) return "Sin actividad";
  const dias = Math.floor((Date.now() - new Date(instante).getTime()) / 86_400_000);
  if (dias <= 0) return "Hoy";
  if (dias === 1) return "Ayer";
  return `Hace ${dias} días`;
}

/**
 * El equipo de ventas, para el administrador (migraciones 000059 y 000067).
 *
 * Tres pestañas: **Reporte** —cuánto se vende mes por mes, cómo va cada
 * vendedor y en qué paso está su libreta—, **Cuentas** —crear y editar— y
 * **Pagos** —a quién se le debe y lo ya transferido—. Cada vendedor abre su
 * detalle en /admin/embajadores/{id}.
 */
export default async function Ventas({
  searchParams,
}: {
  searchParams: Promise<{ ver?: string }>;
}) {
  const { ver } = await searchParams;
  const seccion = ver === "cuentas" || ver === "pagos" ? ver : "reporte";

  const [{ meses, equipo, embudo }, pagos] = await Promise.all([reporteDeVentas(), pagosHechos()]);

  const conDeuda = equipo.filter((e) => e.porPagar > 0);
  const totalPorPagar = conDeuda.reduce((suma, e) => suma + e.porPagar, 0);
  const esteMes = meses[meses.length - 1];

  return (
    <div className="grid gap-8">
      <header>
        <p className="antetitulo">Equipo de ventas</p>
        <h1 className="mt-2 font-display text-4xl font-medium tracking-tight">Ventas</h1>
        <p className="mt-2 max-w-prose text-cacao">
          Cada vendedor tiene su código. El negocio que lo pone ahorra{" "}
          {DESCUENTO_DE_EMBAJADOR}% en su primer pago, y el vendedor gana el{" "}
          <strong>{COMISION_DE_EMBAJADOR}% de todo lo que ese negocio pague</strong>, cada
          mes, mientras siga pagando y hasta su fecha de corte (por omisión el 30 de abril
          de 2027: seis meses).
        </p>
      </header>

      <Pestanas
        base="/admin/embajadores"
        actual={seccion}
        etiqueta="Secciones de ventas"
        pestanas={[
          { clave: "reporte", texto: "Reporte" },
          { clave: "cuentas", texto: "Cuentas", cuenta: equipo.length },
          {
            clave: "pagos",
            texto: "Pagos",
            cuenta: conDeuda.length || undefined,
            destella: conDeuda.length > 0,
          },
        ]}
      />

      {seccion === "reporte" && (
        <>
          <Cifras
            datos={[
              { texto: "Vendido este mes", valor: pesos(esteMes.ventas), oro: true },
              { texto: "Vendido en total", valor: pesos(equipo.reduce((s, e) => s + e.ventas, 0)) },
              { texto: "Negocios traídos", valor: String(equipo.reduce((s, e) => s + e.negocios, 0)) },
              { texto: "Por pagar", valor: pesos(totalPorPagar) },
            ]}
          />

          <section className="grid gap-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 className="font-display text-2xl">Cómo va cada vendedor</h2>
              {/* Es una descarga, no una página: con <Link> Next intentaría pintarla. */}
              <a
                href={`/admin/embajadores/csv`}
                download
                className="rounded-full border-2 border-selva/25 bg-white px-4 py-2 text-sm font-bold text-selva-2"
              >
                Descargar en Excel (CSV)
              </a>
            </div>
            {equipo.length === 0 ? (
              <p className="caja-vacia rounded-3xl bg-crema-2 p-6 text-cacao">
                Todavía no hay vendedores. Hazlos en Personas con «Hacer embajador» o crea
                una cuenta en la pestaña Cuentas.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-3xl border-2 border-ink/10 bg-white">
                <table className="w-full min-w-[56rem] text-sm">
                  <thead>
                    <tr className="text-left text-cacao/70">
                      <th className="px-4 py-3 font-bold">Vendedor</th>
                      <th className="px-3 py-3 text-right font-bold">Este mes</th>
                      <th className="px-3 py-3 text-right font-bold">Vendido</th>
                      <th className="px-3 py-3 text-right font-bold">Negocios</th>
                      <th className="px-3 py-3 text-right font-bold">Pagaron</th>
                      <th className="px-3 py-3 text-right font-bold">Libreta</th>
                      <th className="px-3 py-3 text-right font-bold">Atrasados</th>
                      <th className="px-3 py-3 text-right font-bold">Por pagar</th>
                      <th className="px-4 py-3 font-bold">Última actividad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {equipo.map((e) => (
                      <tr key={e.perfilId} className="border-t border-ink/10 align-top">
                        <td className="px-4 py-3">
                          <Link
                            href={`/admin/embajadores/${e.perfilId}`}
                            className="font-display text-lg font-semibold underline decoration-mango/50 underline-offset-4"
                          >
                            {e.nombre}
                          </Link>
                          <span className="block font-mono text-xs text-cacao/70">
                            {e.codigo}
                            {e.estado === "pausado" && " · en pausa"}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right font-bold">{pesos(e.ventasDelMes)}</td>
                        <td className="px-3 py-3 text-right">{pesos(e.ventas)}</td>
                        <td className="px-3 py-3 text-right">{e.negocios}</td>
                        <td className="px-3 py-3 text-right">{e.pagaron}</td>
                        <td className="px-3 py-3 text-right">{e.prospectos}</td>
                        <td className={`px-3 py-3 text-right ${e.atrasados ? "font-bold text-guayaba" : ""}`}>
                          {e.atrasados}
                        </td>
                        <td className={`px-3 py-3 text-right ${e.porPagar ? "font-bold text-mango" : ""}`}>
                          {pesos(e.porPagar)}
                        </td>
                        <td className="px-4 py-3 text-cacao/80">{haceDias(e.ultimaActividad)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-sm text-cacao/70">
              «Vendido» es lo que Stripe cobró a los negocios que trajo, ya con el descuento.
              «Atrasados» son prospectos cuyo seguimiento era para hoy o antes.
            </p>
          </section>

          <section className="grid gap-3">
            <h2 className="font-display text-2xl">Mes por mes</h2>
            <VentasPorMes meses={meses} />
          </section>

          <section className="grid gap-3">
            <h2 className="font-display text-2xl">Las libretas de todos</h2>
            <p className="text-cacao">En qué paso va cada negocio que visitaron.</p>
            <EmbudoDeVentas embudo={embudo} />
          </section>
        </>
      )}

      {seccion === "cuentas" && (
        <>
          <section className="rounded-3xl border-2 border-mango/40 bg-white p-6">
            <h2 className="font-display text-2xl">Nueva cuenta de ventas</h2>
            <p className="mt-1 mb-5 text-cacao">
              Entra en guiadelcacao.mx con este correo y contraseña y llega directo a su panel
              de ventas. A alguien que ya tiene cuenta lo haces vendedor desde Personas.
            </p>
            <NuevaCuentaDeVentas />
          </section>

          <section>
            <h2 className="font-display text-2xl">Todas las cuentas</h2>
            {equipo.length === 0 ? (
              <p className="caja-vacia mt-4 rounded-3xl bg-crema-2 p-6 text-cacao">
                Todavía no hay cuentas de ventas. Crea la primera arriba.
              </p>
            ) : (
              <ul className="mt-4 grid gap-3 lg:grid-cols-2">
                {equipo.map((e) => (
                  <li
                    key={e.perfilId}
                    className="tarjeta-magica grid content-start gap-3 rounded-3xl border-2 border-ink/10 bg-white p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <Persona embajador={e} />
                      {e.estado !== "activo" && (
                        <span className="rounded-full bg-mango/25 px-2.5 py-0.5 text-xs font-bold">En pausa</span>
                      )}
                    </div>
                    {e.codigo && (
                      <p className="font-mono text-xl font-bold tracking-wider text-mango select-all">{e.codigo}</p>
                    )}
                    {e.codigoDestacado && (
                      <p className="text-sm text-cacao/70">
                        Destacado:{" "}
                        <span className="font-mono font-bold tracking-wider text-crema select-all">
                          {e.codigoDestacado}
                        </span>
                      </p>
                    )}
                    <p className="text-sm text-cacao/70">Comisión hasta el {dia(e.comisionHasta)}</p>
                    <Link href={`/admin/embajadores/${e.perfilId}`} className="text-sm font-bold text-mango">
                      Ver cómo va →
                    </Link>
                    <EditarCuentaDeVentas cuenta={e} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {seccion === "pagos" && (
        <>
          <section>
            <h2 className="font-display text-2xl">Por pagar</h2>
            {conDeuda.length === 0 ? (
              <p className="caja-vacia mt-4 rounded-3xl bg-crema-2 p-6 text-cacao">
                No se le debe nada a nadie.
              </p>
            ) : (
              <ul className="mt-4 grid gap-3">
                {conDeuda.map((e) => (
                  <li key={e.perfilId} className="grid gap-4 rounded-3xl border-2 border-mango/40 bg-white p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <Persona embajador={e} />
                      <span className="font-display text-3xl font-semibold text-mango">{pesos(e.porPagar)}</span>
                    </div>
                    {e.clabe ? (
                      <p className="rounded-2xl bg-crema-2 px-4 py-3 text-sm">
                        <span className="block font-bold">
                          {e.titular}
                          {e.banco && ` · ${e.banco}`}
                        </span>
                        <span className="font-mono text-base tracking-wider select-all">{e.clabe}</span>
                      </p>
                    ) : (
                      <p className="rounded-2xl border-2 border-guayaba/40 bg-guayaba/10 px-4 py-3 text-sm font-bold">
                        Todavía no deja su CLABE. Pídesela antes de transferir.
                      </p>
                    )}
                    <RegistrarPago perfilId={e.perfilId} monto={e.porPagar} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {pagos.length > 0 && (
            <section>
              <h2 className="font-display text-2xl">Pagos hechos</h2>
              <ul className="mt-4 grid gap-2">
                {pagos.map((p) => (
                  <li
                    key={`${p.nombre}-${p.pagadoEn}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 border-ink/10 bg-white px-5 py-3"
                  >
                    <span>
                      <strong>{p.nombre}</strong>
                      <span className="text-sm text-cacao/70">
                        {" "}
                        · {FECHA.format(new Date(p.pagadoEn))}
                        {p.referencia && ` · ${p.referencia}`}
                      </span>
                    </span>
                    <span className="font-bold">{pesos(p.monto)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function Persona({ embajador }: { embajador: EmbajadorParaAdmin }) {
  return (
    <span>
      <strong className="block font-display text-xl">{embajador.nombre}</strong>
      <span className="font-mono text-xs text-cacao/70">{embajador.correo}</span>
    </span>
  );
}
