import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { BarraSesion } from "@/components/barra-sesion";
import { InsigniaEstado } from "@/components/insignia-estado";
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
                  <p className="font-display text-xl font-semibold text-selva-2">
                    {sucursal.nombre_sucursal}
                  </p>
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
