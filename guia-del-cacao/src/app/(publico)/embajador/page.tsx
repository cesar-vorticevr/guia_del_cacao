import Link from "next/link";
import type { Metadata } from "next";
import { perfilActual, origenDelSitio } from "@/lib/auth/sesion";
import { cuentasDe, miEmbajada } from "@/lib/datos/embajadores";
import { COMISION_DE_EMBAJADOR, DESCUENTO_DE_EMBAJADOR, MESES_PAGADOS_AL_ANIO } from "@/lib/precios";
import { pesos } from "@/lib/tipos";
import { DatosDeCobro, SolicitudDeEmbajador, TuCodigo } from "@/components/embajador/formularios";

export const metadata: Metadata = { title: "Embajadores del Cacao · Guía del Cacao" };

/** Lo que cuesta el plan de pago, para los ejemplos de cuánto se gana. */
const PRECIO_DEL_PLAN = 499;

const FECHA = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "America/Mexico_City",
});

/**
 * Embajadores del Cacao: la invitación para quien no lo es y el tablero de
 * quien sí (migración 000059).
 *
 * El dinero se enseña como dinero. Se pensó en disfrazarlo de mazorcas y se
 * descartó: es lo que se le va a transferir, y si el tablero no dice cuánto en
 * pesos, el trato deja de ser claro justo donde más importa.
 */
