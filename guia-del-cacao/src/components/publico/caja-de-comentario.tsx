"use client";

import { useRef, useState } from "react";
import {
  candidatosDeMencion,
  mencionEnCurso,
} from "@/lib/menciones";
import type { Participante } from "@/lib/datos/comentarios";

/**
 * La caja donde se escribe un comentario, con el selector de etiquetas.
 *
 * Al escribir un arroba aparece la lista de **quienes ya participaron** en esta
 * conversación. Solo ellos: un buscador de toda la gente del sitio dentro de un
 * comentario convierte una conversación en un sitio desde donde llamarle la
 * atención a desconocidos.
 *
 * Se usa igual al escribir uno nuevo y al editar el propio. Vive en su
 * componente y no dos veces dentro de `Comentarios` porque el selector lleva su
 * estado —abierto, cuál está marcada— y duplicarlo era garantizar que las dos
 * cajas se despegaran.
 *
 * El valor lo manda quien la usa (`valor` y `alCambiar`): el botón de
 * «Responder» necesita poder escribir el `@Nombre` dentro, y para eso el texto
 * tiene que vivir fuera.
 */
export function CajaDeComentario({
  nombre,
  valor,
  alCambiar,
  participantes,
  caja,
  filas = 3,
  marcador,
}: {
  /** El `name` del campo, que es lo que lee la acción del servidor. */
  nombre: string;
  valor: string;
  alCambiar: (texto: string) => void;
  participantes: Participante[];
  /** Para que quien la usa pueda enfocarla al pulsar «Responder». */
  caja?: React.RefObject<HTMLTextAreaElement | null>;
  filas?: number;
  marcador?: string;
}) {
  const propia = useRef<HTMLTextAreaElement | null>(null);
  const area = caja ?? propia;

  /** Lo que va escrito tras el arroba, o `null` si no hay etiqueta en curso. */
  const [enCurso, setEnCurso] = useState<{
    desde: number;
    consulta: string;
  } | null>(null);

  const [marcada, setMarcada] = useState(0);

  const candidatos = enCurso
    ? candidatosDeMencion(participantes, enCurso.consulta)
    : [];

  const abierta = candidatos.length > 0;

  const revisar = (texto: string, cursor: number) => {
    const hallada = participantes.length > 0 ? mencionEnCurso(texto, cursor) : null;
    setEnCurso(hallada);
    setMarcada(0);
  };

  const elegir = (participante: Participante) => {
    if (!enCurso) return;

    const nodo = area.current;
    const cursor = nodo?.selectionStart ?? valor.length;

    // Se reemplaza desde el arroba hasta el cursor, no hasta el final: puede
    // haber texto escrito después si volvió atrás a etiquetar a alguien.
    const nuevo =
      valor.slice(0, enCurso.desde) +
      `@${participante.nombre} ` +
      valor.slice(cursor);

    alCambiar(nuevo);
    setEnCurso(null);

    // El cursor va justo detrás del nombre y del espacio, para poder seguir
    // escribiendo. Sin esto salta al final, que casi nunca es donde estaba.
    const siguiente = enCurso.desde + participante.nombre.length + 2;

    requestAnimationFrame(() => {
      nodo?.focus();
      nodo?.setSelectionRange(siguiente, siguiente);
    });
  };

  return (
    <span className="relative block">
      <textarea
        ref={area}
        name={nombre}
        rows={filas}
        value={valor}
        placeholder={marcador}
        onChange={(evento) => {
          alCambiar(evento.target.value);
          revisar(evento.target.value, evento.target.selectionStart);
        }}
        /* Mover el cursor con el ratón o con las flechas también cambia si hay
           una etiqueta en curso: el arroba puede quedar detrás o delante. */
        onClick={(evento) =>
          revisar(evento.currentTarget.value, evento.currentTarget.selectionStart)
        }
        onKeyUp={(evento) => {
          if (evento.key.startsWith("Arrow") || evento.key === "Home" || evento.key === "End") {
            revisar(evento.currentTarget.value, evento.currentTarget.selectionStart);
          }
        }}
        onKeyDown={(evento) => {
          if (!abierta) return;

          // Las flechas y el Enter solo se interceptan con la lista abierta:
          // con la lista cerrada, Enter tiene que dar salto de línea.
          if (evento.key === "ArrowDown") {
            evento.preventDefault();
            setMarcada((n) => (n + 1) % candidatos.length);
          } else if (evento.key === "ArrowUp") {
            evento.preventDefault();
            setMarcada((n) => (n - 1 + candidatos.length) % candidatos.length);
          } else if (evento.key === "Enter" || evento.key === "Tab") {
            evento.preventDefault();
            elegir(candidatos[marcada]);
          } else if (evento.key === "Escape") {
            evento.preventDefault();
            setEnCurso(null);
          }
        }}
        /* Se cierra al salir, pero con un respiro: el `blur` llega antes que el
           clic en la lista, y sin la espera elegir con el ratón no funcionaba. */
        onBlur={() => setTimeout(() => setEnCurso(null), 150)}
        aria-describedby={abierta ? `${nombre}-etiquetas` : undefined}
        className="w-full rounded-2xl border-2 border-selva/20 bg-white px-4 py-3 text-base text-ink placeholder:text-cacao/40 focus:border-selva"
      />

      {abierta && (
        <span
          id={`${nombre}-etiquetas`}
          role="listbox"
          aria-label="Etiquetar a alguien de esta conversación"
          className="absolute top-full left-0 z-30 mt-1 block w-full max-w-xs overflow-hidden rounded-2xl border-2 border-ink/10 bg-white shadow-dura-alta"
        >
          {candidatos.map((participante, indice) => (
            <button
              key={participante.id}
              type="button"
              role="option"
              aria-selected={indice === marcada}
              onMouseEnter={() => setMarcada(indice)}
              onClick={() => elegir(participante)}
              className={`block w-full px-4 py-2.5 text-left font-bold ${
                indice === marcada
                  ? "bg-selva text-crema"
                  : "bg-white text-selva-2"
              }`}
            >
              @{participante.nombre}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}
