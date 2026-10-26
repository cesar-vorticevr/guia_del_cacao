import Link from "next/link";

/**
 * La puerta al programa de Embajadores del Cacao desde la cuenta de cada quien.
 * Va en la cuenta y no en la barra de arriba: es para quien ya está dentro y
 * conoce a otros negocios, no lo primero que necesita quien llega.
 */
export function InvitacionAEmbajador() {
  return (
    <Link
      href="/embajador"
      className="tarjeta-magica flex flex-wrap items-center justify-between gap-3 rounded-3xl border-2 border-mango/40 bg-white px-6 py-5"
    >
      <span>
        <span className="antetitulo">Embajadores del Cacao</span>
        <strong className="mt-1 block font-display text-xl">
          Invita negocios y gana el 25% de cada pago
        </strong>
      </span>
      <span className="font-bold text-mango">Ver mi código →</span>
    </Link>
  );
}
