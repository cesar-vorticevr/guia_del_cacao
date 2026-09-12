"use client";

import { useState } from "react";
import { VisorDeFotos } from "@/components/publico/visor-de-fotos";
import { pesos } from "@/lib/tipos";

export type ProductoDelCatalogo = {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio: number | null;
  /** URL ya armada, o null si no tiene foto. */
  foto: string | null;
};

/**
 * El catálogo del micrositio, como el de una tienda en línea.
 *
 * Antes era una lista de renglones con una miniatura de 64 px: un negocio con
 * quince productos ocupaba tres pantallas y la foto no se veía. Ahora es una
 * cuadrícula con la foto arriba, que es como se mira un catálogo — de reojo,
 * saltando de imagen en imagen, y leyendo solo la que engancha.
 *
 * **Aquí el precio sí va.** En el directorio se quitó porque poner en fila el
 * mismo molinillo de cinco negocios lo convierte en un comparador donde gana el
 * más barato. Dentro de un micrositio no hay con quién comparar: son los
 * productos de un solo negocio, y el precio es lo que alguien viene a saber
 * antes de ir hasta allá.
 *
 * Las fotos se abren a pantalla completa, con el mismo visor que la galería y
 * la portada: es la única forma de ver un producto en grande, porque no tienen
 * página propia.
 */
export function CatalogoPublico({
  productos,
}: {
  productos: ProductoDelCatalogo[];
}) {
  const [abierta, setAbierta] = useState<number | null>(null);

  // Solo los que tienen foto entran al visor, y se guarda a qué producto
  // corresponde cada índice: si se pasaran todos, las flechas caerían en huecos
  // vacíos entre foto y foto.
  const conFoto = productos.filter((p) => p.foto);
  const fotos = conFoto.map((p) => p.foto as string);
  const indiceEnElVisor = (id: string) => conFoto.findIndex((p) => p.id === id);

  return (
    <>
      <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {productos.map((producto) => (
          <li
            key={producto.id}
            className="flex flex-col overflow-hidden rounded-2xl border-2 border-ink/10 bg-white shadow-dura"
          >
            {/*
              La foto va absoluta dentro de una caja cuadrada, no en el flujo:
              con `h-full` en el flujo una foto alta estira su caja y las
              tarjetas de la fila dejan de alinearse. Cuadrada y no 4:3 porque
              un producto suele estar centrado en su foto, y el cuadro es lo que
              más se le parece a la retícula de un catálogo.
            */}
            {producto.foto ? (
              <button
                type="button"
                onClick={() => setAbierta(indiceEnElVisor(producto.id))}
                aria-label={`Ver ${producto.nombre} en grande`}
                className="group relative block aspect-square w-full shrink-0 overflow-hidden bg-crema-2"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={producto.foto}
                  alt={producto.nombre}
                  loading="lazy"
                  className="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </button>
            ) : (
              <span
                aria-hidden="true"
                className="grid aspect-square w-full shrink-0 place-items-center bg-crema-2 font-display text-3xl text-selva/40"
              >
                {producto.nombre.charAt(0)}
              </span>
            )}

            <span className="flex flex-1 flex-col gap-0.5 p-3">
              <span className="font-bold leading-tight text-selva-2">
                {producto.nombre}
              </span>

              {producto.descripcion && (
                <span className="line-clamp-2 text-sm text-cacao">
                  {producto.descripcion}
                </span>
              )}

              {/*
                El precio pegado al fondo con `mt-auto`: así queda a la misma
                altura en toda la fila aunque unas descripciones ocupen dos
                renglones y otras ninguno.
              */}
              {producto.precio !== null && (
                <span className="mt-auto pt-1.5 font-mono font-bold text-selva">
                  {pesos(producto.precio)}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>

      <VisorDeFotos fotos={fotos} abierta={abierta} alCambiar={setAbierta} />
    </>
  );
}
