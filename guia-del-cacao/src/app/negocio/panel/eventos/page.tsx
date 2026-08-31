import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { BarraSesion } from "@/components/barra-sesion";
import { FormularioEvento } from "@/components/negocio/formularios";
import { NuevoEvento, TarjetaEvento } from "@/components/negocio/eventos";
import { perfilActual } from "@/lib/auth/sesion";
import { misPublicaciones, misSucursales } from "@/lib/datos/sucursales";
import { urlImagen } from "@/lib/imagenes";

export const metadata: Metadata = { title: "Eventos · Guía del Cacao" };

const CUANDO = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * Los eventos del negocio, con la misma forma que sus sucursales: una lista de
 * tarjetas con estado y su fila de botones.
 *
 * El formulario de alta va plegado tras un botón. Antes vivía abierto al final:
 * quien entraba a mirar se topaba con un formulario en blanco que no había
 * pedido.
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
  // si una bajó de plan, sus eventos viejos siguen existiendo y el negocio
  // tiene que poder cancelarlos o borrarlos.
  const publicadas = await misPublicaciones(sucursales.map((s) => s.id));

  // Para el "ver publicado": solo tiene sentido si la sucursal está en el
  // directorio, porque si no la página del evento no la ve nadie.
  const publicadaPorNombre = new Map(
    sucursales
      .filter((s) => s.estado === "publicado")
      .map((s) => [s.nombre_sucursal, s.slug]),
  );

  return (
    <>
      <BarraSesion nombre={perfil.nombre} />

      <main className="mx-auto grid w-[92vw] max-w-2xl gap-6 py-8">
        <div>
          <Link href="/negocio/panel" className="font-bold text-selva underline">
            ← Panel
          </Link>
          <h1 className="mt-3 font-display text-3xl">Eventos</h1>
          <p className="mt-2 text-cacao">
            Catas, talleres y ferias. El estado se pone solo según la fecha; lo
            único que decides es si se cancela.
          </p>
        </div>

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
          <NuevoEvento>
            <FormularioEvento sucursales={conPremier} />
          </NuevoEvento>
        )}

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
            <ul className="grid gap-4">
              {publicadas.eventos.map((evento) => (
                <TarjetaEvento
                  key={evento.id}
                  evento={evento}
                  fechaTexto={CUANDO.format(new Date(evento.fecha))}
                  foto={urlImagen(evento.imagenes[0])}
                  slug={publicadaPorNombre.get(evento.sucursal) ?? null}
                />
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
