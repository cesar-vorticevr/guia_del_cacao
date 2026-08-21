import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { BarraSesion } from "@/components/barra-sesion";
import { FormularioNuevaSucursal } from "@/components/negocio/formularios";
import { perfilActual } from "@/lib/auth/sesion";

export const metadata: Metadata = { title: "Nueva sucursal · Guía del Cacao" };

export default async function NuevaSucursal() {
  const perfil = await perfilActual();

  if (!perfil) redirect("/login");
  if (perfil.rol !== "negocio") redirect("/cuenta");

  return (
    <>
      <BarraSesion nombre={perfil.nombre} />

      <main className="mx-auto grid w-[92vw] max-w-md gap-5 py-8">
        <div>
          <h1 className="font-display text-3xl">Nueva sucursal</h1>
          <p className="mt-2 text-cacao">
            Cada sucursal es un micrositio aparte y se cobra por separado. Puedes
            armarla sin costo y publicarla después.
          </p>
        </div>

        <FormularioNuevaSucursal />

        <Link href="/negocio/panel" className="text-center font-bold text-selva underline">
          Volver al panel
        </Link>
      </main>
    </>
  );
}
