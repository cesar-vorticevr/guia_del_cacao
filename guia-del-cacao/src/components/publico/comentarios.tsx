"use client";

import { useActionState, useRef, useState } from "react";
import { Aviso, BotonEnviar } from "@/components/formulario";
import { CajaDeComentario } from "@/components/publico/caja-de-comentario";
import { MeGusta } from "@/components/publico/me-gusta";
import { trozosConMenciones } from "@/lib/menciones";
import {
  borrarComentario,
  comentar,
  editarComentario,
  ocultarComentario,
  type EstadoComentario,
} from "@/lib/comentarios/acciones";
import type { Contexto, Participante } from "@/lib/datos/comentarios";

const INICIAL: EstadoComentario = {};

export type ComentarioVista = {
  id: string;
  autor: string;
  texto: string;
  /**
   * Cuánto lleva ahí: «ahora», «5m», «3h», «2d», «6s».
   *
   * Era la fecha completa —«11 de septiembre de 2026»—, que en una
   * conversación no dice lo que hace falta saber: si esto se escribió hace un
   * rato o el año pasado. Se calcula en el servidor para que no baile entre
   * servidor y navegador.
   */
  hace: string;
  /** La fecha exacta, para el `title` de quien quiera el dato al detalle. */
  fechaExacta: string;
  editado: boolean;
  oculto: boolean;
  esMio: boolean;
  /** De quién es. */
  autorId?: string;
  /** A cuál contesta, si contesta a alguno. */
  respondeA?: string | null;
  /** Cuántos corazones lleva. */
  apoyos: number;
  /** Si quien mira ya le dio el suyo. */
  miApoyo: boolean;
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
 * El texto de un comentario, con las etiquetas resaltadas.
 *
 * La etiqueta se resuelve contra la lista de participantes y no con una regla
 * de «arroba hasta el espacio»: los nombres llevan espacios. Lo que no encaja
 * con nadie se queda como texto llano.
 */
function Texto({
  texto,
  nombres,
}: {
  texto: string;
  nombres: string[];
}) {
  return (
    <p className="mt-1.5 whitespace-pre-line text-cacao">
      {trozosConMenciones(texto, nombres).map((trozo, indice) =>
        trozo.mencion ? (
          <strong key={indice} className="font-bold text-selva">
            {trozo.texto}
          </strong>
        ) : (
          <span key={indice}>{trozo.texto}</span>
        ),
      )}
    </p>
  );
}

/**
 * Los comentarios de un evento, una noticia o una publicación de la comunidad.
 *
 * Es el mismo componente para los tres porque para quien lee y escribe es el
 * mismo gesto; lo que cambia son los topes, quién modera y si hay hilo, y eso
 * llega en props. Las reglas de verdad las impone la base.
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
  participantes = [],
  puedeGustar = false,
  haySesion = false,
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
  /** A quién se puede etiquetar: solo quienes ya participaron aquí. */
  participantes?: Participante[];
  /**
   * Si los comentarios llevan corazón. Solo los de la comunidad: los de un
   * evento se comentan una vez y no hay hilo al que asentir (migración 000047).
   */
  puedeGustar?: boolean;
  /** Para el corazón: sin sesión lleva a registrarse en vez de darlo. */
  haySesion?: boolean;
}) {
  const [estado, accion] = useActionState(comentar, INICIAL);

  /*
    A quién se está contestando. Vive aquí y no en cada comentario porque el
    formulario es uno solo, abajo: dos cajas de texto abiertas a la vez —la de
    comentar y la de responder— hacen dudar de en cuál se escribe.
  */
  const [respondiendo, setRespondiendo] = useState<ComentarioVista | null>(
    null,
  );

  const [texto, setTexto] = useState("");
  const caja = useRef<HTMLTextAreaElement | null>(null);

  /*
    Al publicar se vacía la caja. La caja es controlada —el botón de «Responder»
    tiene que poder escribir dentro— así que no se limpia sola con el `reset`
    del formulario.

    Se ajusta **en el render** y no en un efecto: un efecto que llama a
    `setState` hace una segunda pintada con la caja todavía llena, y además es
    lo que el lint prohíbe. Se compara el objeto entero y no `estado.ok`: el
    mensaje de éxito es siempre el mismo texto, así que comparándolo la caja no
    se vaciaría en el segundo comentario.
  */
  const [visto, setVisto] = useState(estado);

  if (visto !== estado) {
    setVisto(estado);

    if (estado.ok) {
      setTexto("");
      setRespondiendo(null);
    }
  }

  const nombres = participantes.map((p) => p.nombre);

  /**
   * Responder: cuelga la respuesta del comentario raíz y **etiqueta a quien se
   * contesta**.
   *
   * Son dos cosas distintas y por eso van juntas. El hilo es de un solo nivel
   * —lo impone la base— así que contestarle a una respuesta cuelga del mismo
   * comentario de arriba; sin la etiqueta, esa respuesta quedaba debajo del
   * hilo sin decir a quién de los cinco le hablaba.
   *
   * La etiqueta se antepone en vez de reemplazar lo escrito: quien ya llevaba
   * medio comentario redactado no lo pierde por pulsar «Responder».
   */
  const responder = (raiz: ComentarioVista, aQuien: ComentarioVista) => {
    setRespondiendo(raiz);

    const etiqueta = `@${aQuien.autor} `;

    setTexto((previo) =>
      previo.includes(`@${aQuien.autor}`) ? previo : etiqueta + previo,
    );

    requestAnimationFrame(() => {
      const nodo = caja.current;
      nodo?.focus();
      nodo?.setSelectionRange(etiqueta.length, etiqueta.length);
    });
  };

  // Un nivel: las respuestas cuelgan del comentario de arriba, como en la base.
  const raices = comentarios.filter((c) => !c.respondeA);
  const respuestasDe = (id: string) =>
    comentarios.filter((c) => c.respondeA === id);

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
        <span className="font-mono text-base text-cacao/70">
          ({comentarios.length})
        </span>
      </h2>

      {comentarios.length === 0 ? (
        <p className="mt-3 text-cacao">Todavía nadie ha comentado.</p>
      ) : (
        <ul className="mt-4 grid gap-4">
          {raices.map((comentario) => (
            <li key={comentario.id} className="grid gap-2">
              <ul className="grid gap-2">
                <Uno
                  comentario={comentario}
                  contexto={contexto}
                  referenciaId={referenciaId}
                  puedeOcultar={puedeOcultar}
                  puedeResponder={puedeComentar}
                  alResponder={() => responder(comentario, comentario)}
                  participantes={participantes}
                  nombres={nombres}
                  puedeGustar={puedeGustar}
                  haySesion={haySesion}
                />

                {/*
                  Las respuestas van sangradas y con una línea a la izquierda:
                  sin ellas, la contestación de un negocio parecía un comentario
                  suelto y no se sabía a quién le hablaba.
                */}
                {respuestasDe(comentario.id).map((respuesta) => (
                  <li
                    key={respuesta.id}
                    className="ml-4 border-l-4 border-selva/20 pl-4 sm:ml-8"
                  >
                    <ul className="grid">
                      <Uno
                        comentario={respuesta}
                        contexto={contexto}
                        referenciaId={referenciaId}
                        puedeOcultar={puedeOcultar}
                        puedeResponder={puedeComentar}
                        /*
                          Cuelga de la raíz —el hilo es de un nivel— pero
                          etiqueta a quien escribió esta respuesta, que es a
                          quien se le está hablando.
                        */
                        alResponder={() => responder(comentario, respuesta)}
                        participantes={participantes}
                        nombres={nombres}
                        puedeGustar={puedeGustar}
                        haySesion={haySesion}
                      />
                    </ul>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5">
        {puedeComentar ? (
          <form action={accion} className="grid gap-3">
            {comunes}
            <Confirmacion estado={estado} />

            {respondiendo && (
              <>
                <input
                  type="hidden"
                  name="responde_a"
                  value={respondiendo.id}
                />
                <p className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-crema-2 px-4 py-2 text-cacao">
                  <span>
                    Le contestas a{" "}
                    <strong className="text-selva-2">
                      {respondiendo.autor}
                    </strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => setRespondiendo(null)}
                    className="text-sm font-bold text-cacao/70 underline underline-offset-4"
                  >
                    Mejor no
                  </button>
                </p>
              </>
            )}

            <label className="block">
              <span className="mb-1.5 block font-bold text-selva-2">
                {respondiendo ? "Tu respuesta" : "Tu comentario"}
              </span>

              <CajaDeComentario
                nombre="texto"
                valor={texto}
                alCambiar={setTexto}
                participantes={participantes}
                caja={caja}
                marcador="¿Qué opinas?"
              />

              {/* Se dice una vez y en chico: quien no lo necesita no lo lee, y
                  quien escribe un arroba lo descubre solo. */}
              {participantes.length > 0 && (
                <span className="mt-1.5 block text-xs text-cacao/70">
                  Escribe <span className="font-mono font-bold">@</span> para
                  etiquetar a alguien de esta conversación.
                </span>
              )}
            </label>

            <BotonEnviar>{respondiendo ? "Responder" : "Comentar"}</BotonEnviar>
          </form>
        ) : (
          motivo && (
            <p className="rounded-3xl bg-crema-2 p-5 text-cacao">{motivo}</p>
          )
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
  puedeResponder = false,
  alResponder,
  participantes,
  nombres,
  puedeGustar,
  haySesion,
}: {
  comentario: ComentarioVista;
  contexto: Contexto;
  referenciaId: string;
  puedeOcultar: boolean;
  puedeResponder?: boolean;
  alResponder?: () => void;
  participantes: Participante[];
  nombres: string[];
  puedeGustar: boolean;
  haySesion: boolean;
}) {
  const [editando, setEditando] = useState(false);
  const [estado, accion] = useActionState(editarComentario, INICIAL);
  const [texto, setTexto] = useState(comentario.texto);

  // Al guardar se cierra el editor. Antes se quedaba abierto con el texto ya
  // guardado, y no había forma de saber si había entrado. En el render y no
  // en un efecto, por lo mismo que arriba.
  const [visto, setVisto] = useState(estado);

  if (visto !== estado) {
    setVisto(estado);
    if (estado.ok) setEditando(false);
  }

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

        {/*
          Cuánto lleva, no cuándo fue. La fecha exacta queda en el `title` para
          quien la quiera, sin ocupar sitio.
        */}
        <p
          title={comentario.fechaExacta}
          className="font-mono text-xs text-cacao/60"
        >
          {comentario.hace}
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

          <CajaDeComentario
            nombre="texto"
            valor={texto}
            alCambiar={setTexto}
            participantes={participantes}
          />

          <div className="flex flex-wrap gap-2">
            <BotonEnviar variante="secundario">Guardar</BotonEnviar>
            <button
              type="button"
              onClick={() => {
                setTexto(comentario.texto);
                setEditando(false);
              }}
              className="min-h-11 rounded-full px-4 text-sm font-bold text-cacao underline"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <Texto texto={comentario.texto} nombres={nombres} />
      )}

      {!editando && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {/*
            El corazón va primero y lo ve cualquiera, no solo quien modera o
            quien escribió: asentir es lo que más se hace en una conversación, y
            sin él había que gastar uno de los cinco comentarios en decir "eso".
          */}
          {puedeGustar && (
            <MeGusta
              clase="comentario"
              id={comentario.id}
              inicial={comentario.miApoyo}
              cuantos={comentario.apoyos}
              haySesion={haySesion}
            />
          )}

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

          {/*
            Aquí iba un botón para regalarle una mazorca a quien comentaba, de
            las cinco que la plataforma repartía al día. Se fue con las
            mazorcas: no hay moneda que dar.
          */}

          {/*
            Responder también en las respuestas. Antes solo en las raíces,
            porque sin etiqueta una respuesta a una respuesta quedaba sin decir
            a quién le hablaba; con el arroba ya lo dice, y contestarle a quien
            te contestó es lo normal de una conversación.
          */}
          {puedeResponder && alResponder && (
            <button
              type="button"
              onClick={alResponder}
              className="min-h-11 rounded-full border-2 border-selva/25 bg-white px-4 text-sm font-bold text-selva-2"
            >
              Responder
            </button>
          )}

          {puedeOcultar && !comentario.esMio && (
            <form action={ocultarComentario}>
              {comunes}
              <input
                type="hidden"
                name="ocultar"
                value={comentario.oculto ? "0" : "1"}
              />
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
