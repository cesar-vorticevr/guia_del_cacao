import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { FormularioNuevaSucursal } from "@/components/negocio/formularios";
import { perfilActual } from "@/lib/auth/sesion";

export const metadata: Metadata = { title: "Nueva sucursal · Guía del Cacao" };

export default async function NuevaSucursal() {
  const perfil = await perfilActual();

  if (!perfil) redirect("/login");
  if (perfil.rol !== "negocio") redirect("/cuenta");

  // El trigger de la base rechaza el insert sin correo confirmado. Aquí se
  // devuelve al panel, que es donde está el botón para pedir el correo: dejar
  // entrar al formulario solo serviría para escribir un nombre y chocar al
  // guardar.
  if (perfil.correo_verificado_en === null) redirect("/negocio/panel");

  return (
    <div className="mx-auto grid max-w-md gap-5">
      <div>
        <h1 className="font-display text-3xl">Nueva sucursal</h1>
        <p className="mt-2 text-cacao">
          Cada sucursal es un micrositio aparte y se cobra por separado. Puedes
          armarla sin costo y publicarla después.
        </p>
      </div>

      <FormularioNuevaSucursal />

      <Link
        href="/negocio/panel"
        className="text-center font-bold text-selva underline"
      >
        Volver al panel
      </Link>
    </div>
  );
}
