"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Aviso } from "@/components/formulario";
import { IconoClip } from "@/components/iconos";
import { enviarMensaje, type EstadoBuzon } from "@/lib/buzon/acciones";
import {
  ACEPTA_ADJUNTO,
  AYUDA_DE_ADJUNTO,
  BUCKET_BUZON,
  pesoLegible,
  revisarAdjunto,
} from "@/lib/buzon/adjuntos";
import { LARGO_DE_MENSAJE } from "@/lib/buzon/textos";
import { crearClienteNavegador } from "@/lib/supabase/client";

const INICIAL: EstadoBuzon = {};

/**
 * La caja para escribir, al pie de la conversación.
 *
 * Enter manda y Mayús+Enter baja de renglón, como en cualquier chat. Si el
 * envío falla, el texto vuelve a la caja: la acción lo devuelve y la caja se
 * monta de nuevo con él (la `key` cambia en el render, no en un efecto; ver
 * «Un formulario que falla no se vacía» en AGENTS.md).
 *
 * El clip adjunta una imagen, un video o un PDF (000072). El archivo sube
 * **del navegador al bucket** con la sesión de quien escribe —Vercel corta
 * los cuerpos en 4.5 MB— y a la acción solo viaja su ruta. Si el envío
 * falla, el archivo se queda elegido: está en el estado, no en el campo.
 */
export function EscribirMensaje({ conversacionId }: { conversacionId: string }) {
  const [estado, accion, enviando] = useActionState(enviarMensaje, INICIAL);
  const [vuelta, setVuelta] = useState(0);
  const [ultimo, setUltimo] = useState(estado);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [problema, setProblema] = useState<string | null>(null);
  const formulario = useRef<HTMLFormElement>(null);
  const campoArchivo = useRef<HTMLInputElement>(null);

  if (estado !== ultimo) {
    setUltimo(estado);
    setVuelta((v) => v + 1);
    if (estado.ok) setArchivo(null);
  }

  // El foco vuelve a la caja después de mandar, para seguir escribiendo.
  useEffect(() => {
    formulario.current?.querySelector("textarea")?.focus();
  }, [vuelta]);

  const ocupado = enviando || subiendo;

  async function mandar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (ocupado) return;

    const datos = new FormData(evento.currentTarget);
    setProblema(null);

    if (!archivo && !datos.get("texto")?.toString().trim()) return;

    if (archivo) {
      setSubiendo(true);
      const extension = archivo.name.includes(".") ? archivo.name.split(".").pop()?.toLowerCase() : "";
      const ruta = `${conversacionId}/${crypto.randomUUID()}${extension ? `.${extension}` : ""}`;

      const { error } = await crearClienteNavegador()
        .storage.from(BUCKET_BUZON)
        .upload(ruta, archivo, { contentType: archivo.type, upsert: false });

      setSubiendo(false);

      if (error) {
        setProblema("No se pudo subir el archivo. Revisa tu conexión e inténtalo de nuevo.");
        return;
      }

      datos.set("adjunto", ruta);
      datos.set("adjunto_nombre", archivo.name);
    }

    startTransition(() => accion(datos));
  }

  function elegir(evento: React.ChangeEvent<HTMLInputElement>) {
    const elegido = evento.target.files?.[0] ?? null;
    evento.target.value = "";
    if (!elegido) return;

    const error = revisarAdjunto(elegido);
    setProblema(error);
    setArchivo(error ? null : elegido);
  }

  return (
    <form
      ref={formulario}
      onSubmit={mandar}
      className="sticky bottom-20 grid gap-2 rounded-3xl border-2 border-mango/30 bg-white p-3 shadow-[0_0_40px_rgb(255_183_3/0.12)] sm:bottom-4"
    >
      <input type="hidden" name="conversacion_id" value={conversacionId} />
      {(problema || estado.error) && <Aviso>{problema ?? estado.error}</Aviso>}

      {archivo && (
        <p className="flex items-center justify-between gap-3 rounded-2xl bg-crema-2 px-4 py-2 text-sm text-cacao">
          <span className="min-w-0 truncate">
            <IconoClip className="mr-1.5 inline size-4" />
            <strong>{archivo.name}</strong> · {pesoLegible(archivo.size)}
          </span>
          <button
            type="button"
            onClick={() => setArchivo(null)}
            aria-label="Quitar el archivo"
            className="grid size-8 shrink-0 place-items-center rounded-full text-lg hover:bg-white"
          >
            ×
          </button>
        </p>
      )}

      <div className="flex items-end gap-2">
        <input
          ref={campoArchivo}
          type="file"
          accept={ACEPTA_ADJUNTO}
          onChange={elegir}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
        />
        <button
          type="button"
          onClick={() => campoArchivo.current?.click()}
          aria-label={`Adjuntar una imagen, un video o un PDF. ${AYUDA_DE_ADJUNTO}`}
          title={AYUDA_DE_ADJUNTO}
          className="grid min-h-12 w-12 shrink-0 place-items-center rounded-full border-2 border-selva/20 text-selva-2 transition-colors hover:border-mango hover:text-mango"
        >
          <IconoClip className="size-5" />
        </button>

        <label className="min-w-0 flex-1">
          <span className="sr-only">Tu mensaje</span>
          <textarea
            key={vuelta}
            name="texto"
            rows={2}
            required={!archivo}
            maxLength={LARGO_DE_MENSAJE}
            defaultValue={estado.error ? estado.texto : ""}
            placeholder={archivo ? "Agrega un comentario (opcional)…" : "Escribe tu mensaje…"}
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
          disabled={ocupado}
          className="boton-oro brillo min-h-12 shrink-0 rounded-full px-5 font-display text-lg font-semibold text-ink disabled:opacity-60"
        >
          {subiendo ? "Subiendo…" : enviando ? "…" : "Enviar"}
        </button>
      </div>

      <p className="px-1 text-xs text-cacao/60">
        Enter manda · Mayús + Enter baja de renglón · {AYUDA_DE_ADJUNTO} · Lo que se escribe aquí no se borra.
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
