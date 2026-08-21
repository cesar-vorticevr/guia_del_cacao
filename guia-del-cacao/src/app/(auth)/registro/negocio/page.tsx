import Link from "next/link";
import type { Metadata } from "next";
import { BotonGoogle } from "@/components/boton-google";
import { FormularioNegocio } from "@/components/formularios-auth";
import { listarCategorias } from "@/lib/datos/categorias";

export const metadata: Metadata = { title: "Cuenta de negocio · Guía del Cacao" };

export default async function RegistroNegocio() {
  const categorias = await listarCategorias();

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="font-display text-3xl">Cuenta de negocio</h1>
        <p className="mt-2 text-cacao">
          Crear tu micrositio no cuesta nada. Solo se paga cuando decides
          publicarlo.
        </p>
      </div>

      <FormularioNegocio categorias={categorias} />

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
