import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { BarraSesion } from "@/components/barra-sesion";
import { FormularioEvento, FormularioNoticia } from "@/components/negocio/formularios";
import { perfilActual } from "@/lib/auth/sesion";
import { misSucursales } from "@/lib/datos/sucursales";

export const metadata: Metadata = { title: "Eventos y noticias · Guía del Cacao" };

/**
 * Publicar eventos y noticias es exclusivo del Tier 3 (spec §5.3). Si el
 * negocio no tiene ninguna sucursal en ese plan, aquí se le explica por qué y
 * no se le enseña un formulario que la base va a rechazar.
 */
export default async function Contenido() {
  const perfil = await perfilActual();

  if (!perfil) redirect("/login");
  if (perfil.rol !== "negocio") redirect("/cuenta");

  const sucursales = await misSucursales(perfil.id);
  const conTier3 = sucursales.filter(
    (s) => s.tier_id === 3 && s.estado === "publicado",
  );

  return (
    <>
      <BarraSesion nombre={perfil.nombre} />

      <main className="mx-auto grid w-[92vw] max-w-2xl gap-8 py-8">
        <div>
          <Link href="/negocio/panel" className="font-bold text-selva underline">
            ← Panel
          </Link>
          <h1 className="mt-3 font-display text-3xl">Eventos y noticias</h1>
        </div>

        {conTier3.length === 0 ? (
          <div className="rounded-3xl bg-crema-2 p-6">
            <p className="text-cacao">
              Publicar eventos y noticias viene con el plan <strong>Tier 3</strong>.
              Ninguno de tus micrositios lo tiene todavía, o falta que se
              publique.
            </p>
            <Link
              href="/negocio/panel"
              className="mt-4 inline-block min-h-11 rounded-full bg-mango px-5 py-2.5 font-bold text-ink"
            >
              Ver mis micrositios
            </Link>
          </div>
        ) : (
          <>
            <section className="grid gap-4">
              <div>
                <h2 className="font-display text-2xl">Nuevo evento</h2>
                <p className="mt-1 text-cacao">
                  Máximo uno por semana. Se muestra como próximo o pasado según
                  su fecha, sin que tengas que marcarlo.
                </p>
              </div>
              <FormularioEvento sucursales={conTier3} />
            </section>

            <section className="grid gap-4 rounded-3xl bg-crema-2 p-6">
              <h2 className="font-display text-2xl">Nueva noticia</h2>
              <FormularioNoticia sucursales={conTier3} />
            </section>
          </>
        )}
      </main>
    </>
  );
}
