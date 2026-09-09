import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { FormularioPublicar } from "@/components/negocio/formularios";
import { perfilActual } from "@/lib/auth/sesion";
import { listarTiers, miSucursal, queLeFalta } from "@/lib/datos/sucursales";

export const metadata: Metadata = {
  title: "Publicar micrositio · Guía del Cacao",
};

/**
 * Sacar una sucursal al directorio.
 *
 * Aquí se elige el plan. Desde la spec v2 el cobro es por sucursal, así que la
 * pregunta pertenece a esta pantalla y no a la cuenta: dos locales de la misma
 * marca pueden estar en planes distintos.
 *
 * Lo único que impide llegar al plan es que el micrositio esté incompleto, y
 * eso lo dice la base con la misma función que usa el trigger.
 */
export default async function Publicar({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const perfil = await perfilActual();

  if (!perfil) redirect("/login");
  if (perfil.rol !== "negocio") redirect("/cuenta");

  const { id } = await params;
  const sucursal = await miSucursal(perfil.id, id);

  if (!sucursal) redirect("/negocio/panel");
  if (
    sucursal.estado === "publicado" ||
    sucursal.estado === "pendiente_aprobacion"
  ) {
    redirect(`/negocio/panel/sucursal/${id}`);
  }

  // Lo que falta lo dice la base, no esta pantalla: la misma función que usa el
  // trigger al publicar. Así no puede pasar que aquí se vea listo y allá se
  // rechace.
  const [falta, tiers] = await Promise.all([
    queLeFalta(sucursal.id),
    listarTiers(),
  ]);

  return (
    <div className="mx-auto grid max-w-xl gap-6">
      <div>
        <Link
          href={`/negocio/panel/sucursal/${id}`}
          className="font-bold text-selva underline"
        >
          ← Volver al editor
        </Link>

        <h1 className="mt-3 font-display text-3xl">
          Publicar {sucursal.nombre_sucursal}
        </h1>
      </div>

      {falta ? (
        <div className="rounded-3xl border-2 border-guayaba/40 bg-guayaba/10 p-6">
          <p className="font-display text-xl font-semibold text-selva-2">
            Te falta algo antes de publicar
          </p>
          <p className="mt-2 text-cacao">
            Un micrositio sin esto no le sirve a quien lo encuentre. Falta{" "}
            <strong>{falta}</strong>.
          </p>
          <Link
            href={`/negocio/panel/sucursal/${id}`}
            className="mt-4 inline-block min-h-11 rounded-full bg-selva px-5 py-2.5 font-bold text-crema"
          >
            Volver a completarlo
          </Link>
        </div>
      ) : (
        <>
          <p className="text-cacao">
            Tu micrositio está completo. Elige con qué plan quieres que salga:
            lo pruebas quince días sin pagar y sin dejar tarjeta, y puedes
            cambiarlo cuantas veces quieras durante la prueba.
          </p>

          <FormularioPublicar sucursalId={sucursal.id} tiers={tiers} />
        </>
      )}
    </div>
  );
}
