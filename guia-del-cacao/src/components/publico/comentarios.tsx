"use client";

import { useActionState, useState } from "react";
import { Aviso, BotonEnviar } from "@/components/formulario";
import {
  borrarComentario,
  comentar,
  editarComentario,
  ocultarComentario,
  type EstadoComentario,
} from "@/lib/comentarios/acciones";
import type { Contexto } from "@/lib/datos/comentarios";

const INICIAL: EstadoComentario = {};

export type ComentarioVista = {
  id: string;
  autor: string;
  texto: string;
  /** Ya formateada en el servidor, para que no baile entre servidor y navegador. */
  fechaTexto: string;
  editado: boolean;
  oculto: boolean;
  esMio: boolean;
};

function Confirmacion({ estado }: { estado: EstadoComentario }) {
  if (estado.error) return <Aviso>{estado.error}</Aviso>;
  if (estado.ok) {
    return (
      <p
        role="status"
        className="rounded-2xl border-2 border-lima/50 bg-lima/15 px-4 py-3 font-bold text-selva-2"
      >
        {estado.ok}
      </p>
    );
  }
  return null;
}

/**
 * Los comentarios de un evento, una noticia o un tema del foro.
 *
 * Es el mismo componente para los tres porque para quien lee y escribe es el
 * mismo gesto; lo que cambia son los topes y quién modera, y eso llega en
 * props. Las reglas de verdad las impone la base.
 *
 * El propio va siempre arriba: quien acaba de escribir quiere verlo sin
 * buscarlo, y si se lo ocultaron es la única señal de que sigue ahí.
 */
export function Comentarios({
  contexto,
  referenciaId,
  comentarios,
  puedeComentar,
  motivo,
  puedeOcultar,
}: {
  contexto: Contexto;
  referenciaId: string;
  comentarios: ComentarioVista[];
  puedeComentar: boolean;
  /**
   * Por qué no puede comentar, cuando no puede. Es un nodo y no un texto
   * porque a veces lleva dentro el enlace para iniciar sesión.
   */
  motivo: React.ReactNode;
  /** Si quien mira modera aquí: el negocio en su publicación, el autor del tema. */
  puedeOcultar: boolean;
}) {
  const [estado, accion] = useActionState(comentar, INICIAL);

  const comunes = (
    <>
      <input type="hidden" name="contexto" value={contexto} />
      <input type="hidden" name="referencia_id" value={referenciaId} />
    </>
  );

  return (
    <section className="pt-8">
      <h2 className="font-display text-xl">
        Comentarios{" "}
        <span className="font-mono text-base text-cacao/70">({comentarios.length})</span>
      </h2>

      {comentarios.length === 0 ? (
        <p className="mt-3 text-cacao">Todavía nadie ha comentado.</p>
      ) : (
        <ul className="mt-4 grid gap-3">
          {comentarios.map((comentario) => (
            <Uno
              key={comentario.id}
              comentario={comentario}
              contexto={contexto}
              referenciaId={referenciaId}
              puedeOcultar={puedeOcultar}
            />
          ))}
        </ul>
      )}

      <div className="mt-5">
        {puedeComentar ? (
          <form action={accion} className="grid gap-3">
            {comunes}
            <Confirmacion estado={estado} />

            <label className="block">
              <span className="mb-1.5 block font-bold text-selva-2">Tu comentario</span>
              <textarea
                name="texto"
                rows={3}
                placeholder="¿Qué opinas?"
                className="w-full rounded-2xl border-2 border-selva/20 bg-white px-4 py-3 text-base text-ink placeholder:text-cacao/40 focus:border-selva"
              />
            </label>

            <BotonEnviar>Comentar</BotonEnviar>
          </form>
        ) : (
          motivo && <p className="rounded-3xl bg-crema-2 p-5 text-cacao">{motivo}</p>
        )}
      </div>
    </section>
  );
}

function Uno({
  comentario,
  contexto,
  referenciaId,
  puedeOcultar,
}: {
  comentario: ComentarioVista;
  contexto: Contexto;
  referenciaId: string;
  puedeOcultar: boolean;
}) {
  const [editando, setEditando] = useState(false);
  const [estado, accion] = useActionState(editarComentario, INICIAL);

  const comunes = (
    <>
      <input type="hidden" name="contexto" value={contexto} />
      <input type="hidden" name="referencia_id" value={referenciaId} />
      <input type="hidden" name="comentario_id" value={comentario.id} />
    </>
  );

  return (
    <li
      className={`rounded-3xl border-2 p-5 ${
        comentario.esMio
          ? "border-selva/30 bg-crema-2"
          : "border-ink/10 bg-white shadow-dura"
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-bold text-selva-2">
          {comentario.autor}
          {comentario.esMio && (
            <span className="ml-2 font-normal text-sm text-cacao/70">(tú)</span>
          )}
        </p>
        <p className="font-mono text-xs text-cacao/70">
          {comentario.fechaTexto}
          {comentario.editado && " · editado"}
        </p>
      </div>

      {comentario.oculto && (
        <p className="mt-2 rounded-2xl bg-guayaba/15 px-4 py-2 text-sm text-cacao">
          {comentario.esMio
            ? "Este comentario está oculto: solo tú lo ves."
            : "Oculto para el resto de la gente."}
        </p>
      )}

      {editando ? (
        <form action={accion} className="mt-3 grid gap-2">
          {comunes}
          <Confirmacion estado={estado} />

          <textarea
            name="texto"
            rows={3}
            defaultValue={comentario.texto}
            className="w-full rounded-2xl border-2 border-selva/20 bg-white px-4 py-3 text-base text-ink focus:border-selva"
          />

          <div className="flex flex-wrap gap-2">
            <BotonEnviar variante="secundario">Guardar</BotonEnviar>
            <button
              type="button"
              onClick={() => setEditando(false)}
              className="min-h-11 rounded-full px-4 text-sm font-bold text-cacao underline"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <p className="mt-1.5 whitespace-pre-line text-cacao">{comentario.texto}</p>
      )}

      {(comentario.esMio || puedeOcultar) && !editando && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {comentario.esMio && (
            <>
              <button
                type="button"
                onClick={() => setEditando(true)}
                className="min-h-11 rounded-full border-2 border-selva/25 bg-white px-4 text-sm font-bold text-selva-2"
              >
                Editar
              </button>

              <form action={borrarComentario}>
                {comunes}
                <button
                  type="submit"
                  className="min-h-11 rounded-full border-2 border-guayaba/50 px-4 text-sm font-bold text-cacao"
                >
                  Eliminar
                </button>
              </form>
            </>
          )}

          {puedeOcultar && !comentario.esMio && (
            <form action={ocultarComentario}>
              {comunes}
              <input type="hidden" name="ocultar" value={comentario.oculto ? "0" : "1"} />
              <button
                type="submit"
                className="min-h-11 rounded-full border-2 border-selva/25 bg-white px-4 text-sm font-bold text-selva-2"
              >
                {comentario.oculto ? "Mostrar" : "Ocultar"}
              </button>
            </form>
          )}
        </div>
      )}
    </li>
  );
}
