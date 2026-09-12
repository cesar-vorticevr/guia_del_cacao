"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { marcarMeGusta, type Clase } from "@/lib/publico/me-gusta";

/**
 * El corazón de una publicación o de un evento, con su contador.
 *
 * No lleva festejo, a diferencia del de favoritos. Aquel se da una vez por
 * negocio y es una decisión; este se da al pasar, bajando por el muro, y
 * celebrarlo cada vez sería una fiesta cada tres segundos. Solo late.
 *
 * Cambia sin esperar al servidor: si el servidor dice que no, vuelve al número
 * de antes y lo explica. El número que se enseña es el del servidor más o menos
 * el propio, para no tener que recargar la lista entera por un corazón.
 */
export function MeGusta({
  clase,
  id,
  inicial,
  cuantos,
  haySesion,
  comentarios,
}: {
  clase: Clase;
  id: string;
  /** Si quien mira ya lo dio. */
  inicial: boolean;
  /** Cuántos hay en total, contando el propio si ya lo dio. */
  cuantos: number;
  haySesion: boolean;
  /** Va al lado, porque los dos números se leen juntos. */
  comentarios: number;
}) {
  const [dado, setDado] = useState(inicial);
  const [total, setTotal] = useState(cuantos);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();
  const router = useRouter();

  const alTocar = (evento: React.MouseEvent) => {
    // Suele vivir dentro de una tarjeta que es un enlace: sin esto, dar un
    // corazón navegaría.
    evento.preventDefault();
    evento.stopPropagation();

    if (!haySesion) {
      router.push("/registro/cliente");
      return;
    }

    const quiero = !dado;

    setDado(quiero);
    setTotal((n) => n + (quiero ? 1 : -1));
    setAviso(null);

    empezar(async () => {
      const resultado = await marcarMeGusta(clase, id, quiero);

      if (resultado.error) {
        setDado(!quiero);
        setTotal((n) => n + (quiero ? -1 : 1));
        setAviso(resultado.error);
      }
    });
  };

  return (
    <span className="relative flex flex-wrap items-center gap-3 font-mono text-xs text-cacao/70">
      <button
        type="button"
        onClick={alTocar}
        disabled={pendiente}
        aria-pressed={dado}
        aria-label={
          dado
            ? `Quitar tu corazón. ${total} en total`
            : `Dar un corazón. ${total} en total`
        }
        className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border-2 px-3 transition-transform active:scale-95 ${
          dado
            ? "border-guayaba bg-guayaba/15 text-guayaba"
            : "border-ink/10 bg-white text-cacao/60 hover:text-guayaba"
        }`}
      >
        <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
          <path
            d="M12 20.5 4.3 13a4.8 4.8 0 0 1 6.8-6.8l.9.9.9-.9A4.8 4.8 0 0 1 19.7 13Z"
            fill={dado ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
        <span className="font-bold tabular-nums">{total}</span>
      </button>

      <span className="inline-flex items-center gap-1.5">
        <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
          <path
            d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.3-.6L3 21l1.7-5a8.1 8.1 0 0 1-.7-3.5 8.4 8.4 0 0 1 9-8.4 8.4 8.4 0 0 1 8 8.4Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
        <span className="font-bold tabular-nums">{comentarios}</span>
        <span className="sr-only">
          {comentarios === 1 ? "comentario" : "comentarios"}
        </span>
      </span>

      {aviso && (
        <span
          role="alert"
          className="absolute top-full left-0 z-20 mt-1 w-48 rounded-xl border-2 border-guayaba/40 bg-white px-3 py-2 text-xs font-bold text-cacao shadow-dura-sm"
        >
          {aviso}
        </span>
      )}
    </span>
  );
}
