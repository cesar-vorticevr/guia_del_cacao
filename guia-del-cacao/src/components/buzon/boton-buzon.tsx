import Link from "next/link";
import { IconoSobre } from "@/components/iconos";

/**
 * El sobre del encabezado, con los mensajes sin leer encima. Va en los tres
 * encabezados —el público, el del panel del negocio y el del administrador—
 * para que cualquier cuenta llegue a su buzón desde donde esté.
 */
export function BotonBuzon({ sinLeer }: { sinLeer: number }) {
  return (
    <Link
      href="/buzon"
      aria-label={sinLeer > 0 ? `Buzón: ${sinLeer} sin leer` : "Buzón"}
      className="relative grid size-10 shrink-0 place-items-center rounded-full border-2 border-mango/40 text-crema transition-colors hover:border-mango hover:text-mango"
    >
      <IconoSobre className="size-5" />
      {sinLeer > 0 && (
        <span className="absolute -right-1.5 -top-1.5 grid min-w-5 place-items-center rounded-full bg-guayaba px-1 text-[0.7rem] font-extrabold leading-5 text-white shadow-[0_0_10px_rgb(255_93_115/0.8)]">
          {sinLeer > 99 ? "99+" : sinLeer}
        </span>
      )}
    </Link>
  );
}
