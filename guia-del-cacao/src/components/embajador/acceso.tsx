import Link from "next/link";
import { esVendedor } from "@/lib/datos/embajadores";

/**
 * La puerta al panel de ventas desde la cuenta. Solo aparece a quien tiene
 * cuenta de ventas: desde la migración 000067 el programa no se anuncia, lo
 * asigna el administrador.
 */
export async function AccesoAVentas({ perfilId }: { perfilId: string }) {
  if (!(await esVendedor(perfilId))) return null;

  return (
    <Link
      href="/ventas"
      className="tarjeta-magica flex flex-wrap items-center justify-between gap-3 rounded-3xl border-2 border-mango/40 bg-white px-6 py-5"
    >
      <span>
        <span className="antetitulo">Panel de ventas</span>
        <strong className="mt-1 block font-display text-xl">
          Tu código, tu libreta y lo que llevas ganado
        </strong>
      </span>
      <span className="font-bold text-mango">Mi panel de ventas →</span>
    </Link>
  );
}
