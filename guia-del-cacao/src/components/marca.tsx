import Image from "next/image";
import Link from "next/link";

/**
 * La mazorca de la marca. Era un óvalo de CSS mientras no hubo ilustración;
 * ahora es el mismo dibujo del favicon, que se diseñó para leerse en chico.
 *
 * Va la mazorca sola y no el logotipo completo: ese es un escudo casi cuadrado
 * con el nombre, un mapa y granos adentro, y a la altura de un encabezado —
 * unos 28 px— sus letras quedarían en tres píxeles. El nombre lo pone el texto
 * de al lado, en Fredoka, que a ese tamaño sí se lee.
 *
 * Se guarda a 96 px porque se ve a 28 y hay pantallas de 3×.
 */
export function Mazorca({ className = "size-7" }: { className?: string }) {
  return (
    <Image
      src="/marca/mazorca.png"
      alt=""
      width={96}
      height={96}
      priority
      className={className}
    />
  );
}

export function Logotipo({ href = "/" }: { href?: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 font-display text-xl font-bold text-crema"
    >
      <Mazorca />
      Guía del Cacao
    </Link>
  );
}
