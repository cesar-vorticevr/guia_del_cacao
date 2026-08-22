import Link from "next/link";
import { urlImagen } from "@/lib/imagenes";
import { Promedio } from "@/components/publico/estrellas";
import { tonoDeCategoria } from "@/lib/paleta";
import type { TarjetaDirectorio } from "@/lib/datos/publico";

/**
 * Tarjeta del directorio. El Tier 3 se distingue, porque parte de lo que paga
 * es salir arriba.
 *
 * La sombra dura y el salto al pasar el dedo son a propósito: la tarjeta tiene
 * que sentirse un objeto que se puede empujar, no un rectángulo pintado.
 */
export function TarjetaSucursal({ sucursal }: { sucursal: TarjetaDirectorio }) {
  const logo = urlImagen(sucursal.logo);
  const destacada = sucursal.tier_id === 3;
  const tono = tonoDeCategoria(sucursal.marcas?.categoria_id);

  return (
    <li>
      <Link
        href={`/marca/${sucursal.slug}`}
        className={`flex h-full gap-4 rounded-3xl border-2 bg-white p-5 shadow-dura transition-all hover:-translate-y-0.5 hover:shadow-dura-alta ${
          destacada ? "border-mango" : "border-ink/10"
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
            className={`grid size-16 shrink-0 place-items-center rounded-2xl font-display text-2xl ${tono.suave}`}
          >
            {sucursal.nombre_sucursal.charAt(0)}
          </span>
        )}

        <span className="min-w-0">
          <span className="block font-display text-lg font-semibold text-selva-2">
            {sucursal.marcas?.nombre_comercial}
          </span>

          <span className="flex items-center gap-1.5 text-sm text-cacao/80">
            <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${tono.punto}`} />
            {sucursal.nombre_sucursal}
          </span>

          {sucursal.calificacion && (
            <span className="mt-1 block">
              <Promedio
                promedio={sucursal.calificacion.promedio}
                total={sucursal.calificacion.total}
              />
            </span>
          )}

          {sucursal.acerca_de && (
            <span className="mt-1.5 line-clamp-2 block text-cacao">{sucursal.acerca_de}</span>
          )}

          {destacada && (
            <span className="mt-2 inline-block rounded-full bg-mango px-3 py-1 font-mono text-xs font-bold text-ink">
              Destacado
            </span>
          )}
        </span>
      </Link>
    </li>
  );
}
