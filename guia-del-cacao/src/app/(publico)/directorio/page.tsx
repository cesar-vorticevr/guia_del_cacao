import Link from "next/link";
import type { Metadata } from "next";
import { BuscadorDirectorio } from "@/components/publico/buscador-directorio";
import { entidadesConNegocios, listarDirectorio } from "@/lib/datos/publico";
import { listarCategorias } from "@/lib/datos/categorias";
import { esEntidad } from "@/lib/entidades";
import { misFavoritosEntre } from "@/lib/datos/favoritos";
import {
  catalogoPorMarca,
  palabrasQueSeRepiten,
} from "@/lib/datos/busqueda-de-productos";
import { perfilActual } from "@/lib/auth/sesion";
import { tonoDeCategoria } from "@/lib/paleta";

export const metadata: Metadata = { title: "Directorio · Guía del Cacao" };

/** Clases comunes de las píldoras de filtro; lo único que cambia es el color. */
const PILDORA =
  "block rounded-full border-2 border-ink/10 px-4 py-2 text-sm font-bold shadow-dura-sm transition-transform active:translate-y-0.5";

export default async function Directorio({
  searchParams,
}: {
  searchParams: Promise<{
    categoria?: string;
    estado?: string;
    favoritos?: string;
    q?: string;
  }>;
}) {
  const { categoria, estado, favoritos: soloMios, q } = await searchParams;
  const categoriaId = categoria ? Number(categoria) : undefined;
  const consulta = q?.trim() ?? "";

  // Se valida contra la lista: `?estado=cualquier-cosa` no debe devolver el
  // directorio entero como si no se hubiera filtrado nada.
  const entidad = esEntidad(estado) ? estado : undefined;

  const [sucursales, categorias, entidades, perfil, atajos] = await Promise.all([
    listarDirectorio(categoriaId, entidad),
    listarCategorias(),
    entidadesConNegocios(),
    perfilActual(),
    palabrasQueSeRepiten(),
  ]);

  // El catálogo de estas marcas viaja a la página para que el buscador encuentre
  // por producto sin pedirle nada al servidor por cada letra.
  const catalogo = await catalogoPorMarca(sucursales.map((s) => s.marca_id));

  // Solo un cliente guarda favoritos: a un negocio o a un administrador el
  // corazón les prometería algo que su cuenta no hace.
  const esCliente = perfil?.rol === "cliente" && perfil.rol_confirmado;
  const favoritos = await misFavoritosEntre(
    esCliente ? perfil.id : undefined,
    sucursales.map((s) => s.id),
  );

  /*
    El filtro de favoritos solo existe para quien los tiene. A quien no ha
    entrado, o entró con una cuenta que no guarda, `?favoritos=1` no le filtra
    nada: enseñarle una lista vacía por un parámetro que él no puso sería
    esconderle el directorio sin decirle por qué.
  */
  const filtrandoFavoritos = esCliente && soloMios === "1";

  const visibles = filtrandoFavoritos
    ? sucursales.filter((s) => favoritos.has(s.id))
    : sucursales;

  const activa = categorias.find((c) => c.id === categoriaId);

  /** Conserva los demás filtros al cambiar uno: son dos ejes, no dos botones. */
  const conFiltros = (cambio: {
    categoria?: number;
    estado?: string;
    favoritos?: boolean;
  }) => {
    const busca = new URLSearchParams();
    const cat = "categoria" in cambio ? cambio.categoria : categoriaId;
    const ent = "estado" in cambio ? cambio.estado : entidad;
    const fav = "favoritos" in cambio ? cambio.favoritos : filtrandoFavoritos;
    if (cat) busca.set("categoria", String(cat));
    if (ent) busca.set("estado", ent);
    if (fav) busca.set("favoritos", "1");
    const cola = busca.toString();
    return cola ? `/directorio?${cola}` : "/directorio";
  };

  const nombresDeCategoria = Object.fromEntries(
    categorias.map((c) => [c.id, c.nombre]),
  );

  return (
    <>
      <h1 className="pt-8 font-display text-3xl">Explorar</h1>
      <p className="mt-2 text-cacao">
        {[
          filtrandoFavoritos
            ? "Tus negocios favoritos"
            : activa
              ? `Negocios en la categoría ${activa.nombre}`
              : "Negocios del cacao",
          !filtrandoFavoritos && activa ? "" : null,
          entidad ? `en ${entidad}` : filtrandoFavoritos ? "" : "en todo México",
        ]
          .filter(Boolean)
          .join(" ")}
        .
      </p>

      {/*
        El filtro de favoritos va arriba de todo y en su propia línea: no es un
        eje más como el estado o la categoría, es «enséñame solo los míos», y
        se cruza con los demás. Solo aparece si esta cuenta tiene alguno —un
        filtro que siempre lleva a una lista vacía no es un filtro.
      */}
      {esCliente && favoritos.size > 0 && (
        <nav aria-label="Filtrar por favoritos" className="pt-5">
          <Link
            href={conFiltros({ favoritos: !filtrandoFavoritos })}
            aria-pressed={filtrandoFavoritos}
            className={`inline-flex items-center gap-2 ${PILDORA} ${
              filtrandoFavoritos
                ? "border-guayaba bg-guayaba text-white"
                : "bg-white text-cacao"
            }`}
          >
            <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
              <path
                d="M12 20.5 4.3 13a4.8 4.8 0 0 1 6.8-6.8l.9.9.9-.9A4.8 4.8 0 0 1 19.7 13Z"
                fill={filtrandoFavoritos ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
              />
            </svg>
            {filtrandoFavoritos
              ? "Viendo tus favoritos"
              : `Solo mis favoritos (${favoritos.size})`}
          </Link>
        </nav>
      )}

      {/*
        La `key` es lo que hace que una búsqueda nueva desde la portada reemplace
        a la anterior. Sin ella, llegar a `?q=museo` teniendo abierto `?q=finca`
        deja la caja con lo viejo: el estado sobrevive porque la ruta es la misma.
      */}
      <BuscadorDirectorio
        key={consulta}
        sucursales={visibles}
        favoritos={[...favoritos]}
        puedeGuardar={esCliente}
        haySesion={Boolean(perfil)}
        categorias={nombresDeCategoria}
        catalogo={catalogo}
        consultaInicial={consulta}
      >
        {/*
        Las categorías se acomodan en varios renglones en vez de irse a un
        carril horizontal. El carril escondía la mitad de las opciones detrás de
        un gesto que en celular casi nadie hace: si no se ven, no existen.

        Cada una trae su color puesto, no solo la activa: así la fila se lee
        como una fila de colores y se reconoce de reojo cuál es cuál.
      */}
        {/*
          El estado va antes que la categoría porque es la primera pregunta de
          quien busca: nadie en Chiapas quiere ver una chocolatería de
          Comalcalco por muy bien clasificada que esté.

          Solo aparece cuando hay negocios en más de una entidad. Mientras todo
          esté en Tabasco, un filtro con una sola opción es ruido.
        */}
        {entidades.length > 1 && (
          <nav aria-label="Filtrar por estado" className="pt-5">
            <p className="mb-2 font-bold text-selva-2">Por estado</p>

            <ul className="flex flex-wrap gap-2.5">
              <li>
                <Link
                  href={conFiltros({ estado: undefined })}
                  aria-current={!entidad}
                  className={`${PILDORA} ${
                    !entidad ? "bg-selva text-crema" : "bg-crema-2 text-selva-2"
                  }`}
                >
                  Todo México
                </Link>
              </li>

              {entidades.map((nombre) => (
                <li key={nombre}>
                  <Link
                    href={conFiltros({ estado: nombre })}
                    aria-current={entidad === nombre}
                    className={`${PILDORA} ${
                      entidad === nombre
                        ? "bg-selva text-crema"
                        : "bg-crema-2 text-selva-2"
                    }`}
                  >
                    {nombre}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}

        {/*
          Los atajos por producto, para quien no sabe ningún nombre de negocio
          —que es casi todo el mundo que llega aquí—. No son una taxonomía
          escrita a mano: salen del catálogo real.

          Y no son nombres de producto completos. Lo eran, y salían cosas como
          "Cacao en polvo 500 g": el nombre exacto de una etiqueta, que nadie
          escribe al buscar y que además solo encontraba a quien lo hubiera
          escrito igual. Ahora es el trozo que se repite entre negocios —"cacao
          en polvo", "barra"—, que es como se pide en un mostrador.

          Llevan a la misma búsqueda con `?q=`, así que reusan el buscador en
          vez de abrir un camino nuevo que haya que mantener aparte.
        */}
        {atajos.length > 0 && (
          <nav aria-label="Buscar por producto" className="pt-5">
            <p className="mb-2 font-bold text-selva-2">¿Qué andas buscando?</p>

            <ul className="flex flex-wrap gap-2.5">
              {atajos.map((nombre) => (
                <li key={nombre}>
                  <Link
                    href={`/directorio?q=${encodeURIComponent(nombre)}`}
                    className={`${PILDORA} bg-white text-cacao first-letter:uppercase`}
                  >
                    {nombre}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}

        <nav aria-label="Filtrar por categoría" className="pt-5">
          <p className="mb-2 font-bold text-selva-2">Por tipo de negocio</p>

          <ul className="flex flex-wrap gap-2.5">
            <li>
              <Link
                href={conFiltros({ categoria: undefined })}
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
                    href={conFiltros({ categoria: c.id })}
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

      {visibles.length === 0 && (
        <p className="mt-6 rounded-3xl bg-crema-2 p-6 text-cacao">
          {/*
            Con el filtro de favoritos puesto, el vacío no significa que no haya
            negocios: significa que ninguno de los tuyos cae en los otros
            filtros. Decir «todavía no hay micrositios publicados» ahí sería
            mentir sobre el estado del directorio.
          */}
          {filtrandoFavoritos
            ? `Ninguno de tus favoritos ${
                entidad || activa ? "cae en estos filtros" : "está en el directorio ahora"
              }.`
            : entidad
              ? `Todavía no hay negocios publicados en ${entidad}${
                  activa ? ` dentro de ${activa.nombre}` : ""
                }.`
              : activa
                ? "Todavía no hay negocios publicados en esta categoría."
                : "Todavía no hay micrositios publicados."}
        </p>
      )}
    </>
  );
}
