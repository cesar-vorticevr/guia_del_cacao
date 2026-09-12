import Link from "next/link";
import { urlImagen } from "@/lib/imagenes";
import { nombrarNegocio } from "@/lib/nombres";
import type { Publicacion } from "@/lib/datos/publico";
import { MeGusta } from "@/components/publico/me-gusta";

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
 * **La foto manda**, igual que en el directorio y en el catálogo. Era una
 * miniatura en cuadro a la derecha, que resolvía el problema de que una foto
 * vertical de celular empujara el título fuera de la pantalla — pero a 96 px un
 * cartel de cata no se lee. Con la foto arriba en 4:3 y la caja fuera del
 * flujo, la proporción está garantizada y la foto se ve: nadie decide ir a un
 * taller por el nombre del taller.
 *
 * Y el nombre grande es el de la marca: "Chocolates Grijalva" es lo que la
 * gente reconoce, "Matriz Villahermosa" es solo dónde queda.
 */
export function TarjetaPublicacion({
  publicacion,
  tipo,
  /** Para el corazón: sin sesión lleva a registrarse en vez de guardar. */
  haySesion = false,
}: {
  publicacion: Publicacion;
  tipo: "evento" | "noticia";
  haySesion?: boolean;
}) {
  const portada = urlImagen(publicacion.imagenes?.[0]);
  const fecha =
    tipo === "evento" ? publicacion.fecha_evento! : publicacion.fecha_publicacion;
  const { marca, sucursal } = nombrarNegocio(publicacion.sucursales);
  const cancelado = publicacion.cancelado_en != null;

  return (
    /*
      La caja es el `li` y no el enlace, porque el corazón va dentro de la
      tarjeta pero **fuera** del enlace: un `button` dentro de un `a` es HTML
      inválido y los lectores de pantalla lo anuncian mal. Así el enlace cubre
      la foto y el texto, y la barra de abajo queda aparte sin salirse del
      marco.
    */
    <li className="group flex h-full flex-col overflow-hidden rounded-3xl border-2 border-ink/10 bg-white shadow-dura transition-all hover:-translate-y-0.5 hover:shadow-dura-alta">
      <Link
        href={`/${tipo === "evento" ? "eventos" : "noticias"}/${publicacion.id}`}
        className="flex flex-1 flex-col"
      >
        {/*
          La foto va absoluta dentro de la caja, no en el flujo: con `h-full` en
          el flujo, la altura del hueco se resuelve contra la de la imagen y al
          revés, y una foto alta estira la caja. Así las tarjetas de una fila
          dejan de alinearse, que es lo que pasaba en el directorio.
        */}
        <span className="relative block aspect-[4/3] w-full shrink-0 overflow-hidden bg-crema-2">
          {portada ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={portada}
                alt=""
                loading="lazy"
                className={`absolute inset-0 size-full object-cover ${
                  cancelado ? "grayscale" : ""
                }`}
              />

              {/*
                La raya va en un SVG de esquina a esquina y no con un `rotate`
                de CSS: girado, un div se sale de la caja o queda corto según la
                proporción, y la marca tiene que cruzar la foto entera siempre.
              */}
              {cancelado && (
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
                    strokeWidth="6"
                  />
                </svg>
              )}
            </>
          ) : (
            /*
              Sin foto, la inicial del título llena el hueco, igual que en la
              tarjeta del directorio. No la fecha: ya va debajo en su renglón, y
              repetirla dos veces en la misma tarjeta hacía ver un error donde
              solo falta una imagen.
            */
            <span
              aria-hidden="true"
              className="absolute inset-0 grid place-items-center bg-crema-2 font-display text-5xl text-selva/30"
            >
              {publicacion.titulo.charAt(0)}
            </span>
          )}

          {/*
            Un evento cancelado no se esconde: quien ya apartó la fecha tiene
            que enterarse de que se cayó. Desaparecerlo lo dejaría
            presentándose en la puerta.
          */}
          {cancelado && (
            <span className="absolute left-2 top-2 rounded-full bg-guayaba px-2.5 py-1 font-mono text-[0.65rem] font-bold text-ink">
              Cancelado
            </span>
          )}
        </span>

        <span className="flex min-w-0 flex-1 flex-col gap-1 p-4">
          <span className="block font-mono text-xs tracking-wide text-cacao/70 uppercase">
            {FECHA.format(new Date(fecha))}
          </span>

          <span className="block font-display text-base leading-tight font-semibold text-selva-2">
            {publicacion.titulo}
          </span>

          {marca && (
            <span className="block text-sm font-bold text-selva">
              {marca}
              {sucursal && (
                <span className="font-normal text-cacao/70"> · {sucursal}</span>
              )}
            </span>
          )}

          {publicacion.subtitulo && (
            <span className="block text-sm text-cacao/80">
              {publicacion.subtitulo}
            </span>
          )}

          {/*
            El cuerpo pegado al fondo con `mt-auto`: así queda a la misma altura
            en toda la fila aunque unas tarjetas lleven subtítulo y otras no.
          */}
          <span className="mt-auto line-clamp-2 block pt-1.5 text-sm text-cacao">
            {publicacion.contenido}
          </span>

        </span>
      </Link>

      {/*
        El corazón y los comentarios, en su franja al pie. Solo en eventos: una
        noticia no tiene dónde comentarse desde que la comunidad es el muro.
      */}
      {tipo === "evento" && (
        <div className="border-t-2 border-ink/5 px-4 py-2.5">
          <MeGusta
            clase="evento"
            id={publicacion.id}
            inicial={publicacion.miApoyo ?? false}
            cuantos={publicacion.apoyos ?? 0}
            comentarios={publicacion.comentarios ?? 0}
            haySesion={haySesion}
          />
        </div>
      )}
    </li>
  );
}
