import Link from "next/link";
import { urlImagen } from "@/lib/imagenes";
import type { Publicacion } from "@/lib/datos/publico";

const FECHA = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function TarjetaPublicacion({
  publicacion,
  tipo,
}: {
  publicacion: Publicacion;
  tipo: "evento" | "noticia";
}) {
  const portada = urlImagen(publicacion.imagenes?.[0]);
  const fecha =
    tipo === "evento" ? publicacion.fecha_evento! : publicacion.fecha_publicacion;

  return (
    <li className="overflow-hidden rounded-3xl bg-white">
      {portada && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={portada} alt="" className="h-44 w-full object-cover" />
      )}

      <div className="p-5">
        <p className="font-mono text-xs tracking-wide text-cacao/70 uppercase">
          {FECHA.format(new Date(fecha))}
          {publicacion.sucursales && ` · ${publicacion.sucursales.nombre_sucursal}`}
        </p>

        <h3 className="mt-1.5 font-display text-xl">{publicacion.titulo}</h3>
        {publicacion.subtitulo && (
          <p className="mt-1 text-cacao/80">{publicacion.subtitulo}</p>
        )}

        <p className="mt-2 whitespace-pre-line text-cacao">{publicacion.contenido}</p>

        {publicacion.rango_exclusivo && (
          <p className="mt-3 inline-block rounded-full bg-mango/25 px-3 py-1 font-mono text-xs font-bold text-cacao">
            Solo para Rango {publicacion.rango_exclusivo}
          </p>
        )}

        {publicacion.sucursales && (
          <p className="mt-3">
            <Link
              href={`/marca/${publicacion.sucursales.slug}`}
              className="font-bold text-selva underline"
            >
              Ver el micrositio
            </Link>
          </p>
        )}
      </div>
    </li>
  );
}
