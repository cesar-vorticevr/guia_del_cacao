"use client";

import { useEffect, useRef } from "react";
import { pintarHoja } from "@/lib/hojas";

/*
  Los colores en RGB, para el lienzo: el canvas no lee variables de CSS, así
  que van repetidos aquí. Si cambia la paleta en `globals.css`, cambia aquí.

  Las luciérnagas son casi todas doradas; unas pocas salen turquesa, lima o
  guayaba, que es lo que las vuelve mágicas en vez de solo amarillas.
*/
const LUCES = [
  [255, 209, 102],
  [255, 209, 102],
  [255, 183, 3],
  [255, 236, 179],
  [18, 184, 172],
  [168, 217, 74],
  [255, 93, 115],
];

const VERDES = ["#106b46", "#2f8f5b", "#a8d94a", "#12b8ac", "#0c5236"];
const PETALOS = ["#ff5d73", "#ffb703", "#ff8fa0"];

/**
 * El cielo de la portada: selva de noche detrás de toda la página.
 *
 * Es el fondo de la portada entera, no solo de su primera pantalla: una banda
 * de orilla a orilla que va de arriba abajo, del violeta del cielo entre las
 * copas al verde casi negro del suelo. Dentro, un lienzo del alto de la
 * pantalla se queda pegado (`sticky`) mientras se baja, así que las luciérnagas
 * y las hojas acompañan todo el recorrido sin pintar un lienzo de cinco
 * pantallas de alto.
 *
 * Todo es lento a propósito: lo que se mueve rápido en la orilla de la vista
 * marea. Con «reducir movimiento» se pinta una vez y se queda quieto.
 *
 * Quien lo use debe ser `relative`. El recorte es `overflow-clip` y no
 * `overflow-hidden`: `hidden` volvería a la caja un contenedor de scroll y el
 * lienzo dejaría de pegarse.
 */
