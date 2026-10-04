"use client";

import { useEffect, useState } from "react";
import { LluviaDeMazorcas } from "@/components/lluvia-de-mazorcas";

/** Cuánto se queda el festejo antes de irse solo. */
const DURA = 4200;

/**
 * El festejo al llegar a una publicación recién hecha.
 *
 * No se lanza desde el formulario porque ahí se pierde: publicar redirige a la
 * página de la publicación, y el festejo se iría con la pantalla que lo lanzó.
 * Por eso la acción marca la llegada con `?nueva=1` y se celebra aquí.
 *
 * **Y se pinta aquí, que es lo que antes no pasaba.** Esto lanzaba un evento
 * por el canal de los avisos de mazorcas y confiaba en que alguien lo
 * escuchara; `AvisosDeMonedas`, el único que escucha, está montado en la
 * página de cupones y en el panel del negocio, no en esta. Así que el evento
 * salía al vacío: se publicaba, la pantalla no decía nada, y desde fuera
 * parecía que el festejo no existía. Existía y nunca se vio.
 *
 * Sin intermediario no hay nada que montar en otro sitio ni que recordar al
 * añadir una página. La lluvia sí se comparte —es de marca— pero por
 * importación, no por un evento suelto en `window`.
 */
export function CelebrarPublicacion() {
  const [puesto, setPuesto] = useState(true);

  useEffect(() => {
    const reloj = setTimeout(() => setPuesto(false), DURA);
    return () => clearTimeout(reloj);
  }, []);

  if (!puesto) return null;

  return (
    <div
      /*
        Se cierra al tocar en cualquier parte: debajo está la publicación que
        se acaba de hacer, que es justo lo que se quiere mirar. Esperar cuatro
        segundos a que se vaya sola sería celebrar a costa de quien celebra.
      */
      onClick={() => setPuesto(false)}
      className="fixed inset-0 z-50 grid place-items-center overflow-hidden bg-ink/45 p-6"
    >
      <LluviaDeMazorcas />

      <div
        role="status"
        className="relative w-full max-w-md animate-brinca rounded-3xl border-4 border-mango bg-crema p-8 text-center shadow-dura-alta"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/marca/mazorca.png"
          alt=""
          className="mx-auto size-20 animate-late"
        />

        <p className="mt-3 font-display text-3xl font-semibold text-selva-2">
          ¡Ya está publicado!
        </p>

        <p className="mt-3 text-cacao">
          Ya está en el muro de la comunidad, con tus fotos en el orden que
          elegiste.
        </p>

        <p className="mt-5 text-sm text-cacao/70">Toca para verlo</p>
      </div>
    </div>
  );
}
