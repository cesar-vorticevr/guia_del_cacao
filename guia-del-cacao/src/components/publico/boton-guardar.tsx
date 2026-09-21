"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { marcarGuardada } from "@/lib/publico/guardados";

/**
 * El marcador de guardar, al final de la barra de acciones.
 *
 * **Sin contador, a diferencia del corazón.** Cuántos guardaron algo no lo ve
 * nadie: guardar es un apartado personal, no una señal pública, y poner un
 * número al lado lo convertiría en otra cosa que medir. Lo que se filtra por
 * guardados es lo tuyo; lo que se cuenta a la vista de todos son los corazones.
 *
 * Cambia sin esperar al servidor, como el corazón: si el servidor dice que no,
 * vuelve a como estaba y lo explica.
 */
export function BotonGuardar({
  publicacionId,
  inicial,
  haySesion,
}: {
  publicacionId: string;
  /** Si quien mira ya la tiene guardada. */
  inicial: boolean;
  haySesion: boolean;
}) {
  const [guardada, setGuardada] = useState(inicial);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();
  const router = useRouter();

  const alTocar = (evento: React.MouseEvent) => {
    // Suele vivir dentro de una tarjeta que es un enlace: sin esto, guardar
    // navegaría.
    evento.preventDefault();
    evento.stopPropagation();

    if (!haySesion) {
      router.push("/registro/cliente");
      return;
    }

    const quiero = !guardada;

    setGuardada(quiero);
    setAviso(null);

    empezar(async () => {
      const resultado = await marcarGuardada(publicacionId, quiero);

      if (resultado.error) {
        setGuardada(!quiero);
        setAviso(resultado.error);
      }
    });
  };

  return (
    <span className="relative">
      <button
        type="button"
        onClick={alTocar}
        disabled={pendiente}
        aria-pressed={guardada}
        aria-label={guardada ? "Quitar de guardados" : "Guardar para después"}
        className={`inline-flex min-h-9 items-center rounded-full border-2 px-3 transition-transform active:scale-95 ${
          guardada
            ? "border-selva bg-selva/10 text-selva"
            : "border-ink/10 bg-white text-cacao/60 hover:text-selva"
        }`}
      >
        {/* El marcapáginas de toda la vida: relleno cuando está guardada. */}
        <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
          <path
            d="M6 3h12a1 1 0 0 1 1 1v17l-7-4.5L5 21V4a1 1 0 0 1 1-1Z"
            fill={guardada ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {aviso && (
        <span
          role="alert"
          className="absolute top-full right-0 z-20 mt-1 w-48 rounded-xl border-2 border-guayaba/40 bg-white px-3 py-2 text-xs font-bold text-cacao shadow-dura-sm"
        >
          {aviso}
        </span>
      )}
    </span>
  );
}
