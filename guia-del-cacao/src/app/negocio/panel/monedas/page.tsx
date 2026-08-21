import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import QRCode from "qrcode";
import { BarraSesion } from "@/components/barra-sesion";
import { BotonesResolver } from "@/components/puntos/formularios";
import { perfilActual, origenDelSitio } from "@/lib/auth/sesion";
import { misSucursales } from "@/lib/datos/sucursales";
import { solicitudesPorResolver } from "@/lib/datos/puntos";
import { pesos } from "@/lib/tipos";

export const metadata: Metadata = { title: "Solicitudes de monedas · Guía del Cacao" };

const CUANDO = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function PanelPuntos() {
  const perfil = await perfilActual();

  if (!perfil) redirect("/login");
  if (perfil.rol !== "negocio") redirect("/cuenta");

  const sucursales = await misSucursales(perfil.id);

  // Solo las publicadas y con plan que otorgue puntos tienen QR que valga.
  const conPuntos = sucursales.filter((s) => s.estado === "publicado" && (s.tier_id ?? 0) >= 2);
  const pendientes = await solicitudesPorResolver(conPuntos.map((s) => s.id));

  const origen = await origenDelSitio();

  const codigos = await Promise.all(
    conPuntos.map(async (sucursal) => ({
      id: sucursal.id,
      nombre: sucursal.nombre_sucursal,
      destino: `${origen}/monedas/${sucursal.slug}`,
      qr: await QRCode.toString(`${origen}/monedas/${sucursal.slug}`, {
        type: "svg",
        margin: 1,
        color: { dark: "#106b46", light: "#ffffff" },
      }),
    })),
  );

  return (
    <>
      <BarraSesion nombre={perfil.nombre} />

      <main className="mx-auto grid w-[92vw] max-w-2xl gap-8 py-8">
        <div>
          <Link href="/negocio/panel" className="font-bold text-selva underline">
            ← Panel
          </Link>
          <h1 className="mt-3 font-display text-3xl">Solicitudes de monedas</h1>
        </div>

        {conPuntos.length === 0 ? (
          <p className="rounded-3xl bg-crema-2 p-6 text-cacao">
            Dar monedas de chocolate viene con el plan <strong>Tier 2</strong> o
            superior, y el micrositio tiene que estar publicado. Ninguno de los
            tuyos cumple todavía.
          </p>
        ) : (
          <>
            <section className="grid gap-4">
              <div>
                <h2 className="font-display text-2xl">Por resolver</h2>
                <p className="mt-1 text-cacao">
                  Tú decides cuántas monedas dar, de 1 a 3, según lo que
                  compraron. Máximo 3 por persona al día.
                </p>
              </div>

              {pendientes.length === 0 ? (
                <p className="rounded-3xl bg-crema-2 p-6 text-cacao">
                  Nada pendiente por ahora.
                </p>
              ) : (
                <ul className="grid gap-5">
                  {pendientes.map((solicitud) => (
                    <li key={solicitud.id} className="grid gap-4 rounded-3xl bg-crema-2 p-6">
                      <div>
                        <p className="font-mono text-xs tracking-wide text-cacao/70 uppercase">
                          {CUANDO.format(new Date(solicitud.fecha_solicitud))}
                          {solicitud.sucursales &&
                            ` · ${solicitud.sucursales.nombre_sucursal}`}
                        </p>
                        <p className="mt-1 font-display text-xl text-selva-2">
                          {solicitud.perfiles_publicos?.nombre ?? "Cliente"}
                        </p>
                      </div>

                      <ul className="grid gap-2">
                        {solicitud.solicitud_productos.map((linea, i) => (
                          <li
                            key={i}
                            className="flex items-baseline justify-between gap-4 rounded-2xl bg-white px-4 py-3"
                          >
                            <span className="text-cacao">
                              {linea.productos_servicios?.nombre}
                            </span>
                            {linea.productos_servicios?.precio !== null &&
                              linea.productos_servicios?.precio !== undefined && (
                                <span className="font-mono font-bold text-selva">
                                  {pesos(linea.productos_servicios.precio)}
                                </span>
                              )}
                          </li>
                        ))}
                      </ul>

                      <BotonesResolver
                        solicitudId={solicitud.id}
                        sucursalId={solicitud.sucursal_id}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="grid gap-4">
              <div>
                <h2 className="font-display text-2xl">Tu código QR</h2>
                <p className="mt-1 text-cacao">
                  Imprímelo y ponlo en el mostrador. Es fijo: no cambia, así que
                  lo imprimes una vez y sirve todo el año.
                </p>
              </div>

              <ul className="grid gap-5 sm:grid-cols-2">
                {codigos.map((codigo) => (
                  <li key={codigo.id} className="grid gap-3 rounded-3xl bg-white p-6 text-center">
                    <p className="font-display text-lg font-semibold text-selva-2">
                      {codigo.nombre}
                    </p>
                    <div
                      className="mx-auto w-44"
                      // El SVG lo genera la librería de QR en el servidor a
                      // partir de nuestra propia URL, no de nada que venga de
                      // fuera.
                      dangerouslySetInnerHTML={{ __html: codigo.qr }}
                    />
                    <p className="font-mono text-xs break-all text-cacao/70">
                      {codigo.destino}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </main>
    </>
  );
}
