"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Aviso } from "@/components/formulario";
import { enviarMensaje, type EstadoBuzon } from "@/lib/buzon/acciones";
import { LARGO_DE_MENSAJE } from "@/lib/buzon/textos";

const INICIAL: EstadoBuzon = {};

/**
 * La caja para escribir, al pie de la conversación.
 *
 * Enter manda y Mayús+Enter baja de renglón, como en cualquier chat. Si el
 * envío falla, el texto vuelve a la caja: la acción lo devuelve y la caja se
 * monta de nuevo con él (la `key` cambia en el render, no en un efecto; ver
 * «Un formulario que falla no se vacía» en AGENTS.md).
 */
export function EscribirMensaje({ conversacionId }: { conversacionId: string }) {
  const [estado, accion, enviando] = useActionState(enviarMensaje, INICIAL);
  const [vuelta, setVuelta] = useState(0);
  const [ultimo, setUltimo] = useState(estado);
  const formulario = useRef<HTMLFormElement>(null);

  if (estado !== ultimo) {
    setUltimo(estado);
    setVuelta((v) => v + 1);
  }

  // El foco vuelve a la caja después de mandar, para seguir escribiendo.
  useEffect(() => {
    formulario.current?.querySelector("textarea")?.focus();
  }, [vuelta]);

  return (
    <form
      ref={formulario}
      action={accion}
      className="sticky bottom-20 grid gap-2 rounded-3xl border-2 border-mango/30 bg-white p-3 shadow-[0_0_40px_rgb(255_183_3/0.12)] sm:bottom-4"
    >
      <input type="hidden" name="conversacion_id" value={conversacionId} />
      {estado.error && <Aviso>{estado.error}</Aviso>}

      <div className="flex items-end gap-2">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Tu mensaje</span>
          <textarea
            key={vuelta}
            name="texto"
            rows={2}
            required
            maxLength={LARGO_DE_MENSAJE}
            defaultValue={estado.error ? estado.texto : ""}
            placeholder="Escribe tu mensaje…"
            onKeyDown={(evento) => {
              if (evento.key === "Enter" && !evento.shiftKey && !evento.nativeEvent.isComposing) {
                evento.preventDefault();
                evento.currentTarget.form?.requestSubmit();
              }
            }}
            className="max-h-48 w-full resize-y rounded-2xl border-2 border-selva/20 bg-white px-4 py-2.5 text-base text-ink focus:border-selva"
          />
        </label>

        <button
          type="submit"
          disabled={enviando}
          className="boton-oro brillo min-h-12 shrink-0 rounded-full px-5 font-display text-lg font-semibold text-ink disabled:opacity-60"
        >
          {enviando ? "…" : "Enviar"}
        </button>
      </div>

      <p className="px-1 text-xs text-cacao/60">
        Enter manda · Mayús + Enter baja de renglón · Lo que se escribe aquí no se borra.
      </p>
    </form>
  );
}

/**
 * Vuelve a pedir la conversación cada tanto mientras la pestaña está a la
 * vista, para que la respuesta aparezca sin recargar. No hay tiempo real: un
 * buzón entre un negocio y su clienta no lo necesita, y medio minuto de
 * retraso no cambia nada.
 */
export function RefrescarConversacion({ cada = 20_000 }: { cada?: number }) {
  const router = useRouter();

  useEffect(() => {
    const reloj = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, cada);

    return () => clearInterval(reloj);
  }, [router, cada]);

  return null;
}
