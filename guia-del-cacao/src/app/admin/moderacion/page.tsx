import Link from "next/link";
import type { Metadata } from "next";
import { eliminarPublicacion, eliminarResena } from "@/lib/admin/acciones";
import { publicacionesRecientes, resenasRecientes } from "@/lib/datos/admin";
import type { PublicacionAdmin } from "@/lib/datos/admin";

export const metadata: Metadata = { title: "Moderación · Guía del Cacao" };

const CUANDO = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function ListaPublicaciones({
  titulo,
  tipo,
  publicaciones,
}: {
  titulo: string;
  tipo: "eventos" | "noticias";
  publicaciones: PublicacionAdmin[];
}) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-2xl">{titulo}</h2>

      {publicaciones.length === 0 ? (
        <p className="mt-4 rounded-3xl bg-crema-2 p-6 text-cacao">Nada publicado aún.</p>
      ) : (
        <ul className="mt-4 grid gap-3">
          {publicaciones.map((publicacion) => (
            <li key={publicacion.id} className="rounded-2xl bg-crema-2 p-5">
              <p className="font-mono text-xs tracking-wide text-cacao/70 uppercase">
                {CUANDO.format(new Date(publicacion.fecha_publicacion))}
                {publicacion.sucursales && ` · ${publicacion.sucursales.nombre_sucursal}`}
              </p>
              <p className="mt-1 font-bold text-selva-2">{publicacion.titulo}</p>
              <p className="mt-1 line-clamp-3 text-cacao">{publicacion.contenido}</p>

              <form action={eliminarPublicacion} className="mt-3">
                <input type="hidden" name="publicacion_id" value={publicacion.id} />
                <input type="hidden" name="tipo" value={tipo} />
                <button
                  type="submit"
                  className="min-h-11 rounded-full border-2 border-guayaba/50 px-5 py-2.5 font-bold text-cacao"
                >
                  Eliminar
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function Moderacion() {
  const [resenas, { eventos, noticias }] = await Promise.all([
    resenasRecientes(),
    publicacionesRecientes(),
  ]);

  return (
    <>
      <h1 className="font-display text-3xl">Moderación</h1>
      <p className="mt-2 text-cacao">
        Eliminar es definitivo. Se borra en vez de esconderse: si algo amerita
        moderación, guardarlo &laquo;por si acaso&raquo; solo alarga el tiempo
        que sigue en la base.
      </p>

      <section className="mt-8">
        <h2 className="font-display text-2xl">Reseñas</h2>

        {resenas.length === 0 ? (
          <p className="mt-4 rounded-3xl bg-crema-2 p-6 text-cacao">
            Todavía no hay reseñas.
          </p>
        ) : (
          <ul className="mt-4 grid gap-3">
            {resenas.map((resena) => (
              <li key={resena.id} className="rounded-2xl bg-crema-2 p-5">
                <p className="font-mono text-xs tracking-wide text-cacao/70 uppercase">
                  {CUANDO.format(new Date(resena.fecha))}
                  {resena.sucursales && (
                    <>
                      {" · "}
                      <Link href={`/marca/${resena.sucursales.slug}`} className="underline">
                        {resena.sucursales.nombre_sucursal}
                      </Link>
                    </>
                  )}
                </p>

                <p className="mt-1 font-bold text-selva-2">
                  {resena.perfiles_publicos?.nombre ?? "Visitante"}
                </p>
                <p className="mt-1 text-cacao">{resena.texto}</p>

                {resena.respuesta_marca && (
                  <p className="mt-2 rounded-xl bg-white p-3 text-cacao">
                    <span className="block font-bold text-selva-2">Respuesta del negocio</span>
                    {resena.respuesta_marca}
                  </p>
                )}

                <form action={eliminarResena} className="mt-3">
                  <input type="hidden" name="resena_id" value={resena.id} />
                  <button
                    type="submit"
                    className="min-h-11 rounded-full border-2 border-guayaba/50 px-5 py-2.5 font-bold text-cacao"
                  >
                    Eliminar reseña
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ListaPublicaciones titulo="Eventos" tipo="eventos" publicaciones={eventos} />
      <ListaPublicaciones titulo="Noticias" tipo="noticias" publicaciones={noticias} />
    </>
  );
}
