import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { CanjearPremio, FormularioRuleta } from "@/components/ruleta/formularios";
import { TarjetonQr } from "@/components/negocio/tarjeton-qr";
import { origenDelSitio, perfilActual } from "@/lib/auth/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { urlImagen } from "@/lib/imagenes";
import { misSucursales } from "@/lib/datos/sucursales";
import {
  hoyEnMexico,
  premiosEntregados,
  ruletaDe,
  sucursalesConRuleta,
  tarjetonDe,
} from "@/lib/datos/ruleta";

export const metadata: Metadata = { title: "Ruleta Mágica · Guía del Cacao" };

const FECHA = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  timeZone: "America/Mexico_City",
});

/**
 * La Ruleta Mágica en el panel (migración 000060): armarla, canjear los
 * códigos que enseñan los clientes y ver lo que se ha repartido.
 *
 * Es del plan Pro. Una sucursal sin él ve qué es y cómo tenerla, no un
 * formulario que la base rechazaría al guardar.
 */
export default async function PanelRuleta({
  searchParams,
}: {
  searchParams: Promise<{ sucursal?: string }>;
}) {
  const { sucursal: elegida } = await searchParams;
  const perfil = await perfilActual();

  if (!perfil) redirect("/login");
  if (!perfil.rol_confirmado) redirect("/elegir-rol");
  if (perfil.rol !== "negocio") redirect("/cuenta");

  const sucursales = await misSucursales(perfil.id);
  const conPlan = sucursales.filter((s) => s.tiers?.permite_ruleta);
  const sucursal = conPlan.find((s) => s.id === elegida) ?? conPlan[0] ?? null;

  if (!sucursal) {
    return (
      <div className="grid max-w-2xl gap-5">
        <h1 className="font-display text-3xl">Ruleta Mágica</h1>
        <div className="rounded-3xl border-2 border-mango/50 bg-white p-6">
          <p className="antetitulo">Viene con el plan Pro</p>
          <p className="mt-3 text-cacao">
            Pon una ruleta de premios en tu micrositio: tú eliges tres premios y
            cada cuánto se puede girar, y quien gana se lleva un código para
            canjearlo en tu negocio. Los negocios con ruleta salen con su
            insignia en el directorio y en «Gira y gana» de la portada.
          </p>
          <Link
            href="/negocio/panel/cuenta"
            className="boton-oro brillo mt-5 inline-flex min-h-12 items-center rounded-full px-6 font-bold text-ink"
          >
            Pasarme a Pro
          </Link>
        </div>
      </div>
    );
  }

  const supabase = await crearClienteServidor();
  const [ruleta, entregados, conRuleta, origen, { data: marca }] = await Promise.all([
    ruletaDe(sucursal.id),
    premiosEntregados(sucursal.id),
    sucursalesConRuleta(),
    origenDelSitio(),
    supabase.from("marcas").select("nombre_comercial").eq("id", sucursal.marca_id).maybeSingle(),
  ]);
  const tarjeton =
    sucursal.estado === "publicado"
      ? await tarjetonDe(
          sucursal,
          marca?.nombre_comercial ?? sucursal.nombre_sucursal,
          origen,
          urlImagen(sucursal.logo),
          conRuleta.has(sucursal.id),
        )
      : null;
  const hoy = hoyEnMexico();
  const canjeados = entregados.filter((p) => p.canjeadoEn).length;

  return (
    <div className="grid gap-10">
      <header>
        <h1 className="font-display text-3xl">Ruleta Mágica</h1>
        <p className="mt-2 max-w-prose text-cacao">
          Tus clientes giran en tu micrositio y se llevan un código. Cuando te lo
          enseñen, escríbelo abajo para marcarlo como entregado.
        </p>
        {conPlan.length > 1 && (
          <nav aria-label="Sucursal" className="mt-4 flex flex-wrap gap-2">
            {conPlan.map((s) => (
              <Link
                key={s.id}
                href={`/negocio/panel/ruleta?sucursal=${s.id}`}
                aria-current={s.id === sucursal.id ? "page" : undefined}
                className={`rounded-full border-2 px-4 py-2 text-sm font-bold ${
                  s.id === sucursal.id ? "border-mango bg-mango text-ink" : "border-ink/10 bg-white"
                }`}
              >
                {s.nombre_sucursal}
              </Link>
            ))}
          </nav>
        )}
      </header>

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="rounded-3xl border-2 border-ink/10 bg-white p-6">
          <h2 className="font-display text-2xl">Tu ruleta</h2>
          <div className="mt-5">
            <FormularioRuleta sucursalId={sucursal.id} ruleta={ruleta} />
          </div>
          {sucursal.estado === "publicado" && (
            <Link
              href={`/marca/${sucursal.slug}`}
              className="mt-4 inline-block font-bold text-selva underline"
            >
              Verla en mi micrositio →
            </Link>
          )}
        </section>

        {tarjeton && (
          <section className="rounded-3xl border-2 border-mango/50 bg-white p-6 lg:col-span-2">
            <h2 className="font-display text-2xl">Tarjetón para tu mostrador</h2>
            <p className="mt-1 mb-4 max-w-prose text-sm text-cacao">
              Una hoja tamaño carta con un QR grande a tu micrositio. Imprímela y
              pégala en tu negocio: tus clientes la escanean, llegan a tu página
              y giran la ruleta ahí mismo.
            </p>
            <TarjetonQr datos={tarjeton} />
          </section>
        )}

        <div className="grid content-start gap-8">
          <section className="rounded-3xl border-2 border-mango/40 bg-white p-6">
            <h2 className="font-display text-2xl">Canjear un premio</h2>
            <p className="mt-1 mb-4 text-sm text-cacao">
              Escribe el código que te enseña el cliente. Se marca como
              entregado y ya no se puede usar otra vez.
            </p>
            <CanjearPremio />
          </section>

          <section>
            <h2 className="font-display text-2xl">Premios repartidos</h2>
            <p className="mt-1 text-sm text-cacao">
              {entregados.length} {entregados.length === 1 ? "giro" : "giros"} · {canjeados}{" "}
              {canjeados === 1 ? "canjeado" : "canjeados"}
            </p>
            {entregados.length === 0 ? (
              <p className="caja-vacia mt-4 rounded-3xl bg-crema-2 p-6 text-cacao">
                Todavía nadie ha girado tu ruleta.
              </p>
            ) : (
              <ul className="mt-4 grid gap-2">
                {entregados.slice(0, 30).map((p) => (
                  <li
                    key={p.codigo}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 border-ink/10 bg-white px-4 py-3"
                  >
                    <span>
                      <strong className="block">{p.premio}</strong>
                      <span className="text-sm text-cacao/70">
                        {p.cliente} · {FECHA.format(new Date(p.creadoEn))} ·{" "}
                        <span className="font-mono">{p.codigo}</span>
                      </span>
                    </span>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${
                        p.canjeadoEn
                          ? "bg-lima/25"
                          : p.venceEn < hoy
                            ? "bg-ink/10 text-cacao/70"
                            : "bg-mango/25"
                      }`}
                    >
                      {p.canjeadoEn ? "Canjeado" : p.venceEn < hoy ? "Venció" : "Por canjear"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
