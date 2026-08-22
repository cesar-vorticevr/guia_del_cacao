import { esVideo } from "@/lib/imagenes";

/**
 * Lo que acompaña a una reseña o a un comprobante: una foto o un video.
 *
 * El video va con los controles del navegador (`controls`) en vez de unos
 * propios. No es pereza: los del sistema ya traen play, pausa, volumen y barra
 * de avance, funcionan con teclado y con lector de pantalla, y en celular
 * abren el reproductor a pantalla completa que la persona ya sabe usar. Unos
 * botones dibujados a mano se verían más nuestros y servirían peor.
 *
 * Sin `autoPlay`, con `preload="metadata"`: nadie quiere que un micrositio
 * empiece a sonar solo, ni que se le vayan veinte megas de datos por bajar
 * videos que no pidió.
 */
export function Medio({
  ruta,
  alt,
  className = "mt-3 max-h-72 w-full rounded-2xl object-cover",
}: {
  /** URL ya armada por el servidor, o null si no hay nada que mostrar. */
  ruta: string | null;
  alt: string;
  className?: string;
}) {
  if (!ruta) return null;

  if (esVideo(ruta)) {
    return (
      <video
        src={ruta}
        controls
        preload="metadata"
        aria-label={alt}
        className={className}
      >
        {/* Para un navegador tan viejo que no reproduzca video, el enlace es
            mejor que un hueco en blanco. */}
        <a href={ruta}>Ver el video</a>
      </video>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={ruta} alt={alt} className={className} />
  );
}
