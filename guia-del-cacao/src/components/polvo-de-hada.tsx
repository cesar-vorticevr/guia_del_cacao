"use client";

import { useEffect, useRef } from "react";
import { pintarHoja } from "@/lib/hojas";

const COLORES = ["#ffd166", "#ffb703", "#ff5d73", "#12b8ac", "#a8d94a", "#fff3c4"];
const VERDES = ["#2f8f5b", "#a8d94a", "#12b8ac"];
/** Del grano recién fermentado al tostado: no todas las semillas son iguales. */
const CAFES = [
  ["#a8603a", "#5a2a14"],
  ["#8a4a24", "#4a2412"],
  ["#b8743f", "#6b3417"],
] as const;

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
  clase: "estrella" | "hoja" | "semilla" | "onda" | "destello";
  /** Para la semilla: su par de cafés (claro, oscuro). */
  tono?: readonly [string, string];
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
 * Una semilla de cacao: un grano ovalado, con su degradado de café y la
 * hendidura clara a lo largo, como se ve al abrir la mazorca.
 */
function semilla(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  tam: number,
  giro: number,
  [claro, oscuro]: readonly [string, string],
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(giro);

  const relleno = ctx.createRadialGradient(-tam * 0.3, -tam * 0.25, tam * 0.1, 0, 0, tam);
  relleno.addColorStop(0, claro);
  relleno.addColorStop(1, oscuro);
  ctx.fillStyle = relleno;
  ctx.beginPath();
  ctx.ellipse(0, 0, tam, tam * 0.62, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgb(255 220 180 / 0.55)";
  ctx.lineWidth = Math.max(1, tam * 0.12);
  ctx.beginPath();
  ctx.moveTo(-tam * 0.7, 0);
  ctx.quadraticCurveTo(0, tam * 0.18, tam * 0.7, 0);
  ctx.stroke();

  ctx.fillStyle = "rgb(255 255 255 / 0.35)";
  ctx.beginPath();
  ctx.ellipse(-tam * 0.35, -tam * 0.25, tam * 0.22, tam * 0.1, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * La explosión de cacao al hacer clic, en todo el sitio.
 *
 * Cada clic revienta como una mazorca mágica: un destello dorado en el punto,
 * una onda de luz que se abre, **semillas de cacao** que salen disparadas
 * girando y caen con su peso, y estrellitas y un par de hojas que flotan hacia
 * arriba. Todo se apaga en un segundo. Va con el cursor de mazorca de
 * `globals.css`.
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
        const avance = m.vida / m.dura;

        if (m.clase === "onda") {
          // El anillo de luz que se abre desde el clic.
          ctx.globalAlpha = (1 - avance) * 0.9;
          ctx.strokeStyle = m.color;
          ctx.lineWidth = 3 * (1 - avance) + 0.5;
          ctx.shadowColor = m.color;
          ctx.shadowBlur = 14;
          ctx.beginPath();
          ctx.arc(m.x, m.y, m.tam * (0.2 + avance * 1.2), 0, Math.PI * 2);
          ctx.stroke();
          ctx.shadowBlur = 0;
          continue;
        }

        if (m.clase === "destello") {
          // El fogonazo del centro: grande y blanco al principio, se apaga rápido.
          const brillo = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.tam * (0.6 + avance));
          brillo.addColorStop(0, `rgb(255 247 220 / ${0.95 * (1 - avance)})`);
          brillo.addColorStop(0.4, `rgb(255 209 102 / ${0.6 * (1 - avance)})`);
          brillo.addColorStop(1, "rgb(255 183 3 / 0)");
          ctx.globalAlpha = 1;
          ctx.fillStyle = brillo;
          ctx.beginPath();
          ctx.arc(m.x, m.y, m.tam * (0.6 + avance), 0, Math.PI * 2);
          ctx.fill();
          continue;
        }

        m.x += m.vx;
        m.y += m.vy;
        m.giro += m.gira;

        if (m.clase === "semilla") {
          // Las semillas pesan: salen disparadas, frenan un poco y caen.
          m.vx *= 0.97;
          m.vy = m.vy * 0.97 + 0.28;
          ctx.globalAlpha = avance < 0.7 ? 1 : 1 - (avance - 0.7) / 0.3;
          ctx.shadowColor = "rgb(255 209 102 / 0.35)";
          ctx.shadowBlur = 3;
          semilla(ctx, m.x, m.y, m.tam, m.giro, m.tono!);
          ctx.shadowBlur = 0;
          continue;
        }

        // Estrellas y hojas frenan y luego flotan hacia arriba: es polvo, no
        // confeti.
        m.vx *= 0.94;
        m.vy = m.vy * 0.94 - 0.03;
        ctx.globalAlpha = 1 - avance * avance;
        if (m.clase === "hoja") {
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
      const x = evento.clientX;
      const y = evento.clientY;
      const azar = Math.random;

      motas.push(
        { x, y, vx: 0, vy: 0, vida: 0, dura: 16, tam: 34, giro: 0, gira: 0, color: "#fff", clase: "destello" },
        { x, y, vx: 0, vy: 0, vida: 0, dura: 26, tam: 46, giro: 0, gira: 0, color: "#ffd166", clase: "onda" },
        { x, y, vx: 0, vy: 0, vida: 0, dura: 34, tam: 62, giro: 0, gira: 0, color: "#ff8f3d", clase: "onda" },
      );

      // Las semillas: un abanico parejo con algo de azar, para que no salgan en fila.
      const semillas = 9;
      for (let i = 0; i < semillas; i++) {
        const angulo = (i / semillas) * Math.PI * 2 + (azar() - 0.5) * 0.5;
        const fuerza = 4 + azar() * 3.5;
        motas.push({
          x,
          y,
          vx: Math.cos(angulo) * fuerza,
          vy: Math.sin(angulo) * fuerza - 3,
          vida: 0,
          dura: 50 + azar() * 20,
          tam: 7 + azar() * 4,
          giro: azar() * Math.PI,
          gira: (azar() - 0.5) * 0.35,
          color: "",
          clase: "semilla",
          tono: CAFES[Math.floor(azar() * CAFES.length)],
        });
      }

      for (let i = 0; i < 12; i++) {
        const hoja = i < 2;
        const angulo = azar() * Math.PI * 2;
        const fuerza = 1.5 + azar() * 3;
        motas.push({
          x,
          y,
          vx: Math.cos(angulo) * fuerza,
          vy: Math.sin(angulo) * fuerza - 0.8,
          vida: 0,
          dura: 40 + azar() * 25,
          tam: hoja ? 6 + azar() * 3 : 4 + azar() * 5,
          giro: azar() * Math.PI,
          gira: (azar() - 0.5) * 0.15,
          color: hoja
            ? VERDES[Math.floor(azar() * VERDES.length)]
            : COLORES[Math.floor(azar() * COLORES.length)],
          clase: hoja ? "hoja" : "estrella",
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
