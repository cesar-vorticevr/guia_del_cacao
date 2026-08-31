"use client";

import { useEffect } from "react";
import { festejarPublicacion } from "@/components/negocio/avisos-de-monedas";

/**
 * Lanza el festejo al llegar a una publicación recién hecha.
 *
 * No se dispara desde el formulario porque ahí se pierde: publicar redirige a la
 * página de la publicación, y el festejo se iría con la pantalla que lo lanzó.
 * Por eso la acción marca la llegada con `?nueva=1` y se celebra aquí.
 */
export function CelebrarPublicacion() {
  useEffect(() => {
    festejarPublicacion();
  }, []);

  return null;
}