export function CieloMagico() {
  const lienzo = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = lienzo.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const quieto = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pocas = window.matchMedia("(max-width: 640px)").matches;

    let ancho = 0;
    let alto = 0;
    const ajustar = () => {
      const escala = Math.min(window.devicePixelRatio || 1, 2);
      ancho = canvas.clientWidth;
      alto = canvas.clientHeight;
      canvas.width = ancho * escala;
      canvas.height = alto * escala;
      ctx.setTransform(escala, 0, 0, escala, 0, 0);
    };
    ajustar();

    // Las luciérnagas vagan: cada una sigue una curva suave hecha de dos senos
    // con su propia fase, sin rumbo fijo ni velocidad que se note.
    const luciernagas = Array.from({ length: pocas ? 34 : 70 }, () => ({
      x: Math.random(),
      y: Math.random(),
      fase: Math.random() * Math.PI * 2,
      ritmo: 0.004 + Math.random() * 0.006,
      tam: 1 + Math.random() * 2,
      color: LUCES[Math.floor(Math.random() * LUCES.length)],
    }));

    // Hojas y pétalos que caen: bajan despacio, se mecen de lado y giran
    // sobre sí mismos. Al salir por abajo vuelven a entrar por arriba.
    const hojas = Array.from({ length: pocas ? 8 : 16 }, (_, i) => {
      const petalo = i % 4 === 0;
      return {
        x: Math.random(),
        y: Math.random(),
        cae: 0.00025 + Math.random() * 0.00035,
        vaiven: 18 + Math.random() * 30,
        fase: Math.random() * Math.PI * 2,
        giro: Math.random() * Math.PI * 2,
        gira: (Math.random() - 0.5) * 0.008,
        tam: petalo ? 5 + Math.random() * 4 : 9 + Math.random() * 10,
        color: petalo
          ? PETALOS[Math.floor(Math.random() * PETALOS.length)]
          : VERDES[Math.floor(Math.random() * VERDES.length)],
        petalo,
        alfa: 0.35 + Math.random() * 0.35,
      };
    });

    // El cursor atrae un poco a las luciérnagas cercanas, sin arrastrarlas.
    // El lienzo mide lo mismo que la pantalla, así que basta con la posición
    // del puntero en la ventana.
    const cursor = { x: -1, y: -1 };
    const alMover = (evento: PointerEvent) => {
      cursor.x = evento.clientX / window.innerWidth;
      cursor.y = evento.clientY / window.innerHeight;
    };

    let visible = true;
    let cuadro = 0;
    let t = 0;

    const pintar = () => {
      ctx.clearRect(0, 0, ancho, alto);

      for (const h of hojas) {
        if (!quieto) {
          h.y += h.cae;
          h.giro += h.gira;
          if (h.y > 1.08) {
            h.y = -0.08;
            h.x = Math.random();
          }
        }
        const x = h.x * ancho + Math.sin(t * 0.01 + h.fase) * h.vaiven;
        const y = h.y * alto;
        // El vaivén también inclina la hoja, como cuando cae de verdad.
        const inclinacion = h.giro + Math.sin(t * 0.01 + h.fase) * 0.5;
        ctx.globalAlpha = h.alfa;
        pintarHoja(ctx, x, y, h.tam, inclinacion, h.color, h.petalo);
      }
      ctx.globalAlpha = 1;

      ctx.globalCompositeOperation = "lighter";
      for (const l of luciernagas) {
        if (!quieto) {
          l.x += Math.sin(t * l.ritmo + l.fase) * 0.0004;
          l.y += Math.cos(t * l.ritmo * 0.8 + l.fase) * 0.0003 - 0.00006;
          if (cursor.x >= 0) {
            const dx = cursor.x - l.x;
            const dy = cursor.y - l.y;
            if (dx * dx + dy * dy < 0.04) {
              l.x += dx * 0.004;
              l.y += dy * 0.004;
            }
          }
          if (l.y < -0.05) l.y = 1.05;
          if (l.x < -0.05) l.x = 1.05;
          if (l.x > 1.05) l.x = -0.05;
        }
        const x = l.x * ancho;
        const y = l.y * alto;
        // Laten despacio, cada una a su tiempo: encender y apagar en unos
        // cuatro segundos se lee como respiración, no como parpadeo.
        const brillo = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(t * 0.025 + l.fase));
        const [r, g, b] = l.color;
        const halo = ctx.createRadialGradient(x, y, 0, x, y, l.tam * 7);
        halo.addColorStop(0, `rgba(${r},${g},${b},${brillo * 0.55})`);
        halo.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(x, y, l.tam * 7, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `rgba(255,250,230,${brillo})`;
        ctx.beginPath();
        ctx.arc(x, y, l.tam * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";

      t += 1;
      if (!quieto && visible) cuadro = requestAnimationFrame(pintar);
    };

    // Con la pestaña oculta no se pinta nada.
    const alCambiarVista = () => {
      visible = document.visibilityState === "visible";
      cancelAnimationFrame(cuadro);
      if (visible && !quieto) cuadro = requestAnimationFrame(pintar);
    };

    const medida = new ResizeObserver(() => {
      ajustar();
      if (quieto) pintar();
    });
    medida.observe(canvas);

    document.addEventListener("visibilitychange", alCambiarVista);
    if (!quieto) window.addEventListener("pointermove", alMover, { passive: true });
    pintar();

    return () => {
      cancelAnimationFrame(cuadro);
      medida.disconnect();
      document.removeEventListener("visibilitychange", alCambiarVista);
      window.removeEventListener("pointermove", alMover);
    };
  }, []);

  return (
    <div
      aria-hidden
      className="cielo-magico pointer-events-none absolute -top-16 -z-10 bottom-0 left-1/2 w-[104vw] -translate-x-1/2 overflow-clip"
    >
      <div className="escenario-aurora sticky top-0 -mb-[100vh] h-screen" />
      <canvas ref={lienzo} className="sticky top-0 block h-screen w-full" />
      {/* El suelo: funde el cielo con el pie de página, sin costura. */}
      <div className="absolute inset-x-0 bottom-0 h-72 bg-gradient-to-b from-transparent to-[#08150f]" />
    </div>
  );
}
