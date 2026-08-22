import Link from "next/link";
import { conMonedas, rango as nombreRango } from "@/lib/vocabulario";

/**
 * El marcador del pasaporte, en el encabezado de todo el sitio público.
 *
 * Es el enganche del programa: si las monedas solo se ven al entrar a
 * /cuenta, nadie se entera de que está a tres de subir de rango. Aquí viajan
 * con la persona.
 *
 * El número va en `font-mono` como en /cuenta, para que se lea como marcador
 * y no como texto corrido.
 */
export function PastillaPasaporte({
  puntos,
  nivel,
}: {
  puntos: number;
  nivel: number;
}) {
  const actual = nombreRango(nivel);

  return (
    <Link
      href="/cuenta"
      aria-label={`Tu pasaporte: ${conMonedas(puntos)}, rango ${actual.nombre}`}
      className="flex min-h-10 items-center gap-2 rounded-full bg-selva-2 py-1.5 pl-1.5 pr-3.5 transition-colors hover:bg-cacao"
    >
      <span
        aria-hidden="true"
        className="grid size-7 shrink-0 place-items-center rounded-full bg-mango font-mono text-sm font-bold text-ink"
      >
        {puntos > 99 ? "99+" : puntos}
      </span>
      <span aria-hidden="true" className="max-w-24 truncate text-xs font-bold">
        {actual.nombre}
      </span>
    </Link>
  );
}
