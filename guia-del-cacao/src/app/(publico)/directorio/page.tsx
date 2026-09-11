import Link from "next/link";
import type { Metadata } from "next";
import { BuscadorDirectorio } from "@/components/publico/buscador-directorio";
import { entidadesConNegocios, listarDirectorio } from "@/lib/datos/publico";
import { listarCategorias } from "@/lib/datos/categorias";
import { esEntidad } from "@/lib/entidades";
import { misFavoritosEntre } from "@/lib/datos/favoritos";
import {
  catalogoPorMarca,
  productosEnVariosNegocios,
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
  searchParams: Promise<{ categoria?: string; estado?: string; q?: string }>;
}) {
  const { categoria, estado, q } = await searchParams;
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
    productosEnVariosNegocios(),
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

  const activa = categorias.find((c) => c.id === categoriaId);

  /** Conserva los demás filtros al cambiar uno: son dos ejes, no dos botones. */
  const conFiltros = (cambio: { categoria?: number; estado?: string }) => {
    const busca = new URLSearchParams();
    const cat = "categoria" in cambio ? cambio.categoria : categoriaId;
    const ent = "estado" in cambio ? cambio.estado : entidad;
    if (cat) busca.set("categoria", String(cat));
    if (ent) busca.set("estado", ent);
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
          activa ? `Negocios en la categoría ${activa.nombre}` : "Negocios del cacao",
          entidad ? `en ${entidad}` : "en todo México",
        ].join(" ")}
        .
      </p>

      {/*
        La `key` es lo que hace que una búsqueda nueva desde la portada reemplace
        a la anterior. Sin ella, llegar a `?q=museo` teniendo abierto `?q=finca`
        deja la caja con lo viejo: el estado sobrevive porque la ruta es la misma.
      */}
      <BuscadorDirectorio
        key={consulta}
        sucursales={sucursales}
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
          escrita a mano: salen del catálogo real, y solo aparecen los productos
          que están en dos o más negocios. Si tres cargan "tablilla de
          chocolate", "tablilla" aparece sola.

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
                    className={`${PILDORA} bg-white text-cacao`}
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

      {sucursales.length === 0 && (
        <p className="mt-6 rounded-3xl bg-crema-2 p-6 text-cacao">
          {entidad
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
