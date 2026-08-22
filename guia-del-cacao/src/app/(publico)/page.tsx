import Link from "next/link";
import { BannerRotativo } from "@/components/publico/banner-rotativo";
import { TarjetaSucursal } from "@/components/publico/tarjeta-sucursal";
import { bannersDePortada, calificacionesDe, listarDirectorio } from "@/lib/datos/publico";
import { listarCategorias } from "@/lib/datos/categorias";
import { tonoDeCategoria } from "@/lib/paleta";
import { urlImagen } from "@/lib/imagenes";

export default async function Home() {
  const [banners, sucursales, categorias] = await Promise.all([
    bannersDePortada(),
    listarDirectorio(),
    listarCategorias(),
  ]);

  // Los promedios de todo el banner en una sola consulta, no una por foto.
  const promedios = await calificacionesDe(banners.map((b) => b.id));

  const diapositivas = banners.map((b) => ({
    slug: b.slug,
    nombre: b.nombre,
    sucursal: b.sucursal,
    imagen: urlImagen(b.imagen),
    texto: b.texto,
    calificacion: promedios.get(b.id) ?? null,
  }));

  return (
    <>
      <BannerRotativo diapositivas={diapositivas} />

      {/*
        El bloque de mango es la primera cosa que se ve después del banner: el
        encabezado ya es verde, así que dejar la portada en crema hacía que
        todo el sitio se leyera de un solo color. Y el botón de explorar va
        aquí además de en la barra de abajo — la invitación tiene que estar
        donde cae el ojo, no solo donde cae el pulgar.
      */}
      <section className="mt-6 rounded-[2rem] border-2 border-ink/10 bg-mango p-6 shadow-dura sm:p-9">
        <h1 className="font-display text-3xl leading-tight text-ink sm:text-4xl">
          El cacao de Tabasco, en un solo lugar
        </h1>
        <p className="mt-3 max-w-prose text-lg text-cacao">
          Productoras, chocolaterías y museos; eventos de la feria y un pasaporte
          digital de monedas de chocolate que funciona todo el año.
        </p>

        <Link
          href="/directorio"
          className="mt-5 inline-flex min-h-12 items-center rounded-full bg-selva px-6 py-3 font-bold text-crema shadow-dura-sm transition-transform active:translate-y-0.5"
        >
          Explorar el directorio
        </Link>
      </section>

      <nav aria-label="Categorías" className="pt-6">
        <ul className="flex gap-2.5 overflow-x-auto pb-2">
          {categorias.map((categoria) => (
            <li key={categoria.id} className="shrink-0">
              <Link
                href={`/directorio?categoria=${categoria.id}`}
                className={`block rounded-full border-2 border-ink/10 px-4 py-2 text-sm font-bold shadow-dura-sm transition-transform active:translate-y-0.5 ${
                  tonoDeCategoria(categoria.id).solido
                }`}
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
