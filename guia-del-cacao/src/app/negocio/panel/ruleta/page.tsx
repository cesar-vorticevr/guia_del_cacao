import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { CanjearPremio, FormularioRuleta } from "@/components/ruleta/formularios";
import { RuletaMagica } from "@/components/ruleta/ruleta-magica";
import { TarjetonQr } from "@/components/negocio/tarjeton-qr";
import { PoweredByVortice } from "@/components/experiencias/powered-by-vortice";
import { origenDelSitio, perfilActual } from "@/lib/auth/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { urlImagen } from "@/lib/imagenes";
import { misSucursales } from "@/lib/datos/sucursales";
import {
  gajosDe,
  hoyEnMexico,
  premiosEntregados,
  ruletaDe,
  sucursalesConRuleta,
  tarjetonDe,
  TEXTO_DE_FRECUENCIA,
} from "@/lib/datos/ruleta";

export const metadata: Metadata = { title: "Ruleta Mágica · Guía del Cacao" };

const FECHA = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  timeZone: "America/Mexico_City",
});

/**
 * La Ruleta Mágica en el panel (migración 000060): armarla, probarla, canjear
 * los códigos que enseñan los clientes y ver lo que se ha repartido.
 *
 * Desde la 000066 cualquiera la arma, la guarda y la prueba aquí; que se vea y
 * se gire en el micrositio es del plan Pro. Una sucursal sin él tiene todo
 * para editar y el aviso de qué le falta para publicarla.
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
  const sucursal = sucursales.find((s) => s.id === elegida) ?? sucursales[0] ?? null;

  if (!sucursal) redirect("/negocio/panel");
  const tienePro = Boolean(sucursal.tiers?.permite_ruleta);

  const supabase = await crearClienteServidor();
  const [ruleta, entregados, conRuleta, origen, gajos, { data: marca }] = await Promise.all([
    ruletaDe(sucursal.id),
    premiosEntregados(sucursal.id),
    sucursalesConRuleta(),
    origenDelSitio(),
    gajosDe(sucursal.id),
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
        <p className="antetitulo">Powered by Vórtice VR</p>
        <h1 className="mt-2 font-display text-3xl">Ruleta Mágica</h1>
        <p className="mt-2 max-w-prose text-cacao">
          Tus clientes giran en tu micrositio y se llevan un código. Cuando te lo
          enseñen, escríbelo abajo para marcarlo como entregado. Quien ya tiene su
          premio sigue girando una ruleta de cacao, que no da nada más.
        </p>
        {sucursales.length > 1 && (
          <nav aria-label="Sucursal" className="mt-4 flex flex-wrap gap-2">
            {sucursales.map((s) => (
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

      {!tienePro && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border-2 border-mango/50 bg-crema-2 p-6">
          <div className="max-w-prose">
            <p className="antetitulo">Arma gratis, publica con Pro</p>
            <p className="mt-2 text-cacao">
              Tu ruleta se guarda y la puedes probar aquí abajo. Para que salga en tu micrositio, en
              «Gira y gana» de la portada y con su insignia en el directorio, pásate a{" "}
              <strong>Pro ($499/mes)</strong>.
            </p>
          </div>
          <Link
            href="/negocio/panel/cuenta"
            className="boton-oro brillo inline-flex min-h-12 items-center rounded-full px-6 font-bold text-ink"
          >
            Pasarme a Pro
          </Link>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="rounded-3xl border-2 border-ink/10 bg-white p-6">
          <h2 className="font-display text-2xl">Tu ruleta</h2>
          <div className="mt-5">
            <FormularioRuleta sucursalId={sucursal.id} ruleta={ruleta} />
          </div>
          {sucursal.estado === "publicado" && tienePro && (
            <Link
              href={`/marca/${sucursal.slug}`}
              className="mt-4 inline-block font-bold text-selva underline"
            >
              Verla en mi micrositio →
            </Link>
          )}
        </section>

        <section
          className="rounded-3xl border-2 border-mango/50 p-6 text-crema shadow-[0_0_40px_rgb(255_183_3/0.2)]"
          style={{ background: "linear-gradient(180deg, #1c1236 0%, #0f2a22 70%, #08150f 100%)" }}
        >
          <p className="antetitulo">Vista previa</p>
          <h2 className="mt-2 font-display text-2xl text-crema">Así la ven tus clientes</h2>
          {ruleta && gajos.length === 6 ? (
            <div className="mt-6">
              <RuletaMagica
                modo="vista-previa"
                sucursalId={sucursal.id}
                gajos={gajos}
                reglas={`${TEXTO_DE_FRECUENCIA[ruleta.frecuencia]} · el premio vale ${ruleta.vigenciaDias} ${ruleta.vigenciaDias === 1 ? "día" : "días"}`}
                puedeGirar
                motivo={null}
                volver="/negocio/panel/ruleta"
                frecuenciaDiaria={false}
                enlacePremios="/negocio/panel/cuenta?ver=premios"
              />
              <p className="mt-4 text-center text-xs text-crema/60">
                Gírala cuantas veces quieras: en la vista previa no se guarda ningún premio.
              </p>
            </div>
          ) : (
            <p className="mt-4 text-crema/75">Guarda tus premios y aquí verás tu ruleta girar.</p>
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

        <div className="grid content-start gap-8 lg:col-span-2 lg:grid-cols-2">
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

      <PoweredByVortice />
    </div>
  );
}
