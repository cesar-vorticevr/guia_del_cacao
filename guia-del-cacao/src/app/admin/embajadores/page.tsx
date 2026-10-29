import type { Metadata } from "next";
import { EditarCuentaDeVentas, NuevaCuentaDeVentas, RegistrarPago } from "@/components/admin/embajadores";
import { embajadoresParaAdmin, pagosHechos, type EmbajadorParaAdmin } from "@/lib/datos/embajadores";
import { COMISION_DE_EMBAJADOR, DESCUENTO_DE_EMBAJADOR } from "@/lib/precios";
import { pesos } from "@/lib/tipos";

export const metadata: Metadata = { title: "Cuentas de ventas · Administración" };

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

/**
 * Las cuentas de ventas, para el administrador (migraciones 000059 y 000067).
 *
 * Nadie pide ser vendedor: aquí se crea la cuenta con el correo y la
 * contraseña que se le dan, y nace con su código. Debajo, a quién se le debe
 * —que pide una transferencia—, todas las cuentas para editarlas y los pagos
 * ya hechos. La CLABE se enseña completa: es para copiarla al banco.
 */
export default async function CuentasDeVentas() {
  const [embajadores, pagos] = await Promise.all([embajadoresParaAdmin(), pagosHechos()]);

  const conDeuda = embajadores.filter((e) => e.porPagar > 0);
  const cuentas = embajadores.filter((e) => e.estado !== "rechazado");
  const totalPorPagar = conDeuda.reduce((suma, e) => suma + e.porPagar, 0);

  return (
    <div className="grid gap-10">
      <header>
        <p className="antetitulo">Equipo de ventas</p>
        <h1 className="mt-2 font-display text-4xl font-medium tracking-tight">Cuentas de ventas</h1>
        <p className="mt-2 max-w-prose text-cacao">
          Cada vendedor tiene su código: el negocio que lo pone ahorra{" "}
          {DESCUENTO_DE_EMBAJADOR}% en su primer pago y el vendedor gana{" "}
          {COMISION_DE_EMBAJADOR}% de cada cobro, ya con el descuento, hasta su
          fecha de corte. El correo y la contraseña los pones tú; él solo puede
          cambiar su nombre.
        </p>
      </header>

      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { texto: "Por pagar", valor: pesos(totalPorPagar), oro: true },
          { texto: "Vendedores", valor: String(cuentas.length), oro: false },
          {
            texto: "Negocios traídos",
            valor: String(embajadores.reduce((suma, e) => suma + e.negocios, 0)),
            oro: false,
          },
          {
            texto: "Prospectos apuntados",
            valor: String(embajadores.reduce((suma, e) => suma + e.prospectos, 0)),
            oro: false,
          },
        ].map((dato) => (
          <div key={dato.texto} className="tarjeta-magica flex flex-col-reverse rounded-3xl border-2 border-ink/10 bg-white p-5">
            <dt className="mt-1 text-sm font-bold uppercase tracking-wider text-cacao/70">{dato.texto}</dt>
            <dd className={`font-display text-3xl font-semibold ${dato.oro ? "text-mango" : ""}`}>{dato.valor}</dd>
          </div>
        ))}
      </dl>

      <section className="rounded-3xl border-2 border-mango/40 bg-white p-6">
        <h2 className="font-display text-2xl">Nueva cuenta de ventas</h2>
        <p className="mt-1 mb-5 text-cacao">
          Entra en guiadelcacao.mx con este correo y contraseña, y ve su panel en
          «Mi cuenta → Mi panel de ventas».
        </p>
        <NuevaCuentaDeVentas />
      </section>

      {conDeuda.length > 0 && (
        <section>
          <h2 className="font-display text-2xl">Por pagar este mes</h2>
          <ul className="mt-4 grid gap-3">
            {conDeuda.map((e) => (
              <li key={e.perfilId} className="grid gap-4 rounded-3xl border-2 border-mango/40 bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <Persona embajador={e} />
                  <span className="font-display text-3xl font-semibold text-mango">{pesos(e.porPagar)}</span>
                </div>
                {e.clabe ? (
                  <p className="rounded-2xl bg-crema-2 px-4 py-3 text-sm">
                    <span className="block font-bold">{e.titular}{e.banco && ` · ${e.banco}`}</span>
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
        </section>
      )}

      <section>
        <h2 className="font-display text-2xl">Todas las cuentas</h2>
        {cuentas.length === 0 ? (
          <p className="caja-vacia mt-4 rounded-3xl bg-crema-2 p-6 text-cacao">
            Todavía no hay cuentas de ventas. Crea la primera arriba.
          </p>
        ) : (
          <ul className="mt-4 grid gap-3 lg:grid-cols-2">
            {cuentas.map((e) => (
              <li key={e.perfilId} className="tarjeta-magica grid content-start gap-3 rounded-3xl border-2 border-ink/10 bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <Persona embajador={e} />
                  {e.estado !== "activo" && (
                    <span className="rounded-full bg-mango/25 px-2.5 py-0.5 text-xs font-bold">
                      {e.estado === "pausado" ? "En pausa" : "Sin activar"}
                    </span>
                  )}
                </div>
                {e.codigo && (
                  <p className="font-mono text-xl font-bold tracking-wider text-mango select-all">{e.codigo}</p>
                )}
                <p className="text-sm text-cacao">
                  {e.negocios} {e.negocios === 1 ? "negocio" : "negocios"} · {e.pagaron} ya
                  {e.pagaron === 1 ? " pagó" : " pagaron"} · generó {pesos(e.generado)} ·{" "}
                  {e.prospectos} en su libreta
                </p>
                <p className="text-sm text-cacao/70">Comisión hasta el {dia(e.comisionHasta)}</p>
                <EditarCuentaDeVentas cuenta={e} />
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
