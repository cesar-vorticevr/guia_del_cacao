import Link from "next/link";
import { urlImagen } from "@/lib/imagenes";
import type { TarjetaDirectorio } from "@/lib/datos/publico";

/** Tarjeta del directorio. El Tier 3 se distingue, porque parte de lo que paga es salir arriba. */
export function TarjetaSucursal({ sucursal }: { sucursal: TarjetaDirectorio }) {
  const logo = urlImagen(sucursal.logo);
  const destacada = sucursal.tier_id === 3;

  return (
    <li>
      <Link
        href={`/marca/${sucursal.slug}`}
        className={`flex h-full gap-4 rounded-3xl border-2 bg-white p-5 transition-colors hover:border-selva ${
          destacada ? "border-mango/60" : "border-transparent"
        }`}
      >
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logo}
            alt=""
            className="size-16 shrink-0 rounded-2xl border-2 border-selva/10 object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="grid size-16 shrink-0 place-items-center rounded-2xl bg-crema-2 font-display text-2xl text-selva/50"
          >
            {sucursal.nombre_sucursal.charAt(0)}
          </span>
        )}

        <span className="min-w-0">
          <span className="block font-display text-lg font-semibold text-selva-2">
            {sucursal.marcas?.nombre_comercial}
          </span>
          <span className="block text-sm text-cacao/80">{sucursal.nombre_sucursal}</span>

          {sucursal.acerca_de && (
            <span className="mt-1.5 line-clamp-2 block text-cacao">{sucursal.acerca_de}</span>
          )}

          {destacada && (
            <span className="mt-2 inline-block rounded-full bg-mango/25 px-3 py-1 font-mono text-xs font-bold text-cacao">
              Destacado
            </span>
          )}
        </span>
      </Link>
    </li>
  );
}
