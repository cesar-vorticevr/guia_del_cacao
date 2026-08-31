"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

type CampoProps = {
  nombre: string;
  etiqueta: string;
  tipo?: "text" | "email" | "password" | "tel" | "datetime-local" | "number";
  ayuda?: string;
  requerido?: boolean;
  autoComplete?: string;
  valor?: string | null;
  marcador?: string;
  /** Tope de caracteres. Con él aparece el contador. */
  limite?: number;
};

export function Campo({
  nombre,
  etiqueta,
  tipo = "text",
  ayuda,
  requerido = true,
  autoComplete,
  valor,
  marcador,
  limite,
}: CampoProps) {
  const [largo, setLargo] = useState((valor ?? "").length);

  return (
    <label className="block">
      <span className="mb-1.5 block font-bold text-selva-2">{etiqueta}</span>
      <input
        id={nombre}
        name={nombre}
        type={tipo}
        required={requerido}
        autoComplete={autoComplete}
        defaultValue={valor ?? undefined}
        placeholder={marcador}
        maxLength={limite}
        onChange={limite ? (evento) => setLargo(evento.target.value.length) : undefined}
        aria-describedby={ayuda ? `${nombre}-ayuda` : undefined}
        /* min-h-14: objetivo táctil grande, que es como se va a usar en la feria. */
        className="min-h-14 w-full rounded-2xl border-2 border-selva/20 bg-white px-4 text-base text-ink transition-colors placeholder:text-cacao/40 focus:border-selva"
      />
      {ayuda && (
        <span id={`${nombre}-ayuda`} className="mt-1.5 block text-sm text-cacao/70">
          {ayuda}
        </span>
      )}
      {limite && <Contador largo={largo} limite={limite} />}
    </label>
  );
}

/**
 * Cuánto llevas escrito, cuando el campo tiene tope.
 *
 * Se pone en rojo en el último 10%, no antes: un contador que alarma desde el
 * principio se lee como una advertencia permanente y deja de mirarse. Y va con
 * `aria-live="polite"` para que a quien usa lector de pantalla le avise al
 * acercarse al límite, sin interrumpirle cada tecla.
 */
function Contador({ largo, limite }: { largo: number; limite: number }) {
  const cerca = largo > limite * 0.9;

  return (
    <span
      aria-live="polite"
      className={`mt-1.5 block text-right font-mono text-sm ${
        cerca ? "font-bold text-guayaba" : "text-cacao/70"
      }`}
    >
      {largo} / {limite}
    </span>
  );
}

export function Area({
  nombre,
  etiqueta,
  ayuda,
  valor,
  filas = 4,
  limite,
}: {
  nombre: string;
  etiqueta: string;
  ayuda?: string;
  valor?: string | null;
  filas?: number;
  /** Tope de caracteres. Con él aparece el contador. */
  limite?: number;
}) {
  const [largo, setLargo] = useState((valor ?? "").length);

  return (
    <label className="block">
      <span className="mb-1.5 block font-bold text-selva-2">{etiqueta}</span>
      <textarea
        id={nombre}
        name={nombre}
        rows={filas}
        defaultValue={valor ?? ""}
        maxLength={limite}
        onChange={limite ? (evento) => setLargo(evento.target.value.length) : undefined}
        className="w-full rounded-2xl border-2 border-selva/20 bg-white px-4 py-3 text-base text-ink focus:border-selva"
      />
      {ayuda && <span className="mt-1.5 block text-sm text-cacao/70">{ayuda}</span>}
      {limite && <Contador largo={largo} limite={limite} />}
    </label>
  );
}

export function Selector({
  nombre,
  etiqueta,
  opciones,
  requerido = true,
}: {
  nombre: string;
  etiqueta: string;
  opciones: { valor: string; texto: string }[];
  /**
   * Ojo al ponerlo en true si alguna opción tiene valor vacío: el navegador
   * la considera "sin elegir" y aborta el envío sin decir nada.
   */
  requerido?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-bold text-selva-2">{etiqueta}</span>
      <select
        id={nombre}
        name={nombre}
        required={requerido}
        className="min-h-14 w-full rounded-2xl border-2 border-selva/20 bg-white px-4 text-base text-ink focus:border-selva"
      >
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.texto}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Aviso({ children }: { children: React.ReactNode }) {
  if (!children) return null;

  return (
    <p
      role="alert"
      className="rounded-2xl border-2 border-guayaba/40 bg-guayaba/10 px-4 py-3 font-bold text-cacao"
    >
      {children}
    </p>
  );
}

export function BotonEnviar({
  children,
  variante = "principal",
}: {
  children: React.ReactNode;
  variante?: "principal" | "secundario";
}) {
  const { pending } = useFormStatus();

  const estilos =
    variante === "principal"
      ? "bg-selva text-crema hover:bg-selva-2"
      : "border-2 border-selva/25 bg-white text-selva-2 hover:border-selva";

  return (
    <button
      type="submit"
      disabled={pending}
      className={`min-h-14 w-full rounded-full px-6 font-display text-lg font-semibold transition-colors disabled:opacity-60 ${estilos}`}
    >
      {pending ? "Un momento…" : children}
    </button>
  );
}
