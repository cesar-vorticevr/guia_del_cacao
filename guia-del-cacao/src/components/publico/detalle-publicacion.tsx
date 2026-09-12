import Link from "next/link";
import { urlImagen } from "@/lib/imagenes";
import { nombrarNegocio, type Publicacion } from "@/lib/datos/publico";

const FECHA = new Intl.DateTimeFormat("es-MX", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const FECHA_Y_HORA = new Intl.DateTimeFormat("es-MX", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/**
 * La página de un evento o una noticia.
 *
 * Es la misma para los dos porque lo único que cambia de verdad es la fecha
 * que manda: la del evento (con hora, que es a la que hay que llegar) o la de
 * publicación de la noticia.
 *
 * Aquí la foto sí va completa y sin recortar: en la lista se recorta en
 * cuadrado para que las tarjetas midan igual, pero quien entró a ver el evento
 * quiere ver el cartel entero.
 */
export function DetallePublicacion({
  publicacion,
  tipo,
}: {
  publicacion: Publicacion;
  tipo: "evento" | "noticia";
}) {
  const esEvento = tipo === "evento";
  const portada = urlImagen(publicacion.imagenes?.[0]);
  const { marca, sucursal } = nombrarNegocio(publicacion.sucursales);

  const cuando = esEvento
    ? FECHA_Y_HORA.format(new Date(publicacion.fecha_evento!))
    : FECHA.format(new Date(publicacion.fecha_publicacion));

  return (
    <article className="mx-auto max-w-2xl py-6">
      <Link
        href={esEvento ? "/eventos" : "/noticias"}
        className="font-bold text-selva underline"
      >
        ← {esEvento ? "Todos los eventos" : "Todas las noticias"}
      </Link>

      <p className="mt-4 font-mono text-xs tracking-wide text-cacao/70 uppercase">
        {esEvento ? "Evento" : "Noticia"} · {cuando}
      </p>

      <h1 className="mt-1.5 font-display text-3xl">{publicacion.titulo}</h1>

      {publicacion.subtitulo && (
        <p className="mt-2 text-lg text-cacao/80">{publicacion.subtitulo}</p>
      )}

      {marca && (
        <p className="mt-3">
          <span className="block font-display text-xl text-selva">{marca}</span>
          {sucursal && <span className="block text-cacao">{sucursal}</span>}
        </p>
      )}

      {portada && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={portada}
          alt=""
          className="mt-5 w-full rounded-3xl border-2 border-ink/10 object-contain shadow-dura"
        />
      )}

      <p className="mt-5 whitespace-pre-line text-lg text-cacao">
        {publicacion.contenido}
      </p>

      {publicacion.sucursales && (
        <Link
          href={`/marca/${publicacion.sucursales.slug}`}
          className="mt-6 inline-flex min-h-14 items-center rounded-full bg-selva px-6 font-display text-lg font-semibold text-crema shadow-dura-sm transition-transform active:translate-y-0.5"
        >
          Ver negocio
        </Link>
      )}
    </article>
  );
}
