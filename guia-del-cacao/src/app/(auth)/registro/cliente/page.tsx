import Link from "next/link";
import type { Metadata } from "next";
import { BotonGoogle } from "@/components/boton-google";
import { FormularioCliente } from "@/components/formularios-auth";

export const metadata: Metadata = { title: "Cuenta de cliente · Guía del Cacao" };

export default function RegistroCliente() {
  return (
    <div className="grid gap-5">
      <div>
        <h1 className="font-display text-3xl">Cuenta de cliente</h1>
        <p className="mt-2 text-cacao">
          Para juntar mazorcas de cacao y dejar reseñas en los negocios que
          visites.
        </p>
      </div>

      <FormularioCliente />

      <div className="flex items-center gap-3 text-sm text-cacao/60">
        <span className="h-px flex-1 bg-selva/15" />o<span className="h-px flex-1 bg-selva/15" />
      </div>

      <BotonGoogle />

      <p className="text-center text-cacao">
        <Link href="/registro" className="font-bold text-selva underline">
          Volver
        </Link>
      </p>
    </div>
  );
}
