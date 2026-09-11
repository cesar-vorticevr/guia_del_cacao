"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { IconoLupa } from "@/components/iconos";
import { parecido } from "@/lib/busqueda";
import { nombrarNegocio } from "@/lib/nombres";
import { urlImagen } from "@/lib/imagenes";
import type { TarjetaDirectorio } from "@/lib/datos/publico";
import type { ProductoBuscable } from "@/lib/datos/busqueda-de-productos";

/** Un negocio sugerido, y el producto que lo trajo si fue un producto. */
type Sugerencia = {
  sucursal: TarjetaDirectorio;
  producto: ProductoBuscable | null;
};

/** Cuántas sugerencias se enseñan. Más que esto y la lista tapa la portada. */
const MAXIMO = 5;

/**
 * El buscador de la portada, con sugerencias mientras se escribe.
 *
 * Filtra sobre el directorio que la portada ya cargó para pintar sus tarjetas:
 * ni una consulta más al servidor por cada letra. El directorio de una feria son
 * decenas de negocios, así que el filtro cuesta menos que el viaje de red que
 * evita. Si algún día son miles, esto se cambia por una consulta con `pg_trgm`.
 *
 * Enter sin nada resaltado va al directorio con lo escrito; el negocio se abre
 * eligiéndolo de la lista, no adivinando cuál era el primero.
 *
 * Las sugerencias son enlaces de verdad y el teclado mueve el foco entre ellos,
 * en vez del `aria-activedescendant` de un combobox. Es lo que conserva abrir en
 * pestaña nueva, el menú contextual y el Enter nativo del navegador.
 */
