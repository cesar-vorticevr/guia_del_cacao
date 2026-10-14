import Link from "next/link";
import type { Metadata } from "next";
import { InsigniaEstado } from "@/components/insignia-estado";
import { Promedio, SinCalificar } from "@/components/publico/estrellas";
import { calificacionesDe } from "@/lib/datos/publico";
import { pausarSucursal, reactivarSucursal } from "@/lib/admin/acciones";
import { sucursalesPagina } from "@/lib/datos/admin";
import { Buscador, numeroDePagina, Paginacion } from "@/components/admin/listas";

export const metadata: Metadata = { title: "Micrositios · Guía del Cacao" };

export default async function Micrositios({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; pagina?: string }>;
}) {
  const { q = "", pagina } = await searchParams;
  const resultado = await sucursalesPagina(numeroDePagina(pagina), q);
  const sucursales = resultado.filas;
  const promedios = await calificacionesDe(sucursales.map((s) => s.id));

  return (
    <>
      <h1 className="font-display text-3xl">Micrositios</h1>
      <p className="mt-2 text-cacao">
        Pausar saca un micrositio del directorio sin borrarlo. Como la pausa es
        de moderación, el negocio no puede reactivarlo por su cuenta.
      </p>

      <div className="mt-6">
        <Buscador
          base="/admin/micrositios"
          busqueda={q}
          ayuda="Nombre del negocio o de la sucursal"
        />
      </div>

      {sucursales.length === 0 ? (
        <p className="mt-6 rounded-3xl bg-crema-2 p-6 text-cacao">
          {q ? `Ningún micrositio coincide con «${q}».` : "Todavía no hay micrositios."}
        </p>
      ) : (
        <ul className="mt-6 grid gap-4">
          {sucursales.map((sucursal) => (
            <li key={sucursal.id} className="rounded-3xl bg-crema-2 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-mono text-xs tracking-wide text-cacao/70 uppercase">
                    {sucursal.marcas?.nombre_comercial}
                    {sucursal.tiers && ` · ${sucursal.tiers.nombre}`}
                  </p>
                  <p className="mt-1 font-display text-xl font-semibold text-selva-2">
                    {sucursal.nombre_sucursal}
                  </p>
                  {/* Un promedio que se desploma es la señal más temprana de
                      que un micrositio necesita una mirada. */}
                  <p className="mt-0.5">
                    {promedios.get(sucursal.id) ? (
                      <Promedio
                        promedio={promedios.get(sucursal.id)!.promedio}
                        total={promedios.get(sucursal.id)!.total}
                      />
                    ) : (
                      <SinCalificar />
                    )}
                  </p>
                </div>

                <InsigniaEstado estado={sucursal.estado} />
              </div>

              {sucursal.estado === "pausado" && (
                <p className="mt-3 rounded-2xl bg-white px-4 py-3 text-cacao">
                  {sucursal.pausado_por_admin
                    ? "Pausado por moderación. Solo un administrador puede reactivarlo."
                    : "El propio negocio lo pausó. Puede reactivarlo cuando quiera."}
                </p>
              )}

              <div className="mt-4 flex flex-wrap gap-3">
                {sucursal.estado === "publicado" && (
                  <>
                    <Link
                      href={`/marca/${sucursal.slug}`}
                      className="min-h-11 rounded-full border-2 border-selva/25 bg-white px-5 py-2.5 font-bold text-selva-2"
                    >
                      Ver
                    </Link>
                    <form action={pausarSucursal}>
                      <input type="hidden" name="sucursal_id" value={sucursal.id} />
                      <button
                        type="submit"
                        className="min-h-11 rounded-full border-2 border-guayaba/50 px-5 py-2.5 font-bold text-cacao"
                      >
                        Pausar
                      </button>
                    </form>
                  </>
                )}

                {sucursal.estado === "pausado" && (
                  <form action={reactivarSucursal}>
                    <input type="hidden" name="sucursal_id" value={sucursal.id} />
                    <button
                      type="submit"
                      className="min-h-11 rounded-full bg-selva px-5 py-2.5 font-bold text-crema"
                    >
                      Reactivar
                    </button>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Paginacion
        base="/admin/micrositios"
        pagina={resultado.pagina}
        paginas={resultado.paginas}
        total={resultado.total}
        parametros={{ q }}
        nombre={resultado.total === 1 ? "micrositio" : "micrositios"}
      />
    </>
  );
}
