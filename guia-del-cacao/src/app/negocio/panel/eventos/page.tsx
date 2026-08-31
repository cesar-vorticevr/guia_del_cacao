import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { BarraSesion } from "@/components/barra-sesion";
import {
  FormularioEvento,
  PublicacionPropia,
} from "@/components/negocio/formularios";
import { perfilActual } from "@/lib/auth/sesion";
import { misPublicaciones, misSucursales } from "@/lib/datos/sucursales";
import { urlImagen } from "@/lib/imagenes";

export const metadata: Metadata = { title: "Eventos · Guía del Cacao" };

/**
 * Los eventos del negocio, aparte de las noticias.
 *
 * Antes compartían pantalla y el formulario de noticia quedaba debajo de la
 * lista de eventos: para publicar una noticia había que pasar por todo lo demás.
 * Son dos cosas distintas —una tiene fecha y caduca, la otra no— y cada una
 * merece su sitio.
 *
 * Publicar es del plan **Premier** (spec §5.3). Sin él no se enseña el
 * formulario: sería ofrecer algo que la base va a rechazar.
 */
export default async function EventosDelNegocio() {
  const perfil = await perfilActual();

  if (!perfil) redirect("/login");
  if (perfil.rol !== "negocio") redirect("/cuenta");

  const sucursales = await misSucursales(perfil.id);
  const conPremier = sucursales.filter(
    (s) => s.tier_id === 3 && s.estado === "publicado",
  );

  // Lo ya publicado se busca sobre todas sus sucursales, no solo las Premier:
  // si una bajó de plan, sus publicaciones viejas siguen existiendo y el
  // negocio tiene que poder borrarlas.
  const publicadas = await misPublicaciones(sucursales.map((s) => s.id));

  return (
    <>
      <BarraSesion nombre={perfil.nombre} />

      <main className="mx-auto grid w-[92vw] max-w-2xl gap-8 py-8">
        <div>
          <Link href="/negocio/panel" className="font-bold text-selva underline">
            ← Panel
          </Link>
          <h1 className="mt-3 font-display text-3xl">Eventos</h1>
          <p className="mt-2 text-cacao">
            Catas, talleres y ferias. Se muestran como próximos o pasados según
            su fecha, sin que tengas que marcarlo.
          </p>
        </div>

        <section className="grid gap-4">
          <h2 className="font-display text-2xl">
            Tus eventos{" "}
            <span className="font-mono text-sm font-normal text-cacao/70">
              {publicadas.eventos.length}
            </span>
          </h2>

          {publicadas.eventos.length === 0 ? (
            <p className="rounded-3xl bg-crema-2 p-6 text-cacao">
              Todavía no has publicado ninguno.
            </p>
          ) : (
            <ul className="grid gap-3">
              {publicadas.eventos.map((evento) => (
                <PublicacionPropia
                  key={evento.id}
                  publicacion={evento}
                  clase="evento"
                  foto={urlImagen(evento.imagenes[0])}
                />
              ))}
            </ul>
          )}
        </section>

        {conPremier.length === 0 ? (
          <div className="rounded-3xl bg-crema-2 p-6">
            <p className="text-cacao">
              Publicar eventos viene con el plan <strong>Premier</strong>. Tu
              cuenta no lo tiene todavía, o falta que se publique la sucursal.
            </p>
            <Link
              href="/negocio/panel/cuenta"
              className="mt-4 inline-block min-h-11 rounded-full bg-mango px-5 py-2.5 font-bold text-ink"
            >
              Ver los planes
            </Link>
          </div>
        ) : (
          <section className="grid gap-4 rounded-3xl bg-crema-2 p-6">
            <div>
              <h2 className="font-display text-2xl">Nuevo evento</h2>
              <p className="mt-1 text-cacao">Máximo uno por semana.</p>
            </div>
            <FormularioEvento sucursales={conPremier} />
          </section>
        )}
      </main>
    </>
  );
}
