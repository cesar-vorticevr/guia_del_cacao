import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { perfilActual, origenDelSitio } from "@/lib/auth/sesion";
import { cuentasDe, miEmbajada, misProspectos } from "@/lib/datos/embajadores";
import { COMISION_DE_EMBAJADOR, DESCUENTO_DE_EMBAJADOR } from "@/lib/precios";
import { pesos } from "@/lib/tipos";
import { ETAPAS } from "@/lib/ventas";
import { Pestanas } from "@/components/negocio/pestanas";
import { DatosDeCobro, FilaDeProspecto, MiNombre, NuevoProspecto, TuCodigo } from "@/components/embajador/formularios";
import { KitDeVenta } from "@/components/embajador/kit";

export const metadata: Metadata = { title: "Mi panel de ventas · Guía del Cacao" };

const FECHA = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "America/Mexico_City",
});

const FECHA_LARGA = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** Hoy en el centro de México, como `aaaa-mm-dd`. */
function hoy() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(new Date());
}

/**
 * El panel de ventas (migraciones 000059 y 000067): el código, lo que lleva
 * ganado, la libreta de prospectos, el kit para vender y su cuenta.
 *
 * Solo lo ve quien tiene cuenta de ventas, que crea el administrador. A los
 * demás no se les anuncia: quien llega aquí sin serlo vuelve a su cuenta.
 *
 * El dinero se enseña como dinero. Se pensó en disfrazarlo de mazorcas y se
 * descartó: es lo que se le va a transferir, y si el tablero no dice cuánto en
 * pesos, el trato deja de ser claro justo donde más importa.
 */
