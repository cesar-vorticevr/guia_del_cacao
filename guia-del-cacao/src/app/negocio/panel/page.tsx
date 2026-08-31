import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { BarraSesion } from "@/components/barra-sesion";
import { InsigniaEstado } from "@/components/insignia-estado";
import { Promedio, SinCalificar } from "@/components/publico/estrellas";
import { calificacionesDe } from "@/lib/datos/publico";
import { sinLeerPorSucursal, solicitudesPorSucursal } from "@/lib/datos/notificaciones";
import { AvisosDeSucursal } from "@/components/negocio/avisos-de-sucursal";
import { perfilActual } from "@/lib/auth/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { misSucursales, queLeFaltaPorPartes, topeDeSucursales } from "@/lib/datos/sucursales";
import { PrimerosPasos } from "@/components/negocio/primeros-pasos";
import { ConfirmarCorreo } from "@/components/negocio/confirmar-correo";
import {
  BotonEliminarProducto,
  BotonEliminarSucursal,
} from "@/components/negocio/catalogo";
import { Pestanas } from "@/components/negocio/pestanas";
import { catalogoDeMarca, usoEnSucursales } from "@/lib/datos/catalogo";
import { urlImagen } from "@/lib/imagenes";
import { ESTADO, pesos } from "@/lib/tipos";

export const metadata: Metadata = { title: "Panel del negocio · Guía del Cacao" };

/** Clases del botón secundario, iguales en sucursales y catálogo. */
const SECUNDARIO =
  "min-h-11 rounded-full border-2 border-selva/25 bg-white px-5 py-2.5 text-sm font-bold text-selva-2 transition-transform active:translate-y-0.5";

/**
 * El panel del negocio, en dos secciones que se cambian con una fila de
 * pestañas: **Sucursales** y **Catálogo**.
 *
 * Antes iban una debajo de otra y llegar al catálogo era bajar tres pantallas.
 * Las dos se pintan igual —tarjeta con su nombre, sus datos y la misma fila de
 * botones— para que pasar de una a otra no obligue a reaprender dónde está cada
 * cosa.
 *
 * La sección de reseñas desapareció: ahora cada sucursal lleva su campanita, y
 * así el aviso está donde importa saber de quién es.
 */
