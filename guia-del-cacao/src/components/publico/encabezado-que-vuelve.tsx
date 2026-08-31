"use client";

import { useEffect, useRef, useState } from "react";

/**
 * El encabezado se va al bajar y vuelve al subir.
 *
 * Bajando, el menú estorba: se quita para dejar la pantalla al contenido.
 * Subiendo, es justo lo que se está buscando — nadie sube dos dedos por gusto,
 * sube porque quiere volver a algo—, así que aparece anclado sin esperar a
 * llegar al tope.
 *
 * El umbral no es cero: con un solo píxel de diferencia el menú parpadearía con
 * el temblor del dedo o con el rebote del final de la página.
 */
const UMBRAL = 8;

/** Debajo de esto no se esconde nunca: es la cabecera de la página. */
const ZONA_ALTA = 80;

export function EncabezadoQueVuelve({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(true);
  const anterior = useRef(0);

  useEffect(() => {
    anterior.current = window.scrollY;

    const alMoverse = () => {
      const ahora = window.scrollY;
      const avance = ahora - anterior.current;

      if (Math.abs(avance) < UMBRAL) return;

      setVisible(ahora < ZONA_ALTA || avance < 0);
      anterior.current = ahora;
    };

    window.addEventListener("scroll", alMoverse, { passive: true });
    return () => window.removeEventListener("scroll", alMoverse);
  }, []);

  return (
    <div
      className={`sticky top-0 z-40 transition-transform duration-200 motion-reduce:transition-none ${
        visible ? "translate-y-0" : "-translate-y-full"
      }`}
    >
      {children}
    </div>
  );
}
