"use client";

import { Children, useState } from "react";

/**
 * Enseña los primeros de una lista y va destapando el resto de tanda en tanda.
 *
 * Existe porque las listas estaban completas pero eran inabarcables: el
 * directorio medía seis pantallas de alto y el muro de la comunidad casi diez.
 * Nada faltaba, pero no había forma de hacerse una idea del conjunto sin
 * arrastrar el dedo una docena de veces.
 *
 * Es destapar, no paginar: lo ya visto se queda arriba. Con páginas numeradas
 * habría que volver atrás para comparar dos negocios que cayeron en tandas
 * distintas, y comparar es justo lo que se viene a hacer a un directorio.
 *
 * Recibe los renglones como `children` en vez de una lista de datos, así sirve
 * igual para tarjetas de negocio, entradas del muro o temas del foro: cada
 * lista sigue pintando lo suyo como quiera.
 */
export function VerMas({
  children,
  inicial = 8,
  paso = 8,
  etiqueta = "Ver más",
  className,
}: {
  children: React.ReactNode;
  /** Cuántos se ven de entrada. */
  inicial?: number;
  /** Cuántos se suman con cada toque. */
  paso?: number;
  /** El texto del botón, en plural y en el idioma de la lista. */
  etiqueta?: string;
  /** Clases del `<ul>` que envuelve los renglones. */
  className?: string;
}) {
  const todos = Children.toArray(children);
  const [visibles, setVisibles] = useState(inicial);

  const quedan = todos.length - visibles;

  return (
    <>
      <ul className={className}>{todos.slice(0, visibles)}</ul>

      {quedan > 0 && (
        <div className="mt-6 grid justify-items-center gap-2">
          <button
            type="button"
            onClick={() => setVisibles((v) => v + paso)}
            className="min-h-12 rounded-full border-2 border-selva/25 bg-white px-7 font-bold text-selva-2 shadow-dura-sm transition-transform active:translate-y-0.5"
          >
            {etiqueta} ({quedan})
          </button>

          {/* Decir cuántos van de cuántos evita la sensación de pozo sin fondo:
              con el número a la vista se sabe si vale la pena seguir. */}
          <p aria-live="polite" className="font-mono text-sm text-cacao/70">
            {visibles} de {todos.length}
          </p>
        </div>
      )}
    </>
  );
}
