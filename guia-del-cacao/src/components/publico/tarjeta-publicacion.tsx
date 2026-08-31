import Link from "next/link";
import { urlImagen } from "@/lib/imagenes";
import { nombrarNegocio, type Publicacion } from "@/lib/datos/publico";
import { rango } from "@/lib/vocabulario";

const FECHA = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/**
 * Un evento o una noticia en una lista.
 *
 * Toda la tarjeta es el enlace, no un "ver más" al final: en celular el dedo
 * cae sobre la tarjeta entera y obligar a apuntarle a un renglón de texto es
 * pedirle puntería a alguien que va caminando.
 *
 * La miniatura va a la derecha y en cuadro fijo. Antes ocupaba todo el ancho
 * arriba y una foto vertical de celular empujaba el título fuera de la
 * pantalla; recortada en cuadrado, todas las tarjetas miden lo mismo.
 *
 * Y el nombre grande es el de la marca: "Chocolates Grijalva" es lo que la
 * gente reconoce, "Matriz Villahermosa" es solo dónde queda.
 */
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
  const { marca, sucursal } = nombrarNegocio(publicacion.sucursales);
  const cancelado = publicacion.cancelado_en != null;

  return (
    <li>
      <Link
        href={`/${tipo === "evento" ? "eventos" : "noticias"}/${publicacion.id}`}
        className="flex h-full gap-4 rounded-3xl border-2 border-ink/10 bg-white p-5 shadow-dura transition-all hover:-translate-y-0.5 hover:shadow-dura-alta"
      >
        <span className="min-w-0 flex-1">
          <span className="block font-mono text-xs tracking-wide text-cacao/70 uppercase">
            {FECHA.format(new Date(fecha))}
          </span>

          {/*
            Un evento cancelado no se esconde: quien ya apartó la fecha tiene que
            enterarse de que se cayó. Desaparecerlo lo dejaría presentándose en
            la puerta.
          */}
          {cancelado && (
            <span className="mt-1.5 inline-block rounded-full bg-guayaba px-3 py-1 font-mono text-xs font-bold text-ink">
              Cancelado
            </span>
          )}

          <span className="mt-1.5 block font-display text-xl text-selva-2">
            {publicacion.titulo}
          </span>

          {marca && (
            <span className="mt-1 block font-bold text-selva">
              {marca}
              {sucursal && (
                <span className="font-normal text-cacao/70"> · {sucursal}</span>
              )}
            </span>
          )}

          {publicacion.subtitulo && (
            <span className="mt-1 block text-cacao/80">{publicacion.subtitulo}</span>
          )}

          <span className="mt-2 line-clamp-3 block text-cacao">
            {publicacion.contenido}
          </span>

          {publicacion.rango_exclusivo && (
            <span className="mt-3 inline-block rounded-full bg-mango px-3 py-1 font-mono text-xs font-bold text-ink">
              Solo para {rango(publicacion.rango_exclusivo).plural}
            </span>
          )}
        </span>

        {portada && (
          <span className="relative block size-24 shrink-0 overflow-hidden rounded-2xl border-2 border-selva/10 sm:size-28">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={portada}
              alt=""
              className={`size-full object-cover ${cancelado ? "grayscale" : ""}`}
            />

            {/*
              La raya va en un SVG de esquina a esquina y no con un `rotate` de
              CSS: girado, un div se sale de la caja o queda corto según la
              proporción, y la marca tiene que cruzar la foto entera siempre.
            */}
            {cancelado && (
              <svg
                aria-hidden="true"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                className="absolute inset-0 size-full"
              >
                <line x1="0" y1="100" x2="100" y2="0" stroke="#ff5d73" strokeWidth="6" />
              </svg>
            )}
          </span>
        )}
      </Link>
    </li>
  );
}