export default async function Embajador() {
  const perfil = await perfilActual();
  const ganancia = (PRECIO_DEL_PLAN * (100 - DESCUENTO_DE_EMBAJADOR) * COMISION_DE_EMBAJADOR) / 10000;

  if (!perfil) {
    return (
      <div className="mx-auto max-w-3xl py-10">
        <Invitacion ganancia={ganancia} />
        <p className="caja-vacia mt-8 rounded-3xl p-6 text-center">
          <Link href="/login?volver=/embajador" className="font-bold underline">
            Inicia sesión
          </Link>{" "}
          o{" "}
          <Link href="/registro" className="font-bold underline">
            crea tu cuenta
          </Link>{" "}
          para pedir ser embajador.
        </p>
      </div>
    );
  }

  const { embajada, referidos, pagos } = await miEmbajada(perfil.id);

  if (!embajada || embajada.estado === "rechazado") {
    return (
      <div className="mx-auto max-w-3xl py-10">
        <Invitacion ganancia={ganancia} />
        <section className="mt-8 rounded-3xl border-2 border-ink/10 bg-white p-6 sm:p-8">
          {embajada?.estado === "rechazado" ? (
            <p className="text-cacao">
              Por ahora tu solicitud no fue aprobada. Si crees que fue un error,
              escríbenos y lo revisamos.
            </p>
          ) : (
            <SolicitudDeEmbajador />
          )}
        </section>
      </div>
    );
  }

  if (embajada.estado === "solicitado") {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center">
        <p className="antetitulo">Embajadores del Cacao</p>
        <h1 className="mt-3 font-display text-4xl font-medium tracking-tight sm:text-5xl">
          Tu solicitud está <em className="texto-oro">en revisión</em>
        </h1>
        <p className="mt-4 text-lg text-crema/75">
          En cuanto la aprobemos, aquí mismo aparece tu código para compartir.
        </p>
      </div>
    );
  }

  const cuentas = cuentasDe(referidos, pagos);
  const sitio = (await origenDelSitio()).replace(/^https?:\/\//, "");

  return (
    <div className="grid gap-10 py-10">
      <header className="text-center">
        <p className="antetitulo">Embajador del Cacao</p>
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

      {embajada.codigo && (
        <section className="rounded-[2rem] border border-mango/30 bg-white px-6 py-10 text-center shadow-[0_0_60px_rgb(255_183_3/0.12)]">
          <p className="antetitulo">Tu código</p>
          <div className="mt-5">
            <TuCodigo codigo={embajada.codigo} sitio={sitio} />
          </div>
          <p className="mx-auto mt-6 max-w-xl text-pretty text-crema/75">
            Quien lo ponga al contratar tiene {DESCUENTO_DE_EMBAJADOR}% de descuento en su
            primer pago, y tú ganas el {COMISION_DE_EMBAJADOR}% de lo que pague: hoy, unos{" "}
            <strong className="text-mango">{pesos(ganancia)}</strong> por cada negocio que pague
            su mes, o <strong className="text-mango">{pesos(ganancia * MESES_PAGADOS_AL_ANIO)}</strong>{" "}
            si paga el año.
          </p>
        </section>
      )}

      {/* Los números: lo del mes primero, que es lo que se viene a ver. */}
      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { texto: "Ganado este mes", valor: pesos(cuentas.delMes), oro: true },
          { texto: "Por cobrar", valor: pesos(cuentas.porCobrar), oro: true },
          { texto: "Ya cobrado", valor: pesos(cuentas.cobrado), oro: false },
          {
            texto: cuentas.negocios === 1 ? "Negocio invitado" : "Negocios invitados",
            valor: String(cuentas.negocios),
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
        dejes abajo.
      </p>

      <section>
        <h2 className="font-display text-2xl">Negocios que invitaste</h2>
        {referidos.length === 0 ? (
          <p className="caja-vacia mt-4 rounded-3xl p-6">
            Todavía ninguno. Comparte tu código con las chocolaterías, fincas y
            talleres que conozcas: en cuanto alguien lo use, aparece aquí.
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
                </span>
                {r.comision === null ? (
                  <span className="rounded-full bg-crema-2 px-3 py-1 text-sm text-cacao/80">
                    Esperando su primer pago
                  </span>
                ) : (
                  <span className="text-right">
                    <span className="block font-display text-xl font-semibold text-mango">
                      +{pesos(r.comision)}
                    </span>
                    <span className="text-xs text-cacao/70">
                      Pagó {pesos(r.montoPagado ?? 0)} · {r.cobrada ? "ya te lo pagamos" : "por cobrar"}
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

      <section className="mx-auto w-full max-w-xl rounded-3xl border-2 border-ink/10 bg-white p-6 sm:p-8">
        <h2 className="font-display text-2xl">¿A dónde te pagamos?</h2>
        <p className="mt-1 mb-5 text-cacao">
          {embajada.clabe
            ? "Esta es la cuenta a la que te transferimos."
            : "Déjanos tu CLABE para poder transferirte lo que ganes."}
        </p>
        <DatosDeCobro titular={embajada.titular} banco={embajada.banco} clabe={embajada.clabe} />
      </section>
    </div>
  );
}

/** Para quien todavía no es embajador: qué es y cuánto se gana. */
function Invitacion({ ganancia }: { ganancia: number }) {
  return (
    <header className="text-center">
      <p className="antetitulo">Embajadores del Cacao</p>
      <h1 className="mt-3 text-balance font-display text-4xl font-medium leading-tight tracking-tight sm:text-6xl">
        Invita negocios del cacao y <em className="texto-oro">gana</em> con cada uno
      </h1>
      <ol className="mx-auto mt-8 grid max-w-3xl gap-4 text-left sm:grid-cols-3">
        {[
          ["Comparte tu código", "Te damos un código propio para invitar a chocolaterías, fincas y talleres."],
          [
            `Ellos ahorran ${DESCUENTO_DE_EMBAJADOR}%`,
            "Al poner tu código, su primer pago en la Guía lleva descuento.",
          ],
          [
            `Tú ganas ${COMISION_DE_EMBAJADOR}%`,
            `De lo que paguen: unos ${pesos(ganancia)} por cada negocio, y te lo transferimos cada mes.`,
          ],
        ].map(([titulo, texto], i) => (
          <li key={titulo} className="tarjeta-magica rounded-3xl border-2 border-ink/10 bg-white p-5">
            <span className="font-display text-3xl text-mango">{i + 1}</span>
            <strong className="mt-1 block font-display text-lg">{titulo}</strong>
            <span className="mt-1 block text-sm text-cacao">{texto}</span>
          </li>
        ))}
      </ol>
    </header>
  );
}
