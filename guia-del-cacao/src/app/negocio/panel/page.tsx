import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { InsigniaEstado } from "@/components/insignia-estado";
import { Promedio, SinCalificar } from "@/components/publico/estrellas";
import { calificacionesDe } from "@/lib/datos/publico";
import {
  sinLeerPorSucursal,
  solicitudesPorSucursal,
} from "@/lib/datos/notificaciones";
import { AvisosDeSucursal } from "@/components/negocio/avisos-de-sucursal";
import { perfilActual } from "@/lib/auth/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import {
  misSucursales,
  queLeFaltaPorPartes,
  topeDeSucursales,
} from "@/lib/datos/sucursales";
import { PrimerosPasos } from "@/components/negocio/primeros-pasos";
import { ConfirmarCorreo } from "@/components/negocio/confirmar-correo";
import { BotonEliminarSucursal } from "@/components/negocio/catalogo";
import { catalogoDeMarca } from "@/lib/datos/catalogo";
import { ESTADO } from "@/lib/tipos";

export const metadata: Metadata = {
  title: "Panel del negocio · Guía del Cacao",
};

/** Clases del botón secundario, iguales en todas las pantallas del panel. */
const SECUNDARIO =
  "min-h-11 rounded-full border-2 border-selva/25 bg-white px-5 py-2.5 text-sm font-bold text-selva-2 transition-transform active:translate-y-0.5";

/**
 * La primera pestaña del panel: **Sucursales**.
 *
 * Las demás —Catálogo, Mazorcas, Eventos, Foro— son cada una su propia ruta, y
 * la fila de pestañas que las une vive en el layout. Antes el catálogo se
 * pintaba también aquí con un `?ver=`, así que existía dos veces: esta copia se
 * quedaba atrás cada vez que se tocaba la otra.
 *
 * Todas se pintan igual —tarjeta con su nombre, sus datos y la misma fila de
 * botones— para que pasar de una a otra no obligue a reaprender dónde está cada
 * cosa.
 *
 * La sección de reseñas desapareció: ahora cada sucursal lleva su campanita, y
 * así el aviso está donde importa saber de quién es.
 */
