"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { anotar, esTipoDeActividad, type Anotacion } from "@/lib/actividad";

/**
 * Las dos piezas que miden la guía (migración 000052).
 *
 * `MedirSitio` va una vez en el layout público y hace dos cosas: anota cada
 * página que se abre y escucha los clics de toda la página. Un botón se mide
 * poniéndole `data-medir="whatsapp"` (y `data-sucursal`, `data-detalle` si
 * hace falta), sin convertirlo en componente de cliente: la mayoría viven en
 * páginas del servidor, y un atributo no obliga a cambiar eso.
 */
export function MedirSitio() {
  const ruta = usePathname();
  const ultima = useRef<string | null>(null);

  useEffect(() => {
    // StrictMode monta dos veces en desarrollo: sin esto, cada visita contaría
    // doble.
    if (ultima.current === ruta) return;
    ultima.current = ruta;
    anotar({ tipo: "vista_pagina", detalle: ruta });
  }, [ruta]);

  useEffect(() => {
    function alPulsar(evento: MouseEvent) {
      const objetivo = evento.target;
      if (!(objetivo instanceof Element)) return;

      const marcado = objetivo.closest<HTMLElement>("[data-medir]");
      const tipo = marcado?.dataset.medir;
      if (!marcado || !esTipoDeActividad(tipo)) return;

      anotar({
        tipo,
        sucursal: marcado.dataset.sucursal,
        evento: marcado.dataset.evento,
        detalle: marcado.dataset.detalle,
      });
    }

    // En la fase de captura: varios botones paran la propagación para no
    // navegar la tarjeta que los contiene, y en la de burbuja no llegarían.
    document.addEventListener("click", alPulsar, true);
    return () => document.removeEventListener("click", alPulsar, true);
  }, []);

  return null;
}

/**
 * Anota algo una vez al pintar: la visita a un micrositio o a un evento, una
 * búsqueda. Una sola vez por pestaña para la misma cosa, para que recargar o
 * volver atrás no infle la cuenta.
 */
export function Medir(anotacion: Anotacion) {
  const { tipo, sucursal, evento, detalle } = anotacion;

  useEffect(() => {
    const clave = `medido:${tipo}:${sucursal ?? ""}:${evento ?? ""}:${detalle ?? ""}`;

    try {
      if (sessionStorage.getItem(clave)) return;
      sessionStorage.setItem(clave, "1");
    } catch {
      // Sin almacenamiento (modo privado estricto) se anota igual.
    }

    anotar({ tipo, sucursal, evento, detalle });
  }, [tipo, sucursal, evento, detalle]);

  return null;
}
