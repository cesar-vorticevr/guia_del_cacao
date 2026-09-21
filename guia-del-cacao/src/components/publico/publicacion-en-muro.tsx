import Link from "next/link";
import { MeGusta } from "@/components/publico/me-gusta";
import { CarruselPublicacion } from "@/components/publico/carrusel-publicacion";
import { BotonCompartir } from "@/components/publico/boton-compartir";
import { BotonGuardar } from "@/components/publico/boton-guardar";
import { esVideo } from "@/lib/imagenes";
import type { Entrada } from "@/lib/datos/comunidad";

/**
 * Una publicación en el muro, a lo ancho de la columna.
 *
 * Es la hermana de `tarjeta-entrada`, que sigue sirviendo a la portada. Ahí
 * son cuatro por fila y lo que se pide de una tarjeta es que distinga: foto
 * grande arriba y el texto recortado debajo, para saltar de imagen en imagen.
 *
 * Aquí no. El muro se lee, no se ojea: una debajo de otra, en una sola columna
 * angosta. Por eso el orden se invierte —primero quién habla, luego lo que
 * dice, y la foto al final, como quien enseña algo después de contarlo— y por
 * eso la foto va en 16:9 y no en 4:3: a 620 px de ancho, un 4:3 mide casi media
 * pantalla de teléfono y empuja la siguiente publicación fuera de la vista.
 *
 * Es de servidor. El único trozo que reacciona —el corazón— ya es de cliente
 * por su cuenta.
 */
export function PublicacionEnMuro({
  entrada,
  haySesion,
  origen,
}: {
  entrada: Entrada;
  haySesion: boolean;
  /** Origen del sitio, para que el enlace a compartir sea absoluto. */
  origen: string;
}) {
  /*
    Lo que lleva la publicación, en el orden en que se subió. `rutas` guarda
    las rutas y `urlDeFoto` las traduce: las dos ya venían en la entrada para
    que el editor pudiera pintar lo que ya estaba subido.

    Si es video se decide por la extensión, igual que en el resto del sitio: el
    nombre del archivo lo pone la plataforma al subirlo, así que guardarlo
    además en una columna sería tener dos versiones de la misma verdad.
  */
  const medios = entrada.rutas
    .map((ruta) => ({ url: entrada.urlDeFoto[ruta], esVideo: esVideo(ruta) }))
    .filter((medio) => Boolean(medio.url));

  return (
    <li className="group overflow-hidden rounded-2xl border-2 border-ink/10 bg-white shadow-dura-sm transition-shadow hover:shadow-dura">
      {/*
        El renglón de quién firma va fuera del enlace y con su propio padding:
        es lo que ubica la publicación antes de leerla, igual que en cualquier
        muro, y no necesita ser parte de la zona que se pulsa.
      */}
      <div className="flex items-center gap-3 px-4 pt-4">
        {entrada.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={entrada.avatar}
            alt=""
            className="size-10 shrink-0 rounded-full border-2 border-ink/10 bg-white object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="grid size-10 shrink-0 place-items-center rounded-full border-2 border-ink/10 bg-crema-2 font-display text-lg font-semibold text-selva/60"
          >
            {entrada.autor.charAt(0).toUpperCase()}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-selva-2">
            {entrada.autor}
          </p>

          {/*
            La sucursal y el tiempo comparten renglón, separados por un punto:
            son los dos datos de contexto y juntos ocupan uno en vez de dos.
            La fecha completa va en el `title`, para quien quiera el dato exacto.
          */}
          <p className="truncate text-xs text-cacao/70">
            {entrada.detalle && <span>{entrada.detalle} · </span>}
            <span title={entrada.fechaTexto} className="font-mono">
              {entrada.hace}
            </span>
          </p>
        </div>

        {entrada.oculta && (
          <span className="shrink-0 rounded-full bg-ink/10 px-2 py-0.5 font-mono text-[0.7rem] font-bold text-cacao">
            Oculta
          </span>
        )}

        {/*
          El punto solo aparece cuando hay respuestas que esa persona no ha
          visto. Si estuviera siempre que hay comentarios, dejaría de significar
          "hay algo nuevo" y sería parte del dibujo.
        */}
        {entrada.sinVer > 0 && (
          <span
            className="grid size-5 shrink-0 place-items-center rounded-full bg-guayaba font-mono text-xs font-bold text-ink"
            aria-label={`${entrada.sinVer} sin leer`}
          >
            {entrada.sinVer}
          </span>
        )}
      </div>

      {/*
        **Primero lo que se ve y después lo que se lee.** Es el orden de
        cualquier muro, y el que corresponde a lo que se publica aquí: la foto
        es la publicación y el texto es lo que la acompaña. Al revés —título,
        párrafo y al final la imagen— era el orden de un foro, que es de donde
        venía esto.

        Y ya no hay título: una foto del secadero no se llama de ninguna manera.

        **La foto conserva su proporción**, con un tope de alto. Estuvo
        recortada a 16:9 y ahí se perdía lo importante: lo que la gente sube son
        carteles verticales —el primero que probé era de 720×1280— y el recorte
        se comía dos tercios, la fecha y el precio incluidos. En una sola
        columna las alturas distintas no descuadran nada: no hay fila con la que
        alinearse.
      */}
      {medios.length > 0 && (
        <CarruselPublicacion
          medios={medios}
          titulo={entrada.titulo}
          className="mt-3"
        />
      )}

      {/*
        El texto sí es enlace y la foto no.

        Es lo que se pidió, y de paso es lo que deja el doble toque libre para
        el corazón: si la foto llevara a otra página, tocarla dos veces te
        sacaría del muro a media intención.
      */}
      <Link href={entrada.href} className="block px-4 pt-3">
        <p className="line-clamp-3 text-sm leading-relaxed text-cacao">
          {entrada.resumen}
        </p>
      </Link>

      {/*
        Las cuatro cosas que se hacen con una publicación: corazón, comentarios,
        compartir y guardar. Van fuera del enlace —un `button` dentro de un `a`
        es HTML inválido— en su franja al pie.

        Guardar se va a la derecha, separado de los otros tres con `ml-auto`:
        los tres primeros son gestos hacia la publicación y hacia quien la
        escribió; guardar es un apartado propio que no le dice nada a nadie.
      */}
      <div className="flex items-center gap-2 border-t-2 border-ink/5 px-4 py-2.5">
        <MeGusta
          clase="publicacion"
          id={entrada.id}
          inicial={entrada.miApoyo}
          cuantos={entrada.apoyos}
          comentarios={entrada.comentarios}
          hrefComentarios={entrada.href}
          haySesion={haySesion}
        />

        <BotonCompartir
          compacto
          url={`${origen}${entrada.href}`}
          titulo={entrada.titulo}
        />

        <span className="ml-auto">
          <BotonGuardar
            publicacionId={entrada.id}
            inicial={entrada.guardada}
            haySesion={haySesion}
          />
        </span>
      </div>
    </li>
  );
}
