import Link from "next/link";
import { urlImagen } from "@/lib/imagenes";
import { pesos } from "@/lib/tipos";

/**
 * Quién publicó, cuando es un negocio: su logo, su marca y su sucursal, y todo
 * eso lleva a su tienda (el micrositio). Va arriba de una publicación o de un
 * evento, que es donde alguien que llegó por un enlace compartido se pregunta
 * «¿y esto de quién es?».
 */
export function FirmaDeNegocio({
  slug,
  marca,
  sucursal,
  logo,
}: {
  slug: string;
  marca: string;
  sucursal: string | null;
  /** Ruta del logo en el bucket, o null. */
  logo: string | null;
}) {
  const foto = urlImagen(logo);

  return (
    <Link
      href={`/marca/${slug}`}
      className="tarjeta-magica group flex items-center gap-3 rounded-2xl border-2 border-mango/30 bg-white p-3 transition-colors hover:border-mango"
    >
      {foto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={foto} alt="" className="size-12 shrink-0 rounded-xl border-2 border-ink/10 bg-white object-cover" />
      ) : (
        <span
          aria-hidden="true"
          className="grid size-12 shrink-0 place-items-center rounded-xl bg-crema-2 font-display text-xl text-selva-2"
        >
          {marca.charAt(0)}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-display text-lg font-semibold text-selva-2">{marca}</span>
        {sucursal && <span className="block truncate text-sm text-cacao/70">{sucursal}</span>}
      </span>
      <span className="shrink-0 rounded-full bg-mango px-3 py-1.5 text-sm font-bold text-ink transition-transform group-hover:scale-105">
        Ver tienda →
      </span>
    </Link>
  );
}

/**
 * El producto que el negocio etiquetó en su publicación (migración 000075):
 * foto, nombre y precio, y un enlace a su tienda, donde está el catálogo y se
 * puede pedir.
 */
export function ProductoEtiquetado({
  slug,
  producto,
}: {
  slug: string;
  producto: {
    nombre: string;
    descripcion: string | null;
    precio: number | null;
    imagen: string | null;
  };
}) {
  const foto = urlImagen(producto.imagen);

  return (
    <Link
      href={`/marca/${slug}#catalogo`}
      className="tarjeta-magica group flex items-center gap-4 overflow-hidden rounded-2xl border-2 border-ink/10 bg-white p-3 transition-colors hover:border-mango"
    >
      {foto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={foto} alt="" className="size-20 shrink-0 rounded-xl object-cover" />
      ) : (
        <span
          aria-hidden="true"
          className="grid size-20 shrink-0 place-items-center rounded-xl bg-crema-2 font-display text-3xl text-selva/50"
        >
          {producto.nombre.charAt(0)}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="font-mono text-[0.7rem] font-bold tracking-wider text-mango uppercase">
          🏷 Producto en esta publicación
        </span>
        <span className="block truncate font-bold text-selva-2">{producto.nombre}</span>
        {producto.descripcion && (
          <span className="line-clamp-1 text-sm text-cacao/80">{producto.descripcion}</span>
        )}
        <span className="mt-1 flex flex-wrap items-center gap-x-3 text-sm">
          {producto.precio !== null && (
            <span className="font-mono font-bold text-selva">{pesos(Number(producto.precio))}</span>
          )}
          <span className="font-bold text-mango">Verlo en su tienda →</span>
        </span>
      </span>
    </Link>
  );
}
