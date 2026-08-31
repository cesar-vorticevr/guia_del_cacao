import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { BarraSesion } from "@/components/barra-sesion";
import { FormularioEditarEvento } from "@/components/negocio/formularios";
import { cambiarEstadoEvento, eliminarPublicacion } from "@/lib/negocio/acciones";
import { perfilActual } from "@/lib/auth/sesion";
import { miEvento } from "@/lib/datos/sucursales";
import { urlImagen } from "@/lib/imagenes";

export const metadata: Metadata = { title: "Editar evento · Guía del Cacao" };

const CUANDO = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * Editar un evento: su nombre, lo que cuenta, la fecha y la foto.
 *
 * El estado no se edita aquí como un campo más, porque no es un campo: "activo"
 * y "ya pasó" salen de la fecha, y lo único que se decide es cancelarlo. Por eso
 * cancelar es un botón con su explicación, no una opción de una lista.
 */
export default async function EditarEvento({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const perfil = await perfilActual();

  if (!perfil) redirect("/login");
  if (perfil.rol !== "negocio") redirect("/cuenta");

  const evento = await miEvento(perfil.id, id);

  if (!evento) redirect("/negocio/panel/eventos");

  const foto = urlImagen(evento.imagenes[0]);

  // Los dos vienen calculados de la capa de datos: mirar el reloj durante el
  // render haría que dos pintadas del mismo componente dieran distinto.
  const { cancelado, paso } = evento;

  return (
    <>
      <BarraSesion nombre={perfil.nombre} />

      <main className="mx-auto grid w-[92vw] max-w-xl gap-6 py-8">
        <div>
          <Link
            href="/negocio/panel/eventos"
            className="font-bold text-selva underline"
          >
            ← Eventos
          </Link>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <h1 className="font-display text-3xl">{evento.titulo}</h1>
            <span
              className={`rounded-full px-3 py-1 font-mono text-xs font-bold ${
                cancelado
                  ? "bg-guayaba text-ink"
                  : paso
                    ? "bg-crema-2 text-cacao"
                    : "bg-lima/40 text-selva-2"
              }`}
            >
              {cancelado ? "Cancelado" : paso ? "Ya pasó" : "Activo"}
            </span>
          </div>

          <p className="mt-1 text-cacao">
            {CUANDO.format(new Date(evento.fechaEvento))} · {evento.sucursal}
          </p>
        </div>

        {foto && (
          <span className="relative block overflow-hidden rounded-3xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={foto}
              alt={`Foto de ${evento.titulo}`}
              className={`h-48 w-full object-cover ${cancelado ? "grayscale" : ""}`}
            />

            {cancelado && (
              <>
                <svg
                  aria-hidden="true"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  className="absolute inset-0 size-full"
                >
                  <line
                    x1="0"
                    y1="100"
                    x2="100"
                    y2="0"
                    stroke="#ff5d73"
                    strokeWidth="4"
                  />
                </svg>

                <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 bg-guayaba py-2 text-center font-display text-xl font-semibold text-ink">
                  Cancelado
                </span>
              </>
            )}
          </span>
        )}

        {cancelado && (
          <p className="rounded-2xl border-2 border-guayaba/40 bg-guayaba/10 px-4 py-3 text-cacao">
            Este evento está cancelado. Sigue a la vista, tachado y con su
            letrero, para que quien había apartado la fecha se entere.
          </p>
        )}

        <FormularioEditarEvento
          evento={{
            id: evento.id,
            titulo: evento.titulo,
            subtitulo: evento.subtitulo,
            contenido: evento.contenido,
            fechaEvento: evento.fechaEvento,
          }}
        />

        {/*
          Cancelar y eliminar van al final y en letra pequeña: son las dos
          salidas y ninguna es lo que se viene a hacer aquí. Cancelar solo
          mientras el evento no haya pasado — cancelar algo que ya ocurrió no
          avisa a nadie de nada.
        */}
        <div className="grid gap-3 border-t-2 border-ink/10 pt-6">
          {!paso && (
            <form action={cambiarEstadoEvento}>
              <input type="hidden" name="evento_id" value={evento.id} />
              <input type="hidden" name="cancelar" value={cancelado ? "no" : "si"} />
              <button
                type="submit"
                className={
                  cancelado
                    ? "min-h-12 w-full rounded-full bg-selva px-6 font-bold text-crema"
                    : "min-h-12 w-full rounded-full border-2 border-guayaba/40 bg-white px-6 font-bold text-cacao"
                }
              >
                {cancelado ? "Reactivar este evento" : "Cancelar este evento"}
              </button>
            </form>
          )}

          <details>
            <summary className="cursor-pointer list-none pt-2 text-center text-sm text-cacao/70 underline underline-offset-4 hover:text-cacao">
              Eliminar este evento
            </summary>

            <div className="mt-3 grid gap-4 rounded-3xl border-2 border-guayaba/40 bg-guayaba/10 p-5">
              <p className="text-cacao">
                Se borra del todo y desaparece de la agenda sin dejar rastro. Si
                el evento se cayó,{" "}
                <strong className="text-selva-2">es mejor cancelarlo</strong>:
                así quien apartó la fecha se entera en vez de encontrarse un
                hueco.
              </p>

              <form action={eliminarPublicacion}>
                <input type="hidden" name="publicacion_id" value={evento.id} />
                <input type="hidden" name="clase" value="evento" />
                <button
                  type="submit"
                  className="min-h-12 w-full rounded-full bg-guayaba px-6 font-bold text-ink"
                >
                  Sí, eliminarlo
                </button>
              </form>
            </div>
          </details>
        </div>
      </main>
    </>
  );
}
