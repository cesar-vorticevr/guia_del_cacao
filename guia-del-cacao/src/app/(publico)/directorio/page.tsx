import Link from "next/link";
import type { Metadata } from "next";
import { BuscadorDirectorio } from "@/components/publico/buscador-directorio";
import { listarDirectorio } from "@/lib/datos/publico";
import { listarCategorias } from "@/lib/datos/categorias";
import { tonoDeCategoria } from "@/lib/paleta";

export const metadata: Metadata = { title: "Directorio · Guía del Cacao" };

/** Clases comunes de las píldoras de filtro; lo único que cambia es el color. */
const PILDORA =
  "block rounded-full border-2 border-ink/10 px-4 py-2 text-sm font-bold shadow-dura-sm transition-transform active:translate-y-0.5";

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

  const nombresDeCategoria = Object.fromEntries(
    categorias.map((c) => [c.id, c.nombre]),
  );

  return (
    <>
      <h1 className="pt-8 font-display text-3xl">Explorar</h1>
      <p className="mt-2 text-cacao">
        {activa
          ? `Negocios en la categoría ${activa.nombre}.`
          : "Todos los negocios del cacao publicados en la plataforma."}
      </p>

      <BuscadorDirectorio
        sucursales={sucursales}
        categorias={nombresDeCategoria}
      >
        {/*
        Las categorías se acomodan en varios renglones en vez de irse a un
        carril horizontal. El carril escondía la mitad de las opciones detrás de
        un gesto que en celular casi nadie hace: si no se ven, no existen.

        Cada una trae su color puesto, no solo la activa: así la fila se lee
        como una fila de colores y se reconoce de reojo cuál es cuál.
      */}
        <nav aria-label="Filtrar por categoría" className="pt-5">
          <p className="mb-2 font-bold text-selva-2">Por tipo de negocio</p>

          <ul className="flex flex-wrap gap-2.5">
            <li>
              <Link
                href="/directorio"
                aria-current={!categoriaId}
                className={`${PILDORA} ${
                  !categoriaId
                    ? "bg-selva text-crema"
                    : "bg-crema-2 text-selva-2"
                }`}
              >
                Todas
              </Link>
            </li>

            {categorias.map((c) => {
              const tono = tonoDeCategoria(c.id);

              return (
                <li key={c.id}>
                  <Link
                    href={`/directorio?categoria=${c.id}`}
                    aria-current={categoriaId === c.id}
                    className={`${PILDORA} ${categoriaId === c.id ? tono.solido : tono.suave}`}
                  >
                    {c.nombre}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </BuscadorDirectorio>

      {sucursales.length === 0 && (
        <p className="mt-6 rounded-3xl bg-crema-2 p-6 text-cacao">
          {activa
            ? "Todavía no hay negocios publicados en esta categoría."
            : "Todavía no hay micrositios publicados."}
        </p>
      )}
    </>
  );
}