export function BuscadorPortada({
  sucursales,
  /** Nombre de cada categoría, por id: también se puede buscar por ella. */
  categorias,
  /** El catálogo de cada marca, para sugerir también por producto. */
  catalogo,
}: {
  sucursales: TarjetaDirectorio[];
  categorias: Record<number, string>;
  catalogo: Record<string, ProductoBuscable[]>;
}) {
  const router = useRouter();
  const [consulta, setConsulta] = useState("");
  const [abierto, setAbierto] = useState(false);

  const caja = useRef<HTMLDivElement | null>(null);
  const entrada = useRef<HTMLInputElement | null>(null);
  const opciones = useRef<(HTMLAnchorElement | null)[]>([]);
  const pie = useRef<HTMLButtonElement | null>(null);

  const texto = consulta.trim();

  const sugerencias = useMemo(() => {
    if (!texto) return [];

    return sucursales
      .map((sucursal) => {
        const porElNegocio = parecido(texto, [
          sucursal.marcas?.nombre_comercial,
          sucursal.nombre_sucursal,
          sucursal.acerca_de,
          categorias[sucursal.marcas?.categoria_id ?? 0],
        ]);

        // El producto se prueba uno por uno para poder decir cuál coincidió, no
        // solo que alguno lo hizo.
        const producto = (catalogo[sucursal.marca_id] ?? []).find((p) =>
          parecido(texto, [p.nombre]),
        );

        if (!porElNegocio && !producto) return null;

        return { sucursal, producto: porElNegocio ? null : (producto ?? null) };
      })
      .filter((s): s is Sugerencia => s !== null)
      .slice(0, MAXIMO);
  }, [texto, sucursales, categorias, catalogo]);

  const desplegado = abierto && texto.length > 0;

  function verTodo() {
    setAbierto(false);
    router.push(texto ? `/directorio?q=${encodeURIComponent(texto)}` : "/directorio");
  }

  /**
   * Mueve el foco por la lista. `-1` devuelve el foco a la caja de texto y
   * pasarse por abajo cae en el pie, que es el último renglón navegable.
   */
  function enfocar(indice: number) {
    if (indice < 0) return entrada.current?.focus();
    if (indice >= sugerencias.length) return pie.current?.focus();
    opciones.current[indice]?.focus();
  }

  return (
    <div
      ref={caja}
      className="relative z-20 mx-auto mt-6 w-full max-w-2xl"
      onBlur={(evento) => {
        // Solo se cierra si el foco se fue de verdad: al pasar del input a una
        // sugerencia el foco sigue aquí dentro, y cerrar ahí mataría el clic.
        if (!evento.currentTarget.contains(evento.relatedTarget)) setAbierto(false);
      }}
      onKeyDown={(evento) => {
        if (evento.key === "Escape") {
          setAbierto(false);
          entrada.current?.focus();
        }
      }}
    >
      <form
        role="search"
        onSubmit={(evento) => {
          evento.preventDefault();
          verTodo();
        }}
        className="flex items-center gap-2 rounded-full border-2 border-ink/10 bg-white p-2 shadow-dura sm:gap-3 sm:p-2.5"
      >
        <IconoLupa className="ml-2 size-5 shrink-0 text-cacao/50 sm:ml-3 sm:size-6" />

        <label className="min-w-0 flex-1">
          <span className="sr-only">Buscar un negocio o un producto</span>
          <input
            ref={entrada}
            type="search"
            value={consulta}
            onChange={(evento) => {
              setConsulta(evento.target.value);
              setAbierto(true);
            }}
            onFocus={() => setAbierto(true)}
            onKeyDown={(evento) => {
              if (evento.key === "ArrowDown" && sugerencias.length > 0) {
                evento.preventDefault();
                setAbierto(true);
                enfocar(0);
              }
            }}
            placeholder="Una chocolatería, una finca, un molinillo…"
            autoComplete="off"
            role="combobox"
            aria-expanded={desplegado}
            aria-controls="sugerencias-portada"
            className="min-h-11 w-full bg-transparent text-base text-ink outline-none placeholder:text-cacao/40"
          />
        </label>

        <button
          type="submit"
          className="min-h-11 shrink-0 rounded-full bg-selva px-5 font-bold text-crema shadow-dura-sm transition-transform active:translate-y-0.5 sm:px-7"
        >
          Buscar
        </button>
      </form>

      {desplegado && (
        <div
          id="sugerencias-portada"
          className="absolute inset-x-0 top-full mt-2 overflow-hidden rounded-3xl border-2 border-ink/10 bg-white text-left shadow-dura-alta"
        >
          {sugerencias.length === 0 ? (
            <p className="px-5 py-4 text-cacao">
              Ningún negocio se parece a lo que escribiste.
            </p>
          ) : (
            <ul>
              {sugerencias.map(({ sucursal, producto }, i) => {
                const nombres = nombrarNegocio(sucursal);
                const logo = urlImagen(sucursal.logo);

                return (
                  <li key={sucursal.id}>
                    <Link
                      ref={(nodo) => {
                        opciones.current[i] = nodo;
                      }}
                      href={`/marca/${sucursal.slug}`}
                      onKeyDown={(evento) => {
                        if (evento.key === "ArrowDown") {
                          evento.preventDefault();
                          enfocar(i + 1);
                        }
                        if (evento.key === "ArrowUp") {
                          evento.preventDefault();
                          enfocar(i - 1);
                        }
                      }}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-crema-2 focus-visible:bg-crema-2"
                    >
                      {logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={logo}
                          alt=""
                          className="size-10 shrink-0 rounded-xl border-2 border-selva/10 object-cover"
                        />
                      ) : (
                        <span
                          aria-hidden="true"
                          className="grid size-10 shrink-0 place-items-center rounded-xl bg-crema-2 font-display text-lg text-selva-2"
                        >
                          {nombres.marca?.charAt(0)}
                        </span>
                      )}

                      <span className="min-w-0">
                        <span className="block truncate font-bold text-selva-2">
                          {nombres.marca}
                        </span>
                        {/*
                          Cuando lo que coincidió fue un producto, el renglón
                          dice cuál: si no, buscar "molinillo" devuelve seis
                          nombres de negocio y ninguna pista de por qué.

                          Sin precio, por lo mismo que en la tarjeta del
                          directorio: media docena de precios en fila hace de
                          esto un comparador.
                        */}
                        {producto ? (
                          <span className="block truncate text-sm text-cacao/70">
                            Tiene {producto.nombre}
                          </span>
                        ) : (
                          nombres.sucursal && (
                            <span className="block truncate text-sm text-cacao/70">
                              {nombres.sucursal}
                            </span>
                          )
                        )}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          {/*
            El pie va siempre, también sin coincidencias: el filtro de aquí es el
            mismo del directorio, pero allá se ve la lista entera y los filtros
            por categoría. Es la salida para quien no encontró lo suyo entre
            cinco renglones.
          */}
          <button
            ref={pie}
            type="button"
            onClick={verTodo}
            onKeyDown={(evento) => {
              if (evento.key === "ArrowUp") {
                evento.preventDefault();
                enfocar(sugerencias.length - 1);
              }
            }}
            className="flex w-full items-center gap-3 border-t-2 border-ink/10 px-4 py-3.5 text-left font-bold text-selva hover:bg-crema-2 focus-visible:bg-crema-2"
          >
            <IconoLupa className="size-5 shrink-0 text-selva/60" />
            <span className="truncate">Ver todos los resultados de «{texto}»</span>
          </button>
        </div>
      )}
    </div>
  );
}
