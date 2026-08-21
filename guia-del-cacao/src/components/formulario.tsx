"use client";

import { useFormStatus } from "react-dom";

type CampoProps = {
  nombre: string;
  etiqueta: string;
  tipo?: "text" | "email" | "password" | "tel";
  ayuda?: string;
  requerido?: boolean;
  autoComplete?: string;
};

export function Campo({
  nombre,
  etiqueta,
  tipo = "text",
  ayuda,
  requerido = true,
  autoComplete,
}: CampoProps) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-bold text-selva-2">{etiqueta}</span>
      <input
        id={nombre}
        name={nombre}
        type={tipo}
        required={requerido}
        autoComplete={autoComplete}
        aria-describedby={ayuda ? `${nombre}-ayuda` : undefined}
        /* min-h-14: objetivo táctil grande, que es como se va a usar en la feria. */
        className="min-h-14 w-full rounded-2xl border-2 border-selva/20 bg-white px-4 text-base text-ink transition-colors placeholder:text-cacao/40 focus:border-selva"
      />
      {ayuda && (
        <span id={`${nombre}-ayuda`} className="mt-1.5 block text-sm text-cacao/70">
          {ayuda}
        </span>
      )}
    </label>
  );
}

export function Selector({
  nombre,
  etiqueta,
  opciones,
}: {
  nombre: string;
  etiqueta: string;
  opciones: { valor: string; texto: string }[];
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-bold text-selva-2">{etiqueta}</span>
      <select
        id={nombre}
        name={nombre}
        required
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
