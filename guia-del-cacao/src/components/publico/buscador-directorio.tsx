"use client";

import { useMemo, useState } from "react";
import { TarjetaSucursal } from "@/components/publico/tarjeta-sucursal";
import { VerMas } from "@/components/publico/ver-mas";
import { parecido } from "@/lib/busqueda";
import type { TarjetaDirectorio } from "@/lib/datos/publico";
import type { ProductoBuscable } from "@/lib/datos/busqueda-de-productos";

/** Un negocio encontrado, y el producto que lo trajo si fue un producto. */
type Resultado = {
  sucursal: TarjetaDirectorio;
  producto: ProductoBuscable | null;
};

/**
 * El buscador del directorio.
 *
 * Filtra mientras se escribe, sin esperar al servidor: la lista de una feria
 * son decenas de negocios y ya vienen cargados, así que hacer un viaje de ida
 * y vuelta por cada letra solo agregaría espera.
 *
 * El botón de buscar existe igual, y no es de adorno: en celular cierra el
 * teclado, que es lo que tapa justo los resultados que se acaban de filtrar.
 * Sin él, la única forma de ver la lista es adivinar dónde tocar para que el
 * teclado se esconda.
 *
 * La búsqueda es tolerante a acentos y erratas (ver lib/busqueda.ts): en la
 * feria nadie escribe "Chocolatería" con acento ni "Grijalva" con uve a la
 * primera.
 */
export function BuscadorDirectorio({
  sucursales,
  /** Ids que quien mira ya tiene guardados, para pintar su corazón lleno. */
  favoritos,
  /** Si esta cuenta puede guardar: hay sesión y es de visitante. */
  puedeGuardar,
  /** Para distinguir "entra a tu cuenta" de "tu cuenta no guarda favoritos". */
  haySesion,
  /** Nombre de cada categoría, por id: también se puede buscar por ella. */
  categorias,
  /** El catálogo de cada marca, para encontrar por producto. */
  catalogo,
  /** Lo que se escribió en la portada, que llega por `?q=`. */
  consultaInicial = "",
  children,
}: {
  sucursales: TarjetaDirectorio[];
  favoritos: string[];
  puedeGuardar: boolean;
  haySesion: boolean;
  categorias: Record<number, string>;
  catalogo: Record<string, ProductoBuscable[]>;
  consultaInicial?: string;
  /** Los filtros por categoría, que van entre la caja y los resultados. */
  children?: React.ReactNode;
}) {
  const [consulta, setConsulta] = useState(consultaInicial);

  // Se pasa como array porque cruza la frontera servidor-cliente, y aquí se
  // vuelve conjunto: la lista se recorre una vez por tecla.
  const guardados = useMemo(() => new Set(favoritos), [favoritos]);

  /*
    Cada resultado viene con el producto que lo trajo, si fue un producto el que
    lo trajo. Buscar "molinillo" y recibir una lista de negocios sin decir cuál
    de ellos lo tiene obliga a entrar en todos para averiguarlo.

    El producto se busca uno por uno en vez de meter todos los nombres en la
    misma bolsa: la bolsa diría que hay coincidencia, pero no cuál.
  */
  const encontradas = useMemo(() => {
    return sucursales
      .map((sucursal) => {
        const productos = catalogo[sucursal.marca_id] ?? [];

        const porElNegocio = parecido(consulta, [
          sucursal.marcas?.nombre_comercial,
          sucursal.nombre_sucursal,
          sucursal.acerca_de,
          categorias[sucursal.marcas?.categoria_id ?? 0],
        ]);

        const producto = productos.find((p) => parecido(consulta, [p.nombre]));

        if (!porElNegocio && !producto) return null;

        // Si el negocio ya respondía por su nombre, no hace falta explicar qué
        // producto coincidió: la coincidencia ya se ve.
        return {
          sucursal,
          producto: porElNegocio ? null : (producto ?? null),
        };
      })
      .filter((r): r is Resultado => r !== null);
  }, [consulta, sucursales, categorias, catalogo]);

  const buscando = consulta.trim().length > 0;

  return (
    <>
      <form
        role="search"
        onSubmit={(evento) => {
          evento.preventDefault();
          // Cerrar el teclado es la acción de verdad: los resultados ya están.
          (evento.currentTarget.querySelector("input") as HTMLInputElement)?.blur();
        }}
        className="mt-5 flex gap-2"
      >
        <label className="min-w-0 flex-1">
          <span className="sr-only">Buscar un negocio o un producto</span>
          <input
            type="search"
            value={consulta}
            onChange={(evento) => setConsulta(evento.target.value)}
            placeholder="Un negocio, un museo, un molinillo…"
            autoComplete="off"
            className="min-h-14 w-full rounded-full border-2 border-selva/20 bg-white px-5 text-base text-ink placeholder:text-cacao/40 focus:border-selva"
          />
        </label>

        <button
          type="submit"
          className="min-h-14 shrink-0 rounded-full bg-selva px-6 font-bold text-crema shadow-dura-sm transition-transform active:translate-y-0.5"
        >
          Buscar
        </button>
      </form>

      {children}

      {buscando && (
        <p aria-live="polite" className="mt-3 text-cacao">
          {encontradas.length === 0
            ? "Ningún negocio se parece a lo que escribiste."
            : `${encontradas.length} ${
                encontradas.length === 1 ? "negocio encontrado" : "negocios encontrados"
              }.`}
        </p>
      )}

      {encontradas.length > 0 && (
        <div className="mt-6">
          {/*
            La `key` reinicia cuántas se ven cada vez que cambia la búsqueda: sin
            ella, quien destapó treinta negocios y luego escribe algo se
            encontraría con que los cinco resultados nuevos vienen ya "abiertos",
            y al borrar la búsqueda seguiría treinta abajo sin saber por qué.
          */}
          <VerMas
            key={consulta}
            className="grid gap-4 sm:grid-cols-2"
            etiqueta="Ver más negocios"
          >
            {encontradas.map(({ sucursal, producto }) => (
              <TarjetaSucursal
                key={sucursal.id}
                sucursal={sucursal}
                producto={producto}
                favorito={guardados.has(sucursal.id)}
                puedeGuardar={puedeGuardar}
                haySesion={haySesion}
              />
            ))}
          </VerMas>
        </div>
      )}
    </>
  );
}
