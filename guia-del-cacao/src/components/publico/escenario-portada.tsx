"use client";

import Image from "next/image";
import { useRef } from "react";

/*
  Las piezas que flotan alrededor del título. Posiciones a mano, igual que la
  lluvia de mazorcas: con `Math.random()` el servidor y el navegador pintarían
  cosas distintas. `prof` es cuánto se mueven con el cursor — las grandes, que
  se leen más cerca, se mueven más.
*/
const PIEZAS = [
  { archivo: "mazorca-amarilla.png", clase: "left-[2%] top-[18%] w-20 sm:w-32", prof: 28, tarda: 0, gira: -14 },
  { archivo: "mazorca-rosa.png", clase: "right-[3%] top-[14%] w-16 sm:w-28", prof: 22, tarda: 1.2, gira: 12 },
  { archivo: "granos-de-cacao.png", clase: "left-[8%] bottom-[10%] w-16 sm:w-24", prof: 16, tarda: 0.6, gira: 8 },
  { archivo: "flores-de-cacao.png", clase: "right-[7%] bottom-[14%] w-16 sm:w-28", prof: 18, tarda: 1.8, gira: -10 },
];

/**
 * La primera pantalla de la portada: el claro de la selva.
 *
 * El fondo —el cielo de noche, las luciérnagas y las hojas— no es de aquí: es
 * de `CieloMagico`, que va detrás de la portada entera. Esto pone encima el
 * claro de luz donde va el título y las mazorcas flotando, que se mueven un
 * poco con el cursor.
 *
 * Sube por debajo de la barra de arriba (`-mt-16`), que es de cristal: así la
 * barra se funde con la selva en vez de ser una franja aparte.
 *
 * La sección no recorta (`overflow-hidden`) a propósito: las sugerencias del
 * buscador cuelgan por debajo y tienen que poder salirse. Lo que se recorta es
 * la capa decorativa, que vive en su propia caja.
 */
export function EscenarioDePortada({ children }: { children: React.ReactNode }) {
  const escenario = useRef<HTMLElement>(null);

  return (
    <section
      ref={escenario}
      onPointerMove={(evento) => {
        const caja = escenario.current;
        if (!caja) return;
        const r = caja.getBoundingClientRect();
        caja.style.setProperty("--mx", String((evento.clientX - r.left) / r.width - 0.5));
        caja.style.setProperty("--my", String((evento.clientY - r.top) / r.height - 0.5));
      }}
      className="escenario relative left-1/2 z-20 -mt-16 w-[104vw] -translate-x-1/2 text-center text-crema"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {PIEZAS.map((pieza, i) => (
          <div
            key={i}
            className={`absolute ${pieza.clase} motion-reduce:!transform-none`}
            style={{
              transform: `translate(calc(var(--mx, 0) * ${pieza.prof}px), calc(var(--my, 0) * ${pieza.prof}px))`,
              transition: "transform 1.2s ease-out",
            }}
          >
            <Image
              src={`/parallax/${pieza.archivo}`}
              alt=""
              width={240}
              height={240}
              sizes="128px"
              className="h-auto w-full animate-flota drop-shadow-[0_0_22px_rgba(255,209,102,0.35)]"
              style={
                {
                  animationDelay: `${pieza.tarda}s`,
                  "--gira": `${pieza.gira}deg`,
                } as React.CSSProperties
              }
            />
          </div>
        ))}
      </div>

      <div className="relative mx-auto w-[92vw] max-w-[1180px] px-2 pb-16 pt-28 sm:pb-20 sm:pt-32">
        {children}
      </div>
    </section>
  );
}