export default async function PanelNegocio({
  searchParams,
}: {
  searchParams: Promise<{ correo?: string }>;
}) {
  const { correo } = await searchParams;
  const perfil = await perfilActual();

  if (!perfil) redirect("/login");
  if (!perfil.rol_confirmado) redirect("/elegir-rol");
  if (perfil.rol !== "negocio") redirect("/cuenta");

  // Hay que filtrar por dueño a mano. La política de lectura de `marcas` es
  // más amplia a propósito —el directorio público necesita ver las marcas con
  // micrositio publicado—, así que apoyarse en RLS para acotar una vista
  // privada le mostraría a este negocio las marcas de los demás.
  const supabase = await crearClienteServidor();
  const { data: marcas } = await supabase
    .from("marcas")
    .select("id, nombre_comercial, categorias(nombre)")
    .eq("perfil_id", perfil.id);

  if (!marcas || marcas.length === 0) redirect("/negocio/completar-marca");

  const marca = marcas[0];
  const verificado = perfil.correo_verificado_en !== null;

  const [sucursales, tope, catalogo, sinLeer, solicitudes] = await Promise.all([
    misSucursales(perfil.id),
    topeDeSucursales(marca.id),
    catalogoDeMarca(marca.id),
    sinLeerPorSucursal(),
    solicitudesPorSucursal(),
  ]);

  const lleno = sucursales.length >= tope;
  const promedios = await calificacionesDe(sucursales.map((s) => s.id));

  // Qué le falta a cada micrositio, preguntado a la misma función que usa el
  // trigger al publicar: lo que aquí se ve completo se publica sin sorpresas.
  const faltantes = new Map(
    await Promise.all(
      sucursales.map(
        async (s) => [s.id, await queLeFaltaPorPartes(s.id)] as const,
      ),
    ),
  );

  return (
    <>
      {/* El encabezado y las pestañas los pone el layout del panel: así siguen
          ahí al entrar en Eventos, Mazorcas o Foro, que viven en su propia ruta. */}
      {correo === "listo" && (
        <p
          role="status"
          className="mt-4 rounded-2xl border-2 border-lima/50 bg-lima/15 px-4 py-3 font-bold text-selva-2"
        >
          Correo confirmado. Ya puedes seguir.
        </p>
      )}

      {correo === "fallo" && (
        <p
          role="alert"
          className="mt-4 rounded-2xl border-2 border-guayaba/40 bg-guayaba/10 px-4 py-3 text-cacao"
        >
          Ese enlace ya no sirve: caduca y se usa una sola vez. Pide otro con el
          botón de abajo.
        </p>
      )}

      {sucursales.length === 0 ? (
        <PrimerosPasos
          titulo="Pongamos tu negocio en la guía"
          entrada="Son cuatro pasos y puedes dejarlo a medias: lo que armes se guarda, y solo se cobra cuando decidas publicarlo."
          pasos={[
            {
              titulo: "Confirma tu correo",
              detalle: verificado
                ? "Listo: ya sabemos que esa dirección es tuya."
                : "Es por donde te avisamos de tus reseñas y de tus cobros, así que necesitamos saber que llega. Solo se pide una vez.",
              estado: verificado ? "hecho" : "ahora",
              contenido: verificado ? undefined : (
                <ConfirmarCorreo correo={perfil.correo} />
              ),
            },
            {
              titulo: "Arma tu catálogo",
              detalle:
                catalogo.length > 0
                  ? `Tienes ${catalogo.length} ${catalogo.length === 1 ? "producto" : "productos"}. Es de tu marca: cada sucursal elige de aquí lo que maneja.`
                  : "Lo que vendes, escrito una sola vez para todas tus sucursales. Hace falta al menos un producto para abrir la primera.",
              estado: !verificado
                ? "despues"
                : catalogo.length > 0
                  ? "hecho"
                  : "ahora",
              accion: {
                href: "/negocio/panel/catalogo",
                texto:
                  catalogo.length > 0
                    ? "Ver mi catálogo"
                    : "Agregar mi primer producto",
              },
            },
            {
              titulo: "Crea tu primera sucursal",
              detalle:
                "Es el lugar físico que la gente va a visitar. Solo necesitas un nombre para empezar; el resto se llena después.",
              estado: verificado && catalogo.length > 0 ? "ahora" : "despues",
              accion: {
                href: "/negocio/panel/sucursal/nueva",
                texto: "Crear mi primera sucursal",
              },
            },
            {
              titulo: "Publícala",
              detalle:
                "Eliges plan una vez para toda tu cuenta y tus fichas entran al directorio. Hasta aquí no pagas nada.",
              estado: "despues",
              accion: {
                href: "/negocio/panel/cuenta",
                texto: "Ver los planes",
              },
            },
          ]}
        />
      ) : (
        <div className="grid gap-6">
          {/* El título va aquí y no en el layout: cada pestaña titula su
                propia pantalla, y arriba solo está de quién es el panel. */}
          <h1 className="font-display text-3xl">Sucursales</h1>

          <section className="grid gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-cacao">
                {sucursales.length} de {tope} que permite tu plan.
              </p>

              <div className="flex flex-wrap gap-3">
                {/* Con el cupo lleno el botón desaparece en vez de llevar a
                      un formulario que la base va a rechazar al guardar. */}
                {!lleno && (
                  <Link
                    href="/negocio/panel/sucursal/nueva"
                    className="min-h-11 rounded-full bg-selva px-5 py-2.5 text-sm font-bold text-crema"
                  >
                    Nueva sucursal
                  </Link>
                )}
              </div>
            </div>

            {lleno && (
              <p className="rounded-2xl border-2 border-mango/50 bg-mango/10 px-4 py-3 text-cacao">
                Llegaste al tope de tu plan
                {tope === 1 ? " (una sucursal)" : ` (${tope} sucursales)`}. Para
                abrir otra,{" "}
                <Link
                  href="/negocio/panel/cuenta"
                  className="font-bold text-selva underline"
                >
                  sube de plan
                </Link>
                .
              </p>
            )}

            <ul className="grid gap-4">
              {sucursales.map((sucursal) => {
                const nuevas = sinLeer.get(sucursal.slug) ?? 0;

                return (
                  <li key={sucursal.id} className="rounded-3xl bg-crema-2 p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-display text-xl font-semibold text-selva-2">
                          {sucursal.nombre_sucursal}
                        </p>
                        <p className="mt-0.5">
                          {promedios.get(sucursal.id) ? (
                            <Promedio
                              promedio={promedios.get(sucursal.id)!.promedio}
                              total={promedios.get(sucursal.id)!.total}
                            />
                          ) : (
                            <SinCalificar />
                          )}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        {/*
                            Los avisos viven en la sucursal, no en una lista
                            aparte: así ya dicen de quién son sin tener que
                            leerlos. Y solo aparecen cuando hay algo — un
                            icono permanente deja de mirarse.
                          */}
                        <AvisosDeSucursal
                          slug={sucursal.slug}
                          resenasNuevas={
                            sucursal.estado === "publicado" ? nuevas : 0
                          }
                          solicitudesPendientes={
                            solicitudes.get(sucursal.id)?.pendientes ?? 0
                          }
                          solicitudesNuevas={
                            solicitudes.get(sucursal.id)?.nuevas ?? 0
                          }
                        />

                        <InsigniaEstado estado={sucursal.estado} />
                      </div>
                    </div>

                    <p className="mt-2 text-cacao">
                      {ESTADO[sucursal.estado].explicacion}
                    </p>

                    {sucursal.motivo_rechazo && (
                      <p className="mt-2 rounded-2xl bg-guayaba/15 px-4 py-3 text-cacao">
                        <strong>Motivo:</strong> {sucursal.motivo_rechazo}
                      </p>
                    )}

                    {sucursal.estado !== "publicado" &&
                      (faltantes.get(sucursal.id)?.length ? (
                        <div className="mt-3 rounded-2xl border-2 border-mango/50 bg-mango/10 px-4 py-3">
                          <p className="font-bold text-selva-2">
                            Para publicarla te falta:
                          </p>
                          <ul className="mt-1.5 grid gap-1">
                            {faltantes.get(sucursal.id)!.map((pendiente) => (
                              <li
                                key={pendiente}
                                className="flex items-center gap-2 text-cacao"
                              >
                                <span
                                  aria-hidden="true"
                                  className="size-2 shrink-0 rounded-full bg-guayaba"
                                />
                                {pendiente}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <p className="mt-3 rounded-2xl bg-lima/25 px-4 py-3 font-bold text-selva-2">
                          Ya está completa: solo falta publicarla.
                        </p>
                      ))}

                    <div className="mt-4 flex flex-wrap gap-3">
                      <Link
                        href={`/negocio/panel/sucursal/${sucursal.id}`}
                        className={SECUNDARIO}
                      >
                        Editar
                      </Link>

                      {sucursal.estado === "publicado" && (
                        <Link
                          href={`/marca/${sucursal.slug}`}
                          className={SECUNDARIO}
                        >
                          Ver publicado
                        </Link>
                      )}

                      {sucursal.estado !== "publicado" &&
                        sucursal.estado !== "pendiente_aprobacion" &&
                        !faltantes.get(sucursal.id)?.length && (
                          <Link
                            href={`/negocio/panel/sucursal/${sucursal.id}/publicar`}
                            className="min-h-11 rounded-full bg-mango px-5 py-2.5 text-sm font-bold text-ink"
                          >
                            Publicar
                          </Link>
                        )}

                      <BotonEliminarSucursal
                        sucursalId={sucursal.id}
                        nombre={sucursal.nombre_sucursal}
                        publicada={sucursal.estado === "publicado"}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      )}
    </>
  );
}
