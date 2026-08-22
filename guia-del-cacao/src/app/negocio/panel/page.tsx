import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { BarraSesion } from "@/components/barra-sesion";
import { InsigniaEstado } from "@/components/insignia-estado";
import { Promedio, SinCalificar } from "@/components/publico/estrellas";
import { calificacionesDe } from "@/lib/datos/publico";
import { avisosSinLeer, misAvisos } from "@/lib/datos/notificaciones";
import { marcarAvisosLeidos } from "@/lib/negocio/acciones";
import { perfilActual } from "@/lib/auth/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { misSucursales } from "@/lib/datos/sucursales";
import { ESTADO } from "@/lib/tipos";

export const metadata: Metadata = { title: "Panel del negocio · Guía del Cacao" };

export default async function PanelNegocio() {
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

  const sucursales = await misSucursales(perfil.id);
  const promedios = await calificacionesDe(sucursales.map((s) => s.id));

  // Lo que paso mientras no estaba: hasta ahora, para enterarse de una resena
  // tenia que ir a ver su propio micrositio como si fuera un visitante.
  const [avisos, pendientes] = await Promise.all([misAvisos(), avisosSinLeer()]);
  const marca = marcas[0];

  return (
    <>
      <BarraSesion nombre={perfil.nombre} />

      <main className="mx-auto w-[92vw] max-w-[1180px] py-8">
        <p className="font-mono text-xs tracking-wide text-cacao/70 uppercase">
          {(marca.categorias as unknown as { nombre: string } | null)?.nombre}
        </p>
        <h1 className="mt-1 font-display text-3xl">{marca.nombre_comercial}</h1>

        <div className="mt-8 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-display text-xl">Tus micrositios</h2>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/negocio/panel/monedas"
              className="min-h-11 rounded-full border-2 border-selva/25 bg-white px-5 py-2.5 font-bold text-selva-2"
            >
              Monedas
            </Link>
            <Link
              href="/negocio/panel/contenido"
              className="min-h-11 rounded-full border-2 border-selva/25 bg-white px-5 py-2.5 font-bold text-selva-2"
            >
              Eventos y noticias
            </Link>
            <Link
              href="/negocio/panel/sucursal/nueva"
              className="min-h-11 rounded-full bg-selva px-5 py-2.5 font-bold text-crema"
            >
              Nueva sucursal
            </Link>
          </div>
        </div>

        {avisos.length > 0 && (
          <section className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-2xl">
                Novedades
                {pendientes > 0 && (
                  <span className="ml-2 rounded-full bg-guayaba px-3 py-1 align-middle font-mono text-sm font-bold text-ink">
                    {pendientes}
                  </span>
                )}
              </h2>

              {pendientes > 0 && (
                <form action={marcarAvisosLeidos}>
                  <button
                    type="submit"
                    className="min-h-11 rounded-full border-2 border-selva/25 bg-white px-4 text-sm font-bold text-selva-2"
                  >
                    Marcar todo como leído
                  </button>
                </form>
              )}
            </div>

            <ul className="grid gap-3">
              {avisos.map((aviso) => (
                <li
                  key={aviso.id}
                  className={`rounded-3xl border-2 p-5 ${
                    aviso.leida
                      ? "border-ink/10 bg-white"
                      : "border-mango/60 bg-mango/15"
                  }`}
                >
                  <p className="font-bold text-selva-2">{aviso.titulo}</p>
                  {aviso.detalle && (
                    <p className="mt-1 text-cacao">“{aviso.detalle}”</p>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Link
                      href={aviso.enlace}
                      className="min-h-11 rounded-full bg-selva px-5 py-2.5 font-bold text-crema"
                    >
                      Verla
                    </Link>

                    {!aviso.leida && (
                      <form action={marcarAvisosLeidos}>
                        <input type="hidden" name="aviso_id" value={aviso.id} />
                        <button
                          type="submit"
                          className="min-h-11 rounded-full px-4 text-sm font-bold text-cacao underline"
                        >
                          Marcar como leído
                        </button>
                      </form>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {sucursales.length === 0 ? (
          <p className="mt-6 rounded-3xl bg-crema-2 p-6 text-cacao">
            Todavía no tienes sucursales. Crea la primera: armarla no cuesta
            nada, y solo pagas cuando decidas publicarla.
          </p>
        ) : (
          <ul className="mt-5 grid gap-4">
            {sucursales.map((sucursal) => (
              <li key={sucursal.id} className="rounded-3xl bg-crema-2 p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-display text-xl font-semibold text-selva-2">
                      {sucursal.nombre_sucursal}
                    </p>
                    {/* Cómo lo están calificando es de lo primero que el
                        negocio quiere ver al entrar, no algo que deba ir a
                        buscar a su propio micrositio. */}
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
                  <InsigniaEstado estado={sucursal.estado} />
                </div>

                <p className="mt-2 text-cacao">{ESTADO[sucursal.estado].explicacion}</p>

                {sucursal.motivo_rechazo && (
                  <p className="mt-2 rounded-2xl bg-guayaba/15 px-4 py-3 text-cacao">
                    <strong>Motivo:</strong> {sucursal.motivo_rechazo}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap gap-3">
                  <Link
                    href={`/negocio/panel/sucursal/${sucursal.id}`}
                    className="min-h-11 rounded-full border-2 border-selva/25 bg-white px-5 py-2.5 font-bold text-selva-2"
                  >
                    Editar micrositio
                  </Link>

                  {sucursal.estado === "publicado" && (
                    <Link
                      href={`/marca/${sucursal.slug}`}
                      className="min-h-11 rounded-full border-2 border-selva/25 bg-white px-5 py-2.5 font-bold text-selva-2"
                    >
                      Ver publicado
                    </Link>
                  )}

                  {sucursal.estado !== "publicado" &&
                    sucursal.estado !== "pendiente_aprobacion" && (
                      <Link
                        href={`/negocio/panel/sucursal/${sucursal.id}/publicar`}
                        className="min-h-11 rounded-full bg-mango px-5 py-2.5 font-bold text-ink"
                      >
                        Publicar
                      </Link>
                    )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
