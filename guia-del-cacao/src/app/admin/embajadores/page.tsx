import type { Metadata } from "next";
import { RegistrarPago } from "@/components/admin/embajadores";
import { decidirEmbajador } from "@/lib/admin/embajadores";
import { embajadoresParaAdmin, pagosHechos, type EmbajadorParaAdmin } from "@/lib/datos/embajadores";
import { pesos } from "@/lib/tipos";

export const metadata: Metadata = { title: "Embajadores · Administración" };

const FECHA = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "America/Mexico_City",
});

/**
 * Los Embajadores del Cacao, para el administrador (migración 000059).
 *
 * Arriba lo que pide una decisión —las solicitudes— y lo que pide una
 * transferencia —a quién se le debe—. Debajo, todos los embajadores y los
 * pagos ya hechos. La CLABE se enseña completa: es para copiarla al banco.
 */
export default async function Embajadores() {
  const [embajadores, pagos] = await Promise.all([embajadoresParaAdmin(), pagosHechos()]);

  const solicitudes = embajadores.filter((e) => e.estado === "solicitado");
  const conDeuda = embajadores.filter((e) => e.porPagar > 0);
  const vigentes = embajadores.filter((e) => e.estado === "activo" || e.estado === "pausado");
  const totalPorPagar = conDeuda.reduce((suma, e) => suma + e.porPagar, 0);

  return (
    <div className="grid gap-10">
      <header>
        <p className="antetitulo">Programa de referidos</p>
        <h1 className="mt-2 font-display text-4xl font-medium tracking-tight">Embajadores</h1>
        <p className="mt-2 max-w-prose text-cacao">
          Cada embajador comparte su código: el negocio ahorra 20% en su primer
          pago y el embajador gana 25% de cada cobro que Stripe confirme
          mientras ese negocio siga pagando. Aquí apruebas a quien lo
          pide y registras lo que les transfieres cada mes.
        </p>
      </header>

      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { texto: "Por pagar", valor: pesos(totalPorPagar), oro: true },
          { texto: "Solicitudes", valor: String(solicitudes.length), oro: solicitudes.length > 0 },
          { texto: "Embajadores", valor: String(vigentes.length), oro: false },
          {
            texto: "Negocios traídos",
            valor: String(embajadores.reduce((suma, e) => suma + e.negocios, 0)),
            oro: false,
          },
        ].map((dato) => (
          <div key={dato.texto} className="tarjeta-magica flex flex-col-reverse rounded-3xl border-2 border-ink/10 bg-white p-5">
            <dt className="mt-1 text-sm font-bold uppercase tracking-wider text-cacao/70">{dato.texto}</dt>
            <dd className={`font-display text-3xl font-semibold ${dato.oro ? "text-mango" : ""}`}>{dato.valor}</dd>
          </div>
        ))}
      </dl>

      {solicitudes.length > 0 && (
        <section>
          <h2 className="font-display text-2xl">Quieren ser embajadores</h2>
          <ul className="mt-4 grid gap-3">
            {solicitudes.map((e) => (
              <li key={e.perfilId} className="grid gap-3 rounded-3xl border-2 border-ink/10 bg-white p-5">
                <Persona embajador={e} />
                {e.motivo && <p className="text-cacao">«{e.motivo}»</p>}
                <Decision perfilId={e.perfilId} opciones={[["activo", "Aprobar"], ["rechazado", "Rechazar"]]} />
              </li>
            ))}
          </ul>
        </section>
      )}

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
        <h2 className="font-display text-2xl">Todos los embajadores</h2>
        {vigentes.length === 0 ? (
          <p className="caja-vacia mt-4 rounded-3xl bg-crema-2 p-6 text-cacao">
            Todavía no hay embajadores aprobados.
          </p>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {vigentes.map((e) => (
              <li key={e.perfilId} className="tarjeta-magica grid gap-3 rounded-3xl border-2 border-ink/10 bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <Persona embajador={e} />
                  {e.estado === "pausado" && (
                    <span className="rounded-full bg-mango/25 px-2.5 py-0.5 text-xs font-bold">En pausa</span>
                  )}
                </div>
                <p className="font-mono text-xl font-bold tracking-wider text-mango select-all">{e.codigo}</p>
                <p className="text-sm text-cacao">
                  {e.negocios} {e.negocios === 1 ? "negocio" : "negocios"} · {e.pagaron} ya
                  {e.pagaron === 1 ? " pagó" : " pagaron"} · generó {pesos(e.generado)}
                </p>
                <Decision
                  perfilId={e.perfilId}
                  opciones={e.estado === "activo" ? [["pausado", "Pausar código"]] : [["activo", "Reactivar código"]]}
                />
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

/** Botones de decisión: cada uno es su propio formulario con la acción. */
function Decision({ perfilId, opciones }: { perfilId: string; opciones: [string, string][] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {opciones.map(([estado, texto]) => (
        <form key={estado} action={decidirEmbajador}>
          <input type="hidden" name="perfil_id" value={perfilId} />
          <input type="hidden" name="estado" value={estado} />
          <button
            type="submit"
            className={
              estado === "activo"
                ? "boton-oro brillo min-h-10 rounded-full px-5 text-sm font-bold text-ink"
                : "min-h-10 rounded-full border-2 border-ink/15 px-5 text-sm font-bold transition-colors hover:border-guayaba hover:text-guayaba"
            }
          >
            {texto}
          </button>
        </form>
      ))}
    </div>
  );
}
