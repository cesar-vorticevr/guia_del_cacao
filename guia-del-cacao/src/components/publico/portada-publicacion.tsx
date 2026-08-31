/**
 * La portada de una publicación, siempre.
 *
 * Desde la migración 000030 toda publicación nueva lleva foto, pero las doce que
 * venían del foro y de las noticias viejas no tienen ninguna. En vez de dejarlas
 * desnudas —una tarjeta con un hueco gris se lee como algo roto— se les pinta
 * una portada: un fondo de la paleta elegido por su propio id y la mazorca de la
 * marca encima.
 *
 * El color sale del id y no al azar: así una publicación se ve siempre igual, y
 * dos seguidas en el muro no salen del mismo color.
 */
const FONDOS = [
  "bg-crema-2",
  "bg-lima/30",
  "bg-mango/25",
  "bg-turquesa/25",
  "bg-guayaba/20",
];

function colorDe(id: string) {
  let suma = 0;
  for (const letra of id) suma += letra.charCodeAt(0);
  return FONDOS[suma % FONDOS.length];
}

export function PortadaPublicacion({
  id,
  foto,
  titulo,
  className = "",
}: {
  id: string;
  foto: string | null;
  titulo: string;
  className?: string;
}) {
  if (foto) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={foto}
        alt=""
        className={`object-cover ${className}`}
        loading="lazy"
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`grid place-items-center ${colorDe(id)} ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/marca/mazorca.png"
        alt=""
        className="size-1/3 max-w-24 opacity-70"
      />
      <span className="sr-only">{titulo}</span>
    </span>
  );
}
