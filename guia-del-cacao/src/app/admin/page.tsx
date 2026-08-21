import type { Metadata } from "next";
import { FormularioRechazo } from "@/components/admin/formularios";
import { aprobarSucursal } from "@/lib/admin/acciones";
import { resumen, sucursalesEnRevision } from "@/lib/datos/admin";
import { pesos } from "@/lib/tipos";

export const metadata: Metadata = { title: "Administración · Guía del Cacao" };

/**
 * Cola de aprobación. Turismo no participa en esta decisión (spec §3.3): es
 * exclusiva del administrador.
 */
export default async function Admin() {
  const [pendientes, numeros] = await Promise.all([sucursalesEnRevision(), resumen()]);

  const tarjetas = [
    { texto: "Por revisar", valor: numeros.enRevision, tono: "text-guayaba" },
    { texto: "Publicados", valor: numeros.publicadas, tono: "text-selva" },
    { texto: "Pausados", valor: numeros.pausadas, tono: "text-cacao" },
    { texto: "Marcas", valor: numeros.marcas, tono: "text-selva" },
    { texto: "Personas", valor: numeros.perfiles, tono: "text-selva" },
  ];

  return (
    <>
      <h1 className="font-display text-3xl">Administración</h1>

      <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {tarjetas.map((tarjeta) => (
          <li key={tarjeta.texto} className="rounded-2xl bg-crema-2 p-4">
            <p className={`font-mono text-3xl font-bold ${tarjeta.tono}`}>{tarjeta.valor}</p>
            <p className="mt-1 text-sm text-cacao">{tarjeta.texto}</p>
          </li>
        ))}
      </ul>

      <h2 className="mt-10 font-display text-2xl">Micrositios en revisión</h2>

      {pendientes.length === 0 ? (
        <p className="mt-4 rounded-3xl bg-crema-2 p-6 text-cacao">
          No hay nada pendiente por ahora.
        </p>
      ) : (
        <ul className="mt-5 grid gap-5">
          {pendientes.map((sucursal) => (
            <li key={sucursal.id} className="grid gap-4 rounded-3xl bg-crema-2 p-6">
              <div>
                <p className="font-mono text-xs tracking-wide text-cacao/70 uppercase">
                  {sucursal.marcas?.nombre_comercial}
                  {sucursal.tiers &&
                    ` · ${sucursal.tiers.nombre} · ${pesos(sucursal.tiers.precio_mensual)}/mes`}
                </p>
                <h3 className="mt-1 font-display text-xl">{sucursal.nombre_sucursal}</h3>
                <p className="mt-1 font-mono text-xs text-cacao/70">/marca/{sucursal.slug}</p>
              </div>

              {sucursal.acerca_de && (
                <p className="rounded-2xl bg-white p-4 text-cacao">{sucursal.acerca_de}</p>
              )}

              <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
                <form action={aprobarSucursal}>
                  <input type="hidden" name="sucursal_id" value={sucursal.id} />
                  <button
                    type="submit"
                    className="min-h-14 w-full rounded-full bg-selva px-6 font-display text-lg font-semibold text-crema"
                  >
                    Aprobar y publicar
                  </button>
                </form>

                <FormularioRechazo sucursalId={sucursal.id} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
