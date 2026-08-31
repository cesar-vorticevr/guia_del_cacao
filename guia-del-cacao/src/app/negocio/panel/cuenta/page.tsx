import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { BarraSesion } from "@/components/barra-sesion";
import {
  FormularioCambiarPlan,
  FormularioCancelarSuscripcion,
} from "@/components/negocio/formularios";
import { FormularioDatosPersonales } from "@/components/negocio/cuenta";
import { FormularioContrasenaNueva } from "@/components/formularios-auth";
import { cerrarSesion } from "@/lib/auth/acciones";
import { perfilActual } from "@/lib/auth/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { listarTiers, misSucursales, suscripcionDeMarca } from "@/lib/datos/sucursales";
import { PAGO_SIMULADO } from "@/lib/pagos";
import { pesos } from "@/lib/tipos";

export const metadata: Metadata = { title: "Mi cuenta · Guía del Cacao" };

const CUANDO = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/**
 * La cuenta del negocio: su plan, sus datos y la salida.
 *
 * El plan vive aquí y no en cada sucursal porque se paga una vez por cuenta.
 * Antes había una pantalla de suscripción por micrositio: con cuatro locales,
 * cuatro sitios donde cambiar lo mismo.
 */
export default async function CuentaNegocio() {
  const perfil = await perfilActual();

  if (!perfil) redirect("/login");
  if (perfil.rol !== "negocio") redirect("/cuenta");

  const supabase = await crearClienteServidor();
  const { data: marca } = await supabase
    .from("marcas")
    .select("id, nombre_comercial")
    .eq("perfil_id", perfil.id)
    .limit(1)
    .maybeSingle();

  if (!marca) redirect("/negocio/completar-marca");

  const [tiers, suscripcion, sucursales] = await Promise.all([
    listarTiers(),
    suscripcionDeMarca(marca.id),
    misSucursales(perfil.id),
  ]);

  const plan = tiers.find((tier) => tier.id === suscripcion?.tier_id);

  // El plan de arriba, si lo hay. Es lo unico que se anuncia: sin siguiente no
  // hay nada que ofrecer, y decirlo igual seria mentir.
  const siguiente = tiers.find((tier) => tier.id === (suscripcion?.tier_id ?? 0) + 1);
  const publicadas = sucursales.filter((s) => s.estado === "publicado").length;

  return (
    <>
      <BarraSesion nombre={perfil.nombre} />

      <main className="mx-auto grid w-[92vw] max-w-2xl gap-10 py-8">
        <div>
          <Link href="/negocio/panel" className="font-bold text-selva underline">
            ← Panel
          </Link>
          <h1 className="mt-3 font-display text-3xl">Mi cuenta</h1>
          <p className="mt-2 text-cacao">{marca.nombre_comercial}</p>
        </div>

        <section className="grid gap-4">
          <h2 className="font-display text-2xl">Tu plan</h2>

          {PAGO_SIMULADO && (
            <p className="rounded-3xl border-2 border-mango/50 bg-mango/15 p-5 text-cacao">
              <strong>Cobro simulado.</strong> Todavía no hay pasarela conectada,
              así que ni se cobra ni se devuelve dinero de verdad. El resto del
              flujo sí es el definitivo.
            </p>
          )}

          {suscripcion ? (
            <div className="rounded-3xl bg-crema-2 p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <p className="font-display text-2xl text-selva-2">{plan?.nombre}</p>
                <p className="font-mono text-lg font-bold text-selva">
                  {pesos(suscripcion.monto_mensual)}
                  <span className="text-sm font-normal text-cacao/70">/mes</span>
                </p>
              </div>

              {/*
                El próximo cobro va en letra chica: es un dato de consulta, no
                una advertencia. En el mismo cuerpo que el plan competía con él
                y hacía leer la caja como si algo estuviera por vencer.
              */}
              <p className="mt-1 text-sm text-cacao/70">
                Hasta {plan?.max_sucursales}{" "}
                {plan?.max_sucursales === 1 ? "sucursal" : "sucursales"} · Próximo
                cobro el {CUANDO.format(new Date(suscripcion.fecha_proximo_cobro))}
              </p>
            </div>
          ) : (
            <p className="rounded-3xl bg-crema-2 p-6 text-cacao">
              No tienes un plan activo, así que tus micrositios no están en el
              directorio. Elige uno aquí abajo.
            </p>
          )}
        </section>

        {/*
          El anuncio de subir solo cuando hay a dónde subir. En el plan más alto
          decía "tu plan puede crecer", que no era cierto; y enseñar siempre la
          lista de precios completa invita a comparar lo que se paga con lo que
          se podría pagar de menos — justo lo contrario de lo que se busca.

          Por eso los planes van plegados: quien quiere cambiar los abre, y quien
          entró a ver su cobro no se topa con una tabla de precios.
        */}
        {siguiente && (
          <section className="rounded-[2rem] border-2 border-ink/10 bg-mango px-6 py-8 shadow-dura">
            <p className="font-display text-2xl text-ink">
              Cámbiate a {siguiente.nombre}
            </p>
            <p className="mt-2 max-w-prose text-cacao">
              {siguiente.max_sucursales} sucursales
              {siguiente.puede_dar_puntos && !plan?.puede_dar_puntos
                ? ", monedas de chocolate para tus clientes"
                : ""}
              {siguiente.puede_publicar_contenido && !plan?.puede_publicar_contenido
                ? ", eventos y noticias"
                : ""}
              {siguiente.en_banner_principal && !plan?.en_banner_principal
                ? " y tu negocio en el banner de la portada"
                : ""}
              . Por {pesos(siguiente.precio_mensual)} al mes.
            </p>
          </section>
        )}

        <section className="grid gap-4">
          <h2 className="font-display text-xl">
            {suscripcion ? "Cambiar de plan" : "Elige tu plan"}
          </h2>

          {suscripcion ? (
            <details>
              <summary className="cursor-pointer list-none">
                <span className="inline-flex min-h-12 items-center rounded-full border-2 border-selva/25 bg-white px-6 font-bold text-selva-2">
                  Ver los planes
                </span>
              </summary>

              <div className="mt-4 grid gap-4">
                <FormularioCambiarPlan
                  tiers={tiers}
                  tierActual={suscripcion.tier_id}
                />

                {/*
                  Cancelar vive aquí dentro, en letra pequeña: es una decisión
                  sobre el plan, y su sitio es donde se deciden los planes — no
                  suelta al final de la pantalla ni junto al anuncio de subir.
                */}
                <details>
                  <summary className="cursor-pointer list-none text-sm text-cacao/70 underline underline-offset-4 hover:text-cacao">
                    Cancelar mi plan
                  </summary>

                  <div className="mt-3 grid gap-4 rounded-3xl bg-crema-2 p-5">
                    <p className="text-cacao">
                      Dejas de pagar y{" "}
                      {publicadas > 0 ? (
                        <>
                          tus{" "}
                          <strong className="text-selva-2">
                            {publicadas === 1
                              ? "sucursal sale"
                              : `${publicadas} sucursales salen`}
                          </strong>{" "}
                          del directorio
                        </>
                      ) : (
                        "tus micrositios no vuelven al directorio"
                      )}
                      , pero{" "}
                      <strong className="text-selva-2">no pierdes nada</strong> de
                      lo que armaste: todo vuelve a borrador con sus fotos, sus
                      datos y su catálogo.
                    </p>

                    <FormularioCancelarSuscripcion />
                  </div>
                </details>
              </div>
            </details>
          ) : (
            <FormularioCambiarPlan tiers={tiers} />
          )}
        </section>

        <section className="grid gap-4">
          <h2 className="font-display text-xl">Tus datos</h2>
          <FormularioDatosPersonales
            nombre={perfil.nombre}
            correo={perfil.correo}
            nombreComercial={marca.nombre_comercial}
          />
        </section>

        <section className="grid gap-4">
          <div>
            <h2 className="font-display text-xl">Cambiar mi contraseña</h2>
            <p className="mt-1 text-cacao">
              Escríbela dos veces. La anterior deja de servir en cuanto guardes.
            </p>
          </div>

          <FormularioContrasenaNueva />
        </section>

        {/*
          Cerrar sesión y cancelar el plan van al final y en letra pequeña: son
          las dos salidas, y ninguna es lo que se viene a hacer aquí.
        */}
        <div className="grid gap-3 border-t-2 border-ink/10 pt-6">
          <form action={cerrarSesion}>
            <button
              type="submit"
              className="min-h-12 w-full rounded-full border-2 border-selva/25 bg-white px-6 font-bold text-selva-2 transition-transform active:translate-y-0.5"
            >
              Cerrar sesión
            </button>
          </form>

          {suscripcion && (
            <details>
              <summary className="cursor-pointer list-none pt-2 text-center text-sm text-cacao/70 underline underline-offset-4 hover:text-cacao">
                Cancelar mi plan
              </summary>

              <div className="mt-3 grid gap-4 rounded-3xl bg-crema-2 p-5">
                <p className="text-cacao">
                  Dejas de pagar y{" "}
                  {publicadas > 0 ? (
                    <>
                      tus{" "}
                      <strong className="text-selva-2">
                        {publicadas === 1
                          ? "sucursal sale"
                          : `${publicadas} sucursales salen`}
                      </strong>{" "}
                      del directorio
                    </>
                  ) : (
                    "tus micrositios no vuelven al directorio"
                  )}
                  , pero <strong className="text-selva-2">no pierdes nada</strong>{" "}
                  de lo que armaste: todo vuelve a borrador con sus fotos, sus
                  datos y su catálogo.
                </p>

                <FormularioCancelarSuscripcion />
              </div>
            </details>
          )}
        </div>
      </main>
    </>
  );
}
