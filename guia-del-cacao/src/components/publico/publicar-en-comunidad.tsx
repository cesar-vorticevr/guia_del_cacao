"use client";

import { useState } from "react";

/**
 * Publicar noticia o evento, plegado tras un botón y con las dos en pestañas.
 *
 * Van juntas porque desde fuera son la misma decisión —"quiero contar algo"— y
 * lo único que cambia es si tiene fecha. Separadas en dos pantallas, publicar
 * una noticia obligaba a pasar por la lista de eventos.
 *
 * Empieza cerrado: quien entra a la comunidad viene a leer, y un formulario en
 * blanco abierto era lo primero que se encontraba sin haberlo pedido.
 */
export function PublicarEnComunidad({
  noticia,
  evento,
}: {
  noticia: React.ReactNode;
  evento: React.ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);
  const [clase, setClase] = useState<"noticia" | "evento">("noticia");

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="min-h-12 w-fit rounded-full bg-selva px-6 font-bold text-crema shadow-dura-sm transition-transform active:translate-y-0.5"
      >
        Publicar algo
      </button>
    );
  }

  return (
    <section className="grid gap-4 rounded-3xl bg-crema-2 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Qué publicar" className="flex gap-2">
          {(["noticia", "evento"] as const).map((opcion) => (
            <button
              key={opcion}
              type="button"
              role="tab"
              aria-selected={clase === opcion}
              onClick={() => setClase(opcion)}
              className={`min-h-11 rounded-full px-5 font-bold transition-colors ${
                clase === opcion
                  ? "bg-selva text-crema"
                  : "border-2 border-selva/25 bg-white text-selva-2"
              }`}
            >
              {opcion === "noticia" ? "Una noticia" : "Un evento"}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="text-sm font-bold text-cacao/70 underline underline-offset-4 hover:text-cacao"
        >
          Cerrar
        </button>
      </div>

      <p className="text-cacao">
        {clase === "noticia"
          ? "Se ve en tu micrositio los primeros 30 días y se queda para siempre en la comunidad."
          : "Sale en la agenda de eventos y en el muro, hasta que pase la fecha."}
      </p>

      {/*
        Los dos formularios se montan y se esconde el que no toca, en vez de
        desmontarlo: cambiar de pestaña a media redacción no debería borrar lo
        que ya se escribió.
      */}
      <div hidden={clase !== "noticia"}>{noticia}</div>
      <div hidden={clase !== "evento"}>{evento}</div>
    </section>
  );
}
