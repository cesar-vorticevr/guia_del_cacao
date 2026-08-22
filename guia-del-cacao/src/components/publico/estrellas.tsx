"use client";

import { useState } from "react";

/**
 * Las estrellas de la calificación: una para leer y otra para votar.
 *
 * `Estrellas` acepta decimales porque el promedio casi nunca es redondo (3.5,
 * 4.2). En vez de redondear —que le mentiría al negocio y al cliente— pinta
 * cinco estrellas grises y encima las mismas en mango, recortadas al ancho
 * exacto del promedio. Media estrella es media estrella.
 */

const NUMEROS = [1, 2, 3, 4, 5] as const;

export function Estrella({ className = "size-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      <path d="m12 2.6 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3-5.8 3 1.1-6.5L2.6 9.4l6.5-.9z" />
    </svg>
  );
}

export function Estrellas({
  valor,
  tamano = "size-5",
}: {
  /** El promedio, de 0 a 5. Acepta decimales. */
  valor: number;
  tamano?: string;
}) {
  const porcentaje = Math.max(0, Math.min(100, (valor / 5) * 100));

  return (
    <span className="relative inline-flex" aria-hidden="true">
      <span className="flex gap-0.5 text-cacao/20">
        {NUMEROS.map((n) => (
          <Estrella key={n} className={tamano} />
        ))}
      </span>

      {/*
        La capa de color se recorta por ancho, no por número de estrellas: es
        lo que permite pintar media, o un cuarto, sin dibujar otro ícono.
      */}
      <span
        className="absolute inset-y-0 left-0 flex gap-0.5 overflow-hidden text-mango"
        style={{ width: `${porcentaje}%` }}
      >
        {NUMEROS.map((n) => (
          <Estrella key={n} className={tamano} />
        ))}
      </span>
    </span>
  );
}

/**
 * El selector de voto.
 *
 * Son radios de verdad debajo de las estrellas, no botones: así funciona con
 * teclado y con lector de pantalla sin tener que reinventar nada. Lo que se ve
 * es la estrella; lo que se opera es el radio.
 */
export function SelectorEstrellas({ name = "estrellas" }: { name?: string }) {
  const [valor, setValor] = useState(0);

  return (
    <fieldset>
      <legend className="mb-1.5 font-bold text-selva-2">Tu calificación</legend>

      <div className="flex gap-1.5">
        {NUMEROS.map((n) => (
          <label key={n} className="cursor-pointer">
            <input
              type="radio"
              name={name}
              value={n}
              checked={valor === n}
              onChange={() => setValor(n)}
              className="peer sr-only"
            />
            <span className="block rounded-lg peer-focus-visible:outline peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-selva">
              <Estrella
                className={`size-9 transition-colors ${
                  n <= valor ? "text-mango" : "text-cacao/25"
                }`}
              />
            </span>
            <span className="sr-only">
              {n} {n === 1 ? "estrella" : "estrellas"}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * El promedio con sus estrellas, tal como se ve en todas partes.
 *
 * Existe para que el mismo dato se lea igual en el directorio, en el
 * micrositio, en el panel del negocio y en el pasaporte del cliente. Cuando
 * cada pantalla lo armaba a mano, cada una lo redondeaba a su modo.
 */
export function Promedio({
  promedio,
  total,
  tamano = "size-4",
}: {
  promedio: number;
  /** Cuántas personas votaron. Se omite donde no cabe. */
  total?: number;
  tamano?: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Estrellas valor={promedio} tamano={tamano} />
      <span className="font-mono text-sm font-bold text-cacao">
        {promedio.toFixed(1)}
      </span>
      {total !== undefined && (
        <span className="text-xs text-cacao/60">({total})</span>
      )}
    </span>
  );
}

/** Para donde todavía no hay votos: el hueco se explica, no se deja en blanco. */
export function SinCalificar() {
  return <span className="text-xs text-cacao/50">Sin calificaciones todavía</span>;
}