export default async function PanelNegocio({
  searchParams,
}: {
  searchParams: Promise<{ correo?: string; ver?: string }>;
}) {
  const { correo, ver } = await searchParams;
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

  const [sucursales, tope, catalogo, sinLeer, uso, solicitudes] = await Promise.all([
    misSucursales(perfil.id),
    topeDeSucursales(marca.id),
    catalogoDeMarca(marca.id),
    sinLeerPorSucursal(),
    usoEnSucursales(marca.id),
    solicitudesPorSucursal(),
  ]);

  const lleno = sucursales.length >= tope;
  const promedios = await calificacionesDe(sucursales.map((s) => s.id));

  // Qué le falta a cada micrositio, preguntado a la misma función que usa el
  // trigger al publicar: lo que aquí se ve completo se publica sin sorpresas.
  const faltantes = new Map(
    await Promise.all(
      sucursales.map(async (s) => [s.id, await queLeFaltaPorPartes(s.id)] as const),
    ),
  );

  const seccion = ver === "catalogo" ? "catalogo" : "sucursales";

  // Los avisos de moneda de todas las sucursales, sumados para la pestaña.
  const monedasPendientes = [...solicitudes.values()].reduce(
    (total, s) => total + s.pendientes,
    0,
  );
  const monedasNuevas = [...solicitudes.values()].reduce(
    (total, s) => total + s.nuevas,
    0,
  );

  return (
    <>
      <BarraSesion nombre={perfil.nombre} />

      <main className="mx-auto w-[92vw] max-w-[1180px] py-8">
        <p className="font-mono text-xs tracking-wide text-cacao/70 uppercase">
          {(marca.categorias as unknown as { nombre: string } | null)?.nombre}
        </p>
        <h1 className="mt-1 font-display text-3xl">{marca.nombre_comercial}</h1>

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
            Ese enlace ya no sirve: caduca y se usa una sola vez. Pide otro con
            el botón de abajo.
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
                    catalogo.length > 0 ? "Ver mi catálogo" : "Agregar mi primer producto",
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
                accion: { href: "/negocio/panel/cuenta", texto: "Ver los planes" },
              },
            ]}
          />
        ) : (
          <div className="mt-8 grid gap-6">
            <Pestanas
              base="/negocio/panel"
              actual={seccion}
              pestanas={[
                { clave: "sucursales", texto: "Sucursales", cuenta: sucursales.length },
                { clave: "catalogo", texto: "Catálogo", cuenta: catalogo.length },
                {
                  clave: "monedas",
                  texto: "Monedas",
                  href: "/negocio/panel/monedas",
                  cuenta: monedasPendientes || undefined,
                  destella: monedasNuevas > 0,
                },
                { clave: "eventos", texto: "Eventos", href: "/negocio/panel/eventos" },
                { clave: "foro", texto: "Foro", href: "/negocio/panel/foro" },
              ]}
            />

            {seccion === "sucursales" ? (
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
                            <Link href={`/marca/${sucursal.slug}`} className={SECUNDARIO}>
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
            ) : (
              <section className="grid gap-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="max-w-prose text-cacao">
                    Es de tu marca, no de cada sucursal: lo escribes una vez y lo
                    que corrijas se actualiza en todas.
                  </p>

                  <Link
                    href="/negocio/panel/catalogo"
                    className="min-h-11 rounded-full bg-selva px-5 py-2.5 text-sm font-bold text-crema"
                  >
                    Agregar producto
                  </Link>
                </div>

                {catalogo.length === 0 ? (
                  <p className="rounded-3xl bg-crema-2 p-6 text-cacao">
                    Todavía no tienes productos.{" "}
                    <Link
                      href="/negocio/panel/catalogo"
                      className="font-bold text-selva underline"
                    >
                      Agrega el primero
                    </Link>
                    .
                  </p>
                ) : (
                  /*
                    La misma tarjeta que las sucursales: fondo crema-2, nombre
                    arriba, datos debajo y la fila de botones al pie. Cambiar de
                    pestaña no debería obligar a reaprender dónde está cada cosa.
                  */
                  <ul className="grid gap-4">
                    {catalogo.map((producto) => {
                      const foto = urlImagen(producto.imagen);
                      const enSucursales = uso.get(producto.id) ?? 0;

                      return (
                        <li key={producto.id} className="rounded-3xl bg-crema-2 p-6">
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="flex min-w-0 gap-4">
                              {foto ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={foto}
                                  alt=""
                                  className="size-14 shrink-0 rounded-2xl border-2 border-selva/10 object-cover"
                                />
                              ) : (
                                <span
                                  aria-hidden="true"
                                  className="grid size-14 shrink-0 place-items-center rounded-2xl bg-white font-display text-xl text-selva-2"
                                >
                                  {producto.nombre.charAt(0)}
                                </span>
                              )}

                              <div className="min-w-0">
                                <p className="font-display text-xl font-semibold text-selva-2">
                                  {producto.nombre}
                                </p>
                                {producto.sku && (
                                  <p className="font-mono text-xs text-cacao/70">
                                    SKU {producto.sku}
                                  </p>
                                )}
                              </div>
                            </div>

                            {producto.precio !== null && (
                              <p className="font-mono text-lg font-bold text-selva">
                                {pesos(producto.precio)}
                              </p>
                            )}
                          </div>

                          {producto.descripcion && (
                            <p className="mt-2 text-cacao">{producto.descripcion}</p>
                          )}

                          <p className="mt-2 font-mono text-xs text-cacao/70">
                            {enSucursales === 0
                              ? "En ninguna sucursal todavía"
                              : `En ${enSucursales} ${enSucursales === 1 ? "sucursal" : "sucursales"}`}
                          </p>

                          <div className="mt-4 flex flex-wrap gap-3">
                            <Link
                              href={`/negocio/panel/catalogo/${producto.id}`}
                              className={SECUNDARIO}
                            >
                              Editar
                            </Link>

                            <BotonEliminarProducto
                              producto={producto}
                              enSucursales={enSucursales}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            )}
          </div>
        )}
      </main>
    </>
  );
}
