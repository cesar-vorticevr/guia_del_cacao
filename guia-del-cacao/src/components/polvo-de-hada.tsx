"use client";

import { useEffect, useRef } from "react";
import { pintarHoja } from "@/lib/hojas";

const COLORES = ["#ffd166", "#ffb703", "#ff5d73", "#12b8ac", "#a8d94a", "#fff3c4"];
const VERDES = ["#2f8f5b", "#a8d94a", "#12b8ac"];

type Mota = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  vida: number;
  dura: number;
  tam: number;
  giro: number;
  gira: number;
  color: string;
  hoja: boolean;
};

/** Una estrella de cuatro puntas, el destello clásico del polvo de hada. */
function estrella(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, giro: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(giro);
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    ctx.rotate(Math.PI / 2);
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(r * 0.18, r * 0.18, 0, r);
    ctx.quadraticCurveTo(-r * 0.18, r * 0.18, 0, 0);
  }
  ctx.fill();
  ctx.restore();
}

/**
 * Polvo de hada al hacer clic, en todo el sitio.
 *
 * Cada clic suelta una docena de estrellitas de colores y un par de hojas que
 * se abren, flotan hacia arriba y se apagan en menos de un segundo. Es el
 * mismo cuento que el escenario de la portada, llevado a cada pantalla.
 *
 * Un solo lienzo fijo encima de todo, que no recibe clics
 * (`pointer-events-none`), así que nunca le quita uno a un botón. Solo anima
 * mientras quedan motas: sin clics, no gasta nada.
 *
 * Con «reducir movimiento» no se monta.
 */
export function PolvoDeHada() {
  const lienzo = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = lienzo.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const motas: Mota[] = [];
    let cuadro = 0;

    const ajustar = () => {
      const escala = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * escala;
      canvas.height = window.innerHeight * escala;
      ctx.setTransform(escala, 0, 0, escala, 0, 0);
    };
    ajustar();

    const pintar = () => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      for (let i = motas.length - 1; i >= 0; i--) {
        const m = motas[i];
        m.vida += 1;
        if (m.vida > m.dura) {
          motas.splice(i, 1);
          continue;
        }
        m.x += m.vx;
        m.y += m.vy;
        m.vx *= 0.94;
        // Frenan y luego flotan hacia arriba, en vez de caer: es polvo, no
        // confeti.
        m.vy = m.vy * 0.94 - 0.03;
        m.giro += m.gira;

        const avance = m.vida / m.dura;
        ctx.globalAlpha = 1 - avance * avance;
        if (m.hoja) {
          pintarHoja(ctx, m.x, m.y, m.tam, m.giro, m.color);
        } else {
          ctx.fillStyle = m.color;
          ctx.shadowColor = m.color;
          ctx.shadowBlur = 8;
          estrella(ctx, m.x, m.y, m.tam * (1 - avance * 0.5), m.giro);
          ctx.shadowBlur = 0;
        }
      }
      ctx.globalAlpha = 1;
      cuadro = motas.length > 0 ? requestAnimationFrame(pintar) : 0;
    };

    const alTocar = (evento: PointerEvent) => {
      if (evento.button !== 0) return;
      for (let i = 0; i < 14; i++) {
        const hoja = i < 2;
        const angulo = Math.random() * Math.PI * 2;
        const fuerza = 1.5 + Math.random() * 3;
        motas.push({
          x: evento.clientX,
          y: evento.clientY,
          vx: Math.cos(angulo) * fuerza,
          vy: Math.sin(angulo) * fuerza - 0.8,
          vida: 0,
          dura: 40 + Math.random() * 25,
          tam: hoja ? 6 + Math.random() * 3 : 4 + Math.random() * 5,
          giro: Math.random() * Math.PI,
          gira: (Math.random() - 0.5) * 0.15,
          color: hoja
            ? VERDES[Math.floor(Math.random() * VERDES.length)]
            : COLORES[Math.floor(Math.random() * COLORES.length)],
          hoja,
        });
      }
      if (!cuadro) cuadro = requestAnimationFrame(pintar);
    };

    window.addEventListener("pointerdown", alTocar, { passive: true });
    window.addEventListener("resize", ajustar);
    return () => {
      cancelAnimationFrame(cuadro);
      window.removeEventListener("pointerdown", alTocar);
      window.removeEventListener("resize", ajustar);
    };
  }, []);

  return (
    <canvas
      ref={lienzo}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[100] size-full"
    />
  );
}
