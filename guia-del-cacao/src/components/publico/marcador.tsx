"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Un número que corre hasta su valor, como el marcador de una máquina: de cero
 * al total en poco más de un segundo, frenando al final.
 *
 * Arranca cuando entra en pantalla, no al cargar: si estaba abajo del pliegue,
 * la gracia se perdía sin que nadie la viera. En el servidor (y con «reducir
 * movimiento») se pinta el número final, así que sin JavaScript se lee igual.
 */
export function Marcador({ valor }: { valor: number }) {
  const [mostrado, setMostrado] = useState(valor);
  const nodo = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = nodo.current;
    if (!el || valor === 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let cuadro = 0;
    const vigia = new IntersectionObserver(([entrada]) => {
      if (!entrada.isIntersecting) return;
      vigia.disconnect();
      const inicio = performance.now();
      const dura = 1400;
      const paso = (ahora: number) => {
        const avance = Math.min((ahora - inicio) / dura, 1);
        const frenado = 1 - (1 - avance) ** 4;
        setMostrado(Math.round(valor * frenado));
        if (avance < 1) cuadro = requestAnimationFrame(paso);
      };
      setMostrado(0);
      cuadro = requestAnimationFrame(paso);
    });
    vigia.observe(el);

    return () => {
      vigia.disconnect();
      cancelAnimationFrame(cuadro);
    };
  }, [valor]);

  return (
    <span ref={nodo} className="tabular-nums">
      {mostrado}
    </span>
  );
}
