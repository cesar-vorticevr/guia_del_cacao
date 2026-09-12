"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { marcarFavorito } from "@/lib/publico/favoritos";

/**
 * El corazón para guardar un negocio.
 *
 * Va en cada tarjeta del directorio y en el micrositio. Cambia al tocarlo sin
 * esperar al servidor: guardar un favorito es un gesto de paso, y medio segundo
 * de corazón muerto se siente como que no funcionó. Si el servidor dice que no,
 * vuelve solo a como estaba y lo dice.
 *
 * En la tarjeta va encima de un enlace que ocupa todo, así que detiene la
 * navegación —`preventDefault`— antes de hacer lo suyo: quien toca el corazón
 * no quiere entrar al micrositio.
 */
export function BotonFavorito({
  sucursalId,
  nombre,
  inicial,
  /**
   * Si esta cuenta puede guardar favoritos, es decir: hay sesión y es de
   * visitante. Un negocio tiene sesión y aun así no puede.
   */
  puedeGuardar,
  /** Para distinguir "entra a tu cuenta" de "tu tipo de cuenta no guarda". */
  haySesion,
  /** En la tarjeta va flotando sobre la esquina; en el micrositio, en línea. */
  flotante = false,
}: {
  sucursalId: string;
  nombre: string;
  inicial: boolean;
  puedeGuardar: boolean;
  haySesion: boolean;
  flotante?: boolean;
}) {
  const [guardado, setGuardado] = useState(inicial);
  const [festejando, setFestejando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();
  const router = useRouter();

  const alTocar = (evento: React.MouseEvent) => {
    // La tarjeta entera es un enlace: sin esto, guardar navegaría.
    evento.preventDefault();
    evento.stopPropagation();

    // Sin sesión, el corazón es la invitación a tener cuenta.
    if (!haySesion) {
      router.push("/registro/cliente");
      return;
    }

    /*
      Con sesión de negocio o de administrador no se guarda, y sobre todo no se
      festeja: celebrar y quitarlo medio segundo después por un error del
      servidor es peor que decirlo de una.
    */
    if (!puedeGuardar) {
      setAviso("Los favoritos son de las cuentas de visitante.");
      return;
    }

    const quiero = !guardado;
    setGuardado(quiero);
    setAviso(null);

    // El festejo solo al guardar. Celebrar que alguien quitó un favorito sería
    // festejarle que se arrepintió.
    if (quiero) {
      setFestejando(true);
      window.setTimeout(() => setFestejando(false), 900);
    }

    empezar(async () => {
      const resultado = await marcarFavorito(sucursalId, quiero);

      if (resultado.error) {
        setGuardado(!quiero);
        setFestejando(false);
        setAviso(resultado.error);
      }
    });
  };

  return (
    <span className={flotante ? "absolute right-3 top-3 z-10" : "relative inline-flex"}>
      <button
        type="button"
        onClick={alTocar}
        disabled={pendiente}
        aria-pressed={guardado}
        aria-label={
          guardado ? `Quitar ${nombre} de favoritos` : `Guardar ${nombre} en favoritos`
        }
        title={guardado ? "Quitar de favoritos" : "Guardar en favoritos"}
        className={`grid size-9 place-items-center rounded-full border-2 transition-transform active:scale-90 ${
          guardado
            ? "border-guayaba bg-guayaba text-white"
            : "border-ink/10 bg-white/90 text-cacao/50 hover:text-guayaba"
        }`}
      >
        <Corazon relleno={guardado} />
      </button>

      {/*
        El festejo: el corazón se despega y se desvanece hacia arriba, con dos
        chispas a los lados. Dura poco a propósito —novecientos milisegundos—
        porque esto pasa mientras alguien va recorriendo el directorio y una
        animación larga se convertiría en un estorbo a la tercera vez.

        `pointer-events-none` para que no tape el propio botón mientras corre, y
        se apaga entero con `motion-reduce`.
      */}
      {festejando && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 motion-reduce:hidden"
        >
          <span className="absolute inset-0 grid animate-favorito-sube place-items-center text-guayaba">
            <Corazon relleno />
          </span>
          <span className="absolute inset-0 animate-favorito-chispa-izq text-mango">
            <Chispa />
          </span>
          <span className="absolute inset-0 animate-favorito-chispa-der text-lima">
            <Chispa />
          </span>
        </span>
      )}

      {/*
        El error se dice donde ocurrió y no en un aviso global: quien tocó el
        corazón está mirando el corazón.
      */}
      {aviso && (
        <span
          role="alert"
          className="absolute right-0 top-full z-20 mt-1 w-44 rounded-xl border-2 border-guayaba/40 bg-white px-3 py-2 text-xs font-bold text-cacao shadow-dura-sm"
        >
          {aviso}
        </span>
      )}
    </span>
  );
}

function Corazon({ relleno }: { relleno: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path
        d="M12 20.5 4.3 13a4.8 4.8 0 0 1 6.8-6.8l.9.9.9-.9A4.8 4.8 0 0 1 19.7 13Z"
        fill={relleno ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Chispa() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        d="M12 2v6M12 16v6M2 12h6M16 12h6"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