export default async function Ventas({
  searchParams,
}: {
  searchParams: Promise<{ ver?: string }>;
}) {
  const { ver } = await searchParams;
  const perfil = await perfilActual();
  if (!perfil) redirect("/login?volver=/ventas");

  const [{ embajada, referidos, comisiones, pagos }, prospectos] = await Promise.all([
    miEmbajada(perfil.id),
    misProspectos(perfil.id),
  ]);

  if (!embajada || embajada.estado === "rechazado" || embajada.estado === "solicitado") {
    redirect("/cuenta");
  }

  const seccion = (["libreta", "kit", "cuenta"] as const).find((s) => s === ver) ?? "resumen";
  const cuentas = cuentasDe(referidos, comisiones, pagos);
  const origen = await origenDelSitio();
  const sitio = origen.replace(/^https?:\/\//, "");
  const vigente = hoy() <= embajada.comision_hasta;
  const hasta = FECHA_LARGA.format(new Date(`${embajada.comision_hasta}T12:00:00Z`));
  const porBuscar = prospectos.filter(
    (p) => p.siguienteEn && p.siguienteEn <= hoy() && p.etapa !== "pago" && p.etapa !== "no_interesa",
  ).length;

  return (
    <div className="grid gap-8 py-10">
      <header className="text-center">
        <p className="antetitulo">Panel de ventas</p>
        <h1 className="mt-3 font-display text-4xl font-medium tracking-tight sm:text-5xl">
          Hola, <em className="texto-oro">{perfil.nombre.split(" ")[0]}</em>
        </h1>
      </header>

      {embajada.estado === "pausado" && (
        <p className="rounded-2xl border-2 border-mango/50 bg-mango/15 p-4 text-center font-bold">
          Tu código está en pausa: por ahora no da descuento ni suma comisiones.
          Lo que ya ganaste se te paga igual.
        </p>
      )}

      <Pestanas
        base="/ventas"
        actual={seccion}
        etiqueta="Secciones del panel de ventas"
        pestanas={[
          { clave: "resumen", texto: "Resumen" },
          { clave: "libreta", texto: "Mi libreta", cuenta: porBuscar || undefined, destella: porBuscar > 0 },
          { clave: "kit", texto: "Kit de venta" },
          { clave: "cuenta", texto: "Mi cuenta" },
        ]}
      />

      {seccion === "resumen" && (
        <>
          {embajada.codigo && (
            <section className="rounded-[2rem] border border-mango/30 bg-white px-6 py-10 text-center shadow-[0_0_60px_rgb(255_183_3/0.12)]">
              <p className="antetitulo">Tu código</p>
              <div className="mt-5">
                <TuCodigo codigo={embajada.codigo} sitio={sitio} />
              </div>
              <p className="mx-auto mt-6 max-w-xl text-pretty text-crema/75">
                El negocio que lo pone ahorra {DESCUENTO_DE_EMBAJADOR}% en su primer
                pago, y tú ganas el {COMISION_DE_EMBAJADOR}% de <em>cada</em> pago
                que haga hasta el{" "}
                <strong className="text-mango">{hasta}</strong>, mes con mes.
              </p>
              {!vigente && (
                <p className="mx-auto mt-3 max-w-xl font-bold text-guayaba">
                  Tu periodo de comisiones ya terminó. Lo que ganaste antes se te paga igual.
                </p>
              )}
            </section>
          )}

          {/* Los números: lo del mes primero, que es lo que se viene a ver. */}
          <dl className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            {[
              { texto: "Ganado este mes", valor: pesos(cuentas.delMes), oro: true },
              { texto: "Por cobrar", valor: pesos(cuentas.porCobrar), oro: true },
              { texto: "Acumulado", valor: pesos(cuentas.acumulado), oro: false },
              { texto: "Ya te pagamos", valor: pesos(cuentas.cobrado), oro: false },
              {
                texto: cuentas.negocios === 1 ? "Negocio con tu código" : "Negocios con tu código",
                valor: String(cuentas.negocios),
                oro: false,
              },
              {
                texto: cuentas.pagando === 1 ? "Sigue pagando" : "Siguen pagando",
                valor: String(cuentas.pagando),
                oro: false,
              },
            ].map((dato) => (
              <div
                key={dato.texto}
                className="tarjeta-magica flex flex-col-reverse rounded-3xl border-2 border-ink/10 bg-white p-5"
              >
                <dt className="mt-1 text-sm font-bold uppercase tracking-wider text-crema/65">{dato.texto}</dt>
                <dd
                  className={`font-display text-3xl font-semibold sm:text-4xl ${dato.oro ? "text-mango drop-shadow-[0_0_12px_rgba(255,183,3,0.5)]" : ""}`}
                >
                  {dato.valor}
                </dd>
              </div>
            ))}
          </dl>

          <p className="-mt-4 text-center text-sm text-crema/60">
            Lo que tienes por cobrar se te transfiere a fin de mes a la cuenta que
            dejes en «Mi cuenta».
          </p>

          <section>
            <h2 className="font-display text-2xl">Negocios con tu código</h2>
            {referidos.length === 0 ? (
              <p className="caja-vacia mt-4 rounded-3xl p-6">
                Todavía ninguno. En cuanto un negocio ponga tu código al
                publicar, aparece aquí. El «Kit de venta» tiene todo para el
                primero.
              </p>
            ) : (
              <ul className="mt-4 grid gap-3">
                {referidos.map((r) => (
                  <li
                    key={`${r.marca}-${r.vinculadoEn}`}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-ink/10 bg-white px-5 py-4"
                  >
                    <span>
                      <span className="block font-bold">{r.marca}</span>
                      <span className="text-sm text-cacao/70">
                        Usó tu código el {FECHA.format(new Date(r.vinculadoEn))}
                      </span>
                      {r.cobros > 0 && (
                        <span
                          className={`mt-1.5 block w-fit rounded-full px-2.5 py-0.5 text-xs font-bold ${
                            r.siguePagando ? "bg-lima/25" : "bg-ink/10 text-cacao/70"
                          }`}
                        >
                          {r.siguePagando ? "Sigue pagando" : "Ya no está pagando"}
                        </span>
                      )}
                    </span>
                    {r.cobros === 0 ? (
                      <span className="rounded-full bg-crema-2 px-3 py-1 text-sm text-cacao/80">
                        Esperando su primer pago
                      </span>
                    ) : (
                      <span className="text-right">
                        <span className="block font-display text-xl font-semibold text-mango">
                          +{pesos(r.totalComision)}
                        </span>
                        <span className="block text-xs text-cacao/70">
                          {r.cobros} {r.cobros === 1 ? "pago" : "pagos"} · pagó {pesos(r.totalPagado)}
                          {r.ultimoCobro ? ` · último el ${FECHA.format(new Date(r.ultimoCobro))}` : ""}
                        </span>
                        <span className="block text-xs text-cacao/70">
                          {r.porCobrar > 0 ? `${pesos(r.porCobrar)} por cobrar` : "Todo ya te lo pagamos"}
                        </span>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {pagos.length > 0 && (
            <section>
              <h2 className="font-display text-2xl">Lo que te hemos pagado</h2>
              <ul className="mt-4 grid gap-2">
                {pagos.map((p) => (
                  <li
                    key={p.pagadoEn}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 border-ink/10 bg-white px-5 py-3"
                  >
                    <span className="text-sm text-cacao/80">
                      {FECHA.format(new Date(p.pagadoEn))}
                      {p.referencia && ` · ${p.referencia}`}
                    </span>
                    <span className="font-bold">{pesos(p.monto)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {seccion === "libreta" && (
        <section className="grid gap-5">
          <div>
            <h2 className="font-display text-2xl">Mi libreta</h2>
            <p className="mt-1 text-crema/75">
              Apunta cada negocio que visites o le escribas, y en qué paso va.
              Los que tienen fecha para volver a buscarlos y ya les toca se
              marcan en rojo.
            </p>
          </div>

          <dl className="flex flex-wrap gap-2">
            {ETAPAS.map((e) => (
              <div key={e.valor} className="rounded-full border border-ink/15 bg-white px-4 py-1.5 text-sm">
                <dt className="inline">{e.texto}: </dt>
                <dd className="inline font-bold">{prospectos.filter((p) => p.etapa === e.valor).length}</dd>
              </div>
            ))}
          </dl>

          <NuevoProspecto abierto={prospectos.length === 0} />

          {prospectos.length > 0 && (
            <ul className="grid gap-3 lg:grid-cols-2">
              {prospectos.map((p) => (
                <FilaDeProspecto key={p.id} prospecto={p} hoy={hoy()} />
              ))}
            </ul>
          )}
        </section>
      )}

      {seccion === "kit" && embajada.codigo && (
        <section className="grid gap-5">
          <div>
            <h2 className="font-display text-2xl">Kit de venta</h2>
            <p className="mt-1 text-crema/75">
              Todo lo que necesitas frente a un negocio. Los mensajes ya llevan
              tu código.
            </p>
          </div>
          <KitDeVenta codigo={embajada.codigo} sitio={sitio} demo={`${origen}/marca/chocolateria-demo`} />
        </section>
      )}

      {seccion === "cuenta" && (
        <section className="mx-auto grid w-full max-w-xl gap-6">
          <div className="rounded-3xl border-2 border-ink/10 bg-white p-6 sm:p-8">
            <h2 className="font-display text-2xl">Tus datos</h2>
            <p className="mt-1 mb-5 text-cacao">
              Entras con <strong>{perfil.correo}</strong>. El correo y la
              contraseña te los asigna el administrador: si necesitas
              cambiarlos, pídeselo.
            </p>
            <MiNombre nombre={perfil.nombre} />
          </div>

          <div className="rounded-3xl border-2 border-ink/10 bg-white p-6 sm:p-8">
            <h2 className="font-display text-2xl">¿A dónde te pagamos?</h2>
            <p className="mt-1 mb-5 text-cacao">
              {embajada.clabe
                ? "Esta es la cuenta a la que te transferimos."
                : "Déjanos tu CLABE para poder transferirte lo que ganes."}
            </p>
            <DatosDeCobro titular={embajada.titular} banco={embajada.banco} clabe={embajada.clabe} />
          </div>
        </section>
      )}
    </div>
  );
}
