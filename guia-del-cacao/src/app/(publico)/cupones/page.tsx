import Link from "next/link";
import type { Metadata } from "next";
import { AvisosDeMonedas } from "@/components/negocio/avisos-de-monedas";
import { CuponDisponible } from "@/components/publico/cupones-cliente";
import { perfilActual } from "@/lib/auth/sesion";
import { cuponesDelMercado, misCanjes } from "@/lib/datos/cupones";
import { pasaporteDe } from "@/lib/datos/puntos";
import { MONEDA } from "@/lib/vocabulario";

export const metadata: Metadata = { title: "Cupones · Guía del Cacao" };

/**
 * Los cupones, del lado de quien los canjea.
 *
 * Es donde las mazorcas dejan de ser un número: hasta ahora solo se juntaban
 * visitando negocios y se regalaban en la comunidad, sin nada que hacer con
 * ellas. Arriba van los que ya son suyos —que es lo que se viene a buscar al
 * llegar al mostrador— y debajo lo que se puede canjear hoy.
 */
export default async function Cupones() {
  const perfil = await perfilActual();
  const esCliente = perfil?.rol === "cliente";

  const [disponibles, mios, pasaporte] = await Promise.all([
    cuponesDelMercado(perfil?.id),
    esCliente ? misCanjes(perfil.id) : Promise.resolve([]),
    esCliente ? pasaporteDe(perfil.id) : Promise.resolve({ puntos: 0, nivel: 1 }),
  ]);

  const porCanjear = disponibles.filter((cupon) => !cupon.yaEsMio);

  return (
    <>
      <AvisosDeMonedas />

      <h1 className="pt-8 font-display text-3xl">Cupones</h1>
      <p className="mt-2 max-w-prose text-cacao">
        Lo que puedes llevarte con tus {MONEDA.plural}. Canjeas aquí y lo
        presentas en la sucursal.
      </p>

      {esCliente && (
        <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-crema-2 px-4 py-2 font-bold text-selva-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/marca/mazorca.png" alt="" className="size-6" />
          Tienes {pasaporte.puntos}{" "}
          {pasaporte.puntos === 1 ? MONEDA.unaCorta : MONEDA.variasCortas}
        </p>
      )}

      {mios.length > 0 && (
        <section className="pt-8">
          <h2 className="font-display text-2xl">Tus cupones</h2>
          <p className="mt-1 max-w-prose text-cacao">
            Enséñalos en el mostrador. El negocio los marca cuando te los
            entrega.
          </p>

          <ul className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {mios.map((canje) => (
              <li
                key={canje.id}
                className={`grid content-start overflow-hidden rounded-3xl border-2 ${
                  canje.usadoEn || canje.caducado
                    ? "border-ink/10 bg-crema-2 opacity-70"
                    : "border-selva/30 bg-white shadow-dura"
                }`}
              >
                {canje.imagen && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={canje.imagen}
                    alt=""
                    className={`aspect-square w-full object-cover ${
                      canje.usadoEn || canje.caducado ? "grayscale" : ""
                    }`}
                  />
                )}

                <div className="grid gap-2 p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-mono text-xs tracking-wide text-cacao/70 uppercase">
                      Hasta el {canje.vigenciaTexto}
                    </p>

                    {/*
                      Usado y caducado son cosas distintas y se dicen distinto:
                      uno ya se disfrutó, el otro se perdió.
                    */}
                    {canje.usadoEn ? (
                      <span className="rounded-full bg-lima/40 px-2 py-0.5 font-mono text-xs font-bold text-selva-2">
                        Ya lo usaste
                      </span>
                    ) : canje.caducado ? (
                      <span className="rounded-full bg-guayaba px-2 py-0.5 font-mono text-xs font-bold text-ink">
                        Caducado
                      </span>
                    ) : null}
                  </div>

                  <p className="font-display text-xl font-semibold text-selva-2">
                    {canje.nombre}
                  </p>
                  <p className="text-cacao">
                    {canje.marca}
                    {canje.sucursal && (
                      <span className="text-cacao/70"> · {canje.sucursal}</span>
                    )}
                  </p>
                  <p className="text-cacao">{canje.descripcion}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="pt-8">
        <h2 className="font-display text-2xl">Para canjear</h2>

        {!perfil && (
          <p className="mt-3 rounded-3xl bg-crema-2 p-5 text-cacao">
            <Link
              href="/login?volver=/cupones"
              className="font-bold text-selva underline"
            >
              Inicia sesión
            </Link>{" "}
            con tu cuenta de cliente para canjearlos con tus {MONEDA.plural}.
          </p>
        )}

        {porCanjear.length === 0 ? (
          <p className="mt-3 rounded-3xl bg-crema-2 p-6 text-cacao">
            {disponibles.length === 0
              ? "Todavía no hay cupones. Los negocios los publican desde su panel."
              : "Ya tienes todos los que hay ahora mismo."}
          </p>
        ) : (
          <ul className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {porCanjear.map((cupon) => (
              <CuponDisponible
                key={cupon.id}
                cupon={cupon}
                saldo={pasaporte.puntos}
                haySesion={Boolean(perfil)}
                esCliente={esCliente}
              />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
