import Link from "next/link";
import type { Metadata } from "next";
import { TarjetaSucursal } from "@/components/publico/tarjeta-sucursal";
import { listarDirectorio } from "@/lib/datos/publico";
import { listarCategorias } from "@/lib/datos/categorias";

export const metadata: Metadata = { title: "Directorio · Guía del Cacao" };

export default async function Directorio({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string }>;
}) {
  const { categoria } = await searchParams;
  const categoriaId = categoria ? Number(categoria) : undefined;

  const [sucursales, categorias] = await Promise.all([
    listarDirectorio(categoriaId),
    listarCategorias(),
  ]);

  const activa = categorias.find((c) => c.id === categoriaId);

  return (
    <>
      <h1 className="pt-8 font-display text-3xl">Directorio</h1>
      <p className="mt-2 text-cacao">
        {activa
          ? `Negocios en la categoría ${activa.nombre}.`
          : "Todos los negocios del cacao publicados en la plataforma."}
      </p>

      <nav aria-label="Filtrar por categoría" className="pt-5">
        <ul className="flex gap-2.5 overflow-x-auto pb-2">
          <li className="shrink-0">
            <Link
              href="/directorio"
              aria-current={!categoriaId}
              className={`block rounded-full border-2 px-4 py-2 text-sm font-bold ${
                !categoriaId
                  ? "border-selva bg-selva text-crema"
                  : "border-selva/15 bg-crema-2 text-selva-2"
              }`}
            >
              Todas
            </Link>
          </li>

          {categorias.map((c) => (
            <li key={c.id} className="shrink-0">
              <Link
                href={`/directorio?categoria=${c.id}`}
                aria-current={categoriaId === c.id}
                className={`block rounded-full border-2 px-4 py-2 text-sm font-bold ${
                  categoriaId === c.id
                    ? "border-selva bg-selva text-crema"
                    : "border-selva/15 bg-crema-2 text-selva-2"
                }`}
              >
                {c.nombre}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {sucursales.length === 0 ? (
        <p className="mt-6 rounded-3xl bg-crema-2 p-6 text-cacao">
          {activa
            ? "Todavía no hay negocios publicados en esta categoría."
            : "Todavía no hay micrositios publicados."}
        </p>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {sucursales.map((sucursal) => (
            <TarjetaSucursal key={sucursal.id} sucursal={sucursal} />
          ))}
        </ul>
      )}
    </>
  );
}
