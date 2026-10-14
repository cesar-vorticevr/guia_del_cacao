import Link from "next/link";
import type { Metadata } from "next";
import { FormularioConvenio } from "@/components/admin/formularios";
import { todosLosConvenios } from "@/lib/datos/admin";
import { listarTiers } from "@/lib/datos/sucursales";

export const metadata: Metadata = { title: "Códigos de promoción · Guía del Cacao" };

const DIA = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const CUANDO = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  timeZone: "America/Mexico_City",
});

const ESTADO_DE_USO: Record<string, string> = {
  trial: "en su periodo gratis",
  activo: "pagando",
  pausado_por_pago: "oculta por no pagar",
  cancelado: "dio de baja su plan",
};

/** Las fechas de vigencia son días, no instantes: se pintan en UTC tal cual. */
function dia(fecha: string) {
  return DIA.format(new Date(`${fecha}T00:00:00Z`));
}

function vigente(desde: string, hasta: string) {
  const hoy = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
  }).format(new Date());
  if (hoy < desde) return "Todavía no empieza";
  if (hoy > hasta) return "Ya venció";
  return "Vigente";
}

/**
 * Los códigos de convenio y quién publicó con cada uno.
 *
 * Arriba de cada código, las dos cifras que se le reportan a la Secretaría:
 * cuántos negocios lo usaron y cuántos siguen publicados.
 */
export default async function Convenios() {
  const [convenios, tiers] = await Promise.all([todosLosConvenios(), listarTiers()]);
  const nombreDe = (id: number | null) => tiers.find((t) => t.id === id)?.nombre ?? "un plan";

  return (
    <>
      <h1 className="font-display text-3xl">Códigos de promoción</h1>
      <p className="mt-2 text-cacao">
        Quien escribe un código vigente al publicar o al cambiar de plan recibe
        lo que ese código da: un plan con descuento, o gratis, hasta una fecha.
        Cada código se puede usar las veces que digas, una por sucursal.
      </p>

      {convenios.map((convenio) => {
        const publicados = convenio.suscripciones.filter(
          (uso) => uso.sucursales?.estado === "publicado",
        );
        const estado = vigente(convenio.vigente_desde, convenio.vigente_hasta);

        return (
          <section key={convenio.id} className="mt-8 rounded-3xl bg-crema-2 p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <p className="font-mono text-2xl font-bold tracking-wider text-selva-2">
                {convenio.codigo}
              </p>
              <span
                className={`rounded-full px-3 py-1 text-sm font-bold ${
                  estado === "Vigente"
                    ? "bg-lima/40 text-selva-2"
                    : "bg-white text-cacao/70"
                }`}
              >
                {estado}
              </span>
            </div>
            <p className="mt-1 text-cacao">{convenio.descripcion}</p>
            <p className="text-sm text-cacao/70">
              Sirve del {dia(convenio.vigente_desde)} al{" "}
              {dia(convenio.vigente_hasta)}
              {convenio.basico_gratis_hasta &&
                ` · Gratis hasta el ${dia(convenio.basico_gratis_hasta)}`}
              {convenio.plan_id !== null && convenio.cubre_hasta
                ? convenio.descuento >= 100
                  ? ` · ${nombreDe(convenio.plan_id)} gratis hasta el ${dia(convenio.cubre_hasta)}`
                  : ` · Un mes de ${nombreDe(convenio.plan_id)} con ${convenio.descuento}%, cubre hasta el ${dia(convenio.cubre_hasta)}`
                : convenio.descuento > 0 && ` · ${convenio.descuento}% en Básico y Pro`}
            </p>

            <dl className="mt-5 grid grid-cols-2 gap-3 text-center sm:grid-cols-3">
              {[
                ...(convenio.usos_maximos !== null
                  ? [
                      {
                        cifra: `${convenio.canjeados} / ${convenio.usos_maximos}`,
                        texto: "códigos usados",
                      },
                    ]
                  : []),
                { cifra: convenio.suscripciones.length, texto: "lo usaron" },
                { cifra: publicados.length, texto: "siguen publicados" },
              ].map((dato) => (
                <div key={dato.texto} className="rounded-2xl bg-white px-3 py-4">
                  <dt className="text-sm text-cacao/70">{dato.texto}</dt>
                  <dd className="font-mono text-3xl font-bold text-selva-2">
                    {dato.cifra}
                  </dd>
                </div>
              ))}
            </dl>

            {convenio.suscripciones.length > 0 && (
              <>
                <div className="mt-5 flex justify-end">
                  <a
                    href={`/admin/convenios/csv?codigo=${convenio.codigo}`}
                    className="min-h-11 rounded-full border-2 border-selva/25 bg-white px-5 py-2.5 font-bold text-selva-2"
                  >
                    Descargar en Excel (CSV)
                  </a>
                </div>

                <ul className="mt-4 grid gap-2">
                  {convenio.suscripciones.map((uso, i) => (
                    <li
                      key={`${uso.sucursales?.slug ?? "sin-sucursal"}-${i}`}
                      className="flex flex-wrap items-baseline justify-between gap-2 rounded-2xl bg-white px-4 py-3"
                    >
                      {uso.sucursales ? (
                        <Link
                          href={`/marca/${uso.sucursales.slug}`}
                          className="font-bold text-selva-2 underline"
                        >
                          {uso.sucursales.marcas?.nombre_comercial ??
                            uso.sucursales.nombre_sucursal}
                          <span className="font-normal text-cacao/70">
                            {" "}
                            · {uso.sucursales.nombre_sucursal}
                          </span>
                        </Link>
                      ) : (
                        <span className="text-cacao/70">Sucursal borrada</span>
                      )}
                      <span className="text-sm text-cacao/70">
                        desde el {CUANDO.format(new Date(uso.fecha_inicio))}
                        {" · "}
                        {ESTADO_DE_USO[uso.estado] ?? uso.estado}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        );
      })}

      <section className="mt-10 rounded-3xl border-2 border-dashed border-selva/25 p-6">
        <h2 className="font-display text-xl font-semibold text-selva-2">
          Crear un código
        </h2>
        <div className="mt-4">
          <FormularioConvenio
            planes={tiers.filter((t) => Number(t.precio_mensual) > 0)}
          />
        </div>
      </section>
    </>
  );
}
