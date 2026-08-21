import Link from "next/link";
import { BannerRotativo } from "@/components/publico/banner-rotativo";
import { TarjetaSucursal } from "@/components/publico/tarjeta-sucursal";
import { bannersDePortada, listarDirectorio } from "@/lib/datos/publico";
import { listarCategorias } from "@/lib/datos/categorias";
import { urlImagen } from "@/lib/imagenes";

export default async function Home() {
  const [banners, sucursales, categorias] = await Promise.all([
    bannersDePortada(),
    listarDirectorio(),
    listarCategorias(),
  ]);

  const diapositivas = banners.map((b) => ({
    slug: b.slug,
    nombre: b.nombre,
    imagen: urlImagen(b.imagen),
    texto: b.texto,
  }));

  return (
    <>
      <BannerRotativo diapositivas={diapositivas} />

      <section className="pt-8">
        <h1 className="font-display text-3xl leading-tight sm:text-4xl">
          El cacao de Tabasco, en un solo lugar
        </h1>
        <p className="mt-3 max-w-prose text-lg text-cacao">
          Productoras, chocolaterías y museos; eventos de la feria y un pasaporte
          digital de puntos que funciona todo el año.
        </p>
      </section>

      <nav aria-label="Categorías" className="pt-6">
        <ul className="flex gap-2.5 overflow-x-auto pb-2">
          {categorias.map((categoria) => (
            <li key={categoria.id} className="shrink-0">
              <Link
                href={`/directorio?categoria=${categoria.id}`}
                className="block rounded-full border-2 border-selva/15 bg-crema-2 px-4 py-2 text-sm font-bold text-selva-2"
              >
                {categoria.nombre}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <section className="pt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-display text-2xl">En el directorio</h2>
          <Link href="/directorio" className="font-bold text-selva underline">
            Ver todo
          </Link>
        </div>

        {sucursales.length === 0 ? (
          <p className="mt-4 rounded-3xl bg-crema-2 p-6 text-cacao">
            Todavía no hay micrositios publicados. Si tienes un negocio de cacao,{" "}
            <Link href="/registro/negocio" className="font-bold text-selva underline">
              este es buen momento para ser el primero
            </Link>
            .
          </p>
        ) : (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {sucursales.slice(0, 6).map((sucursal) => (
              <TarjetaSucursal key={sucursal.id} sucursal={sucursal} />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
