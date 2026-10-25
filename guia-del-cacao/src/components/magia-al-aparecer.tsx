"use client";

import { useEffect } from "react";

/** Cuánto espera cada tarjeta a la anterior de su fila al aparecer. */
const ESCALON_MS = 90;

/**
 * Las tarjetas aparecen con magia al hacer scroll, en todo el sitio.
 *
 * No hay que envolver nada: basta con que una tarjeta lleve la clase
 * `tarjeta-magica`. Esto pone `magia` en el <html> —que es lo que las esconde
 * mientras no se ven— y les añade `aparecida` cuando entran en pantalla. Las
 * que llegan después (una página nueva, «ver más», un filtro) las encuentra un
 * `MutationObserver`, así que también aparecen.
 *
 * Las de una misma fila salen en escalera, una tras otra, contando su lugar
 * entre sus hermanas. El retraso se quita en cuanto terminan de aparecer: si
 * se quedara, el brillo al pasar el cursor también llegaría tarde.
 *
 * Con «reducir movimiento» no hace nada y las tarjetas se ven desde el inicio.
 */
export function MagiaAlAparecer() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const raiz = document.documentElement;
    const vistas = new WeakSet<Element>();

    const vigia = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          if (!entrada.isIntersecting) continue;
          const tarjeta = entrada.target as HTMLElement;
          vigia.unobserve(tarjeta);

          const lugar = Array.prototype.indexOf.call(
            tarjeta.parentElement?.children ?? [],
            tarjeta,
          );
          const retraso = (Math.max(lugar, 0) % 4) * ESCALON_MS;

          tarjeta.style.transitionDelay = `${retraso}ms`;
          tarjeta.style.animationDelay = `${retraso}ms`;
          tarjeta.classList.add("aparecida");
          window.setTimeout(() => {
            tarjeta.style.transitionDelay = "";
          }, retraso + 900);
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );

    const buscar = () => {
      for (const tarjeta of document.querySelectorAll(".tarjeta-magica")) {
        if (vistas.has(tarjeta)) continue;
        vistas.add(tarjeta);
        vigia.observe(tarjeta);
      }
    };

    raiz.classList.add("magia");
    buscar();

    const cambios = new MutationObserver(buscar);
    cambios.observe(document.body, { childList: true, subtree: true });

    return () => {
      raiz.classList.remove("magia");
      vigia.disconnect();
      cambios.disconnect();
    };
  }, []);

  return null;
}
