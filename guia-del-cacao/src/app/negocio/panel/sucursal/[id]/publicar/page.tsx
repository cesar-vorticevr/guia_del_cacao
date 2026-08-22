import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { BarraSesion } from "@/components/barra-sesion";
import { FormularioPublicar } from "@/components/negocio/formularios";
import { perfilActual } from "@/lib/auth/sesion";
import { listarTiers, miSucursal, queLeFalta } from "@/lib/datos/sucursales";
import { PAGO_SIMULADO } from "@/lib/pagos";

export const metadata: Metadata = { title: "Publicar micrositio · Guía del Cacao" };

export default async function Publicar({ params }: { params: Promise<{ id: string }> }) {
  const perfil = await perfilActual();

  if (!perfil) redirect("/login");
  if (perfil.rol !== "negocio") redirect("/cuenta");

  const { id } = await params;
  const sucursal = await miSucursal(perfil.id, id);

  if (!sucursal) redirect("/negocio/panel");
  if (sucursal.estado === "publicado" || sucursal.estado === "pendiente_aprobacion") {
    redirect(`/negocio/panel/sucursal/${id}`);
  }

  const tiers = await listarTiers();

  // Lo que falta lo dice la base, no esta pantalla: la misma funcion que usa
  // el trigger al publicar. Asi no puede pasar que aqui se vea listo y alla se
  // rechace.
  const falta = await queLeFalta(sucursal.id);

  return (
    <>
      <BarraSesion nombre={perfil.nombre} />

      <main className="mx-auto grid w-[92vw] max-w-xl gap-6 py-8">
        <div>
          <Link
            href={`/negocio/panel/sucursal/${id}`}
            className="font-bold text-selva underline"
          >
            ← Volver al editor
          </Link>

          <h1 className="mt-3 font-display text-3xl">Publicar {sucursal.nombre_sucursal}</h1>
          <p className="mt-2 text-cacao">
            El cobro es mensual y por sucursal. El plan no solo cambia qué tan
            visible eres: desbloquea funciones.
          </p>
        </div>

        {PAGO_SIMULADO && (
          <p className="rounded-3xl border-2 border-mango/50 bg-mango/15 p-5 text-cacao">
            <strong>Cobro simulado.</strong> Todavía no hay pasarela de pago
            conectada, así que no se te va a cobrar nada. El resto del flujo sí
            es el definitivo: al confirmar, tu micrositio se publica.
          </p>
        )}

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
          <FormularioPublicar sucursalId={sucursal.id} tiers={tiers} />
        )}

        <p className="text-sm text-cacao/70">
          En cuanto se registre el pago tu micrositio aparece en el directorio,
          sin esperar a que nadie lo apruebe. Puedes seguir editándolo después.
        </p>
      </main>
    </>
  );
}
