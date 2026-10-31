import Link from "next/link";
import type { AvisoDeMensaje } from "@/lib/datos/buzon";

/**
 * La tarjeta que lleva al buzón desde la cuenta del cliente, el panel de
 * ventas y el del negocio. El sobre del encabezado ya está en todas las
 * pantallas; esto es la entrada que se ve sin buscarla.
 *
 * Si quien mira pidió aviso de mensajes (el negocio, en su cuenta), debajo
 * van los avisos sin leer: son los que escribe el trigger del buzón.
 */
export function AccesoAlBuzon({
  sinLeer,
  avisos = [],
}: {
  sinLeer: number;
  avisos?: AvisoDeMensaje[];
}) {
  return (
    <div className="grid gap-2">
      <Link
        href="/buzon"
        className={`tarjeta-magica flex flex-wrap items-center justify-between gap-3 rounded-3xl border-2 bg-white px-6 py-5 ${
          sinLeer > 0 ? "border-mango" : "border-mango/40"
        }`}
      >
        <span>
          <span className="antetitulo">Buzón</span>
          <strong className="mt-1 block font-display text-xl">
            {sinLeer > 0
              ? `Tienes ${sinLeer === 1 ? "un mensaje" : `${sinLeer} mensajes`} sin leer`
              : "Tus conversaciones"}
          </strong>
        </span>
        <span className="font-bold text-mango">Abrir el buzón →</span>
      </Link>

      {avisos.length > 0 && (
        <ul className="grid gap-2" aria-label="Avisos de mensajes nuevos">
          {avisos.map((aviso) => (
            <li key={aviso.id}>
              <Link
                href={aviso.enlace}
                className="flex items-start gap-3 rounded-2xl border-2 border-mango/30 bg-crema-2 px-4 py-3 hover:border-mango"
              >
                <span aria-hidden="true" className="text-lg">✉</span>
                <span className="min-w-0">
                  <span className="block font-bold text-selva-2">{aviso.titulo}</span>
                  {aviso.detalle && <span className="block truncate text-sm text-cacao">{aviso.detalle}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
