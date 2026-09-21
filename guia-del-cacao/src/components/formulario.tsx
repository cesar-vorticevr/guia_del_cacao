"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { IconoOjo, IconoOjoTachado } from "@/components/iconos";

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
  /**
   * Qué está mal en **este** campo, cuando el servidor lo dice.
   *
   * Se pinta en el campo y no solo arriba en el aviso general: con cinco
   * campos, «el precio no es un número válido» obliga a buscar cuál de los
   * cinco es el precio. Marcado, se ve de un golpe.
   */
  problema?: string | null;
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
  problema,
}: CampoProps) {
  const [largo, setLargo] = useState((valor ?? "").length);
  const [visible, setVisible] = useState(false);

  /*
    El ojo solo en las contraseñas, y solo cuando hay algo escrito: un botón para
    revelar un campo vacío no revela nada y de paso deja un icono flotando en un
    formulario que todavía no se ha tocado.

    Vale para todos los campos de contraseña —registro, entrada y cambio—, no
    solo donde se pidió: teclear a ciegas una contraseña larga se equivoca igual
    en las tres pantallas.
  */
  const esClave = tipo === "password";
  const conOjo = esClave && largo > 0;

  return (
    <label className="block">
      <span className="mb-1.5 block font-bold text-selva-2">{etiqueta}</span>

      <span className="relative block">
        <input
          id={nombre}
          name={nombre}
          type={esClave && visible ? "text" : tipo}
          required={requerido}
          autoComplete={autoComplete}
          defaultValue={valor ?? undefined}
          placeholder={marcador}
          maxLength={limite}
          /*
            En las contraseñas el contador se lleva la cuenta igual, aunque no se
            enseñe: es lo que sabe si el campo está vacío para decidir si el ojo
            aparece.
          */
          onChange={
            limite || esClave
              ? (evento) => setLargo(evento.target.value.length)
              : undefined
          }
          aria-invalid={problema ? true : undefined}
          aria-describedby={
            problema
              ? `${nombre}-problema`
              : ayuda
                ? `${nombre}-ayuda`
                : undefined
          }
          /* min-h-14: objetivo táctil grande, que es como se va a usar en la feria. */
          className={`min-h-14 w-full rounded-2xl border-2 bg-white text-base text-ink transition-colors placeholder:text-cacao/40 ${
            problema
              ? "border-guayaba focus:border-guayaba"
              : "border-selva/20 focus:border-selva"
          } ${
            conOjo ? "pr-14 pl-4" : "px-4"
          }`}
        />

        {conOjo && (
          <button
            type="button"
            onClick={() => setVisible((antes) => !antes)}
            aria-pressed={visible}
            aria-label={visible ? "Ocultar la contraseña" : "Mostrar la contraseña"}
            /* `-translate-y-1/2` con `top-1/2` lo centra sin depender del alto,
               que cambia si el navegador agranda la letra. */
            className="absolute top-1/2 right-2 grid size-10 -translate-y-1/2 place-items-center rounded-full text-cacao/60 transition-colors hover:bg-crema-2 hover:text-selva-2"
          >
            {visible ? (
              <IconoOjoTachado className="size-5" />
            ) : (
              <IconoOjo className="size-5" />
            )}
          </button>
        )}
      </span>

      {/*
        El problema sustituye a la ayuda mientras dure. Los dos juntos son dos
        renglones de letra chica debajo del mismo campo, y el que importa es el
        que dice qué corregir.
      */}
      {problema ? (
        <span
          id={`${nombre}-problema`}
          className="mt-1.5 block text-sm font-bold text-guayaba"
        >
          {problema}
        </span>
      ) : (
        ayuda && (
          <span id={`${nombre}-ayuda`} className="mt-1.5 block text-sm text-cacao/70">
            {ayuda}
          </span>
        )
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
  problema,
}: {
  nombre: string;
  etiqueta: string;
  ayuda?: string;
  valor?: string | null;
  filas?: number;
  /** Tope de caracteres. Con él aparece el contador. */
  limite?: number;
  /** Qué está mal en este campo. Igual que en `Campo`. */
  problema?: string | null;
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
        aria-invalid={problema ? true : undefined}
        aria-describedby={problema ? `${nombre}-problema` : undefined}
        className={`w-full rounded-2xl border-2 bg-white px-4 py-3 text-base text-ink ${
          problema
            ? "border-guayaba focus:border-guayaba"
            : "border-selva/20 focus:border-selva"
        }`}
      />
      {problema ? (
        <span
          id={`${nombre}-problema`}
          className="mt-1.5 block text-sm font-bold text-guayaba"
        >
          {problema}
        </span>
      ) : (
        ayuda && <span className="mt-1.5 block text-sm text-cacao/70">{ayuda}</span>
      )}
      {limite && <Contador largo={largo} limite={limite} />}
    </label>
  );
}

export function Selector({
  nombre,
  etiqueta,
  opciones,
  valor,
  ayuda,
  requerido = true,
}: {
  nombre: string;
  etiqueta: string;
  opciones: { valor: string; texto: string }[];
  /** Lo que ya estaba guardado, para que editar no empiece en la primera opción. */
  valor?: string | null;
  ayuda?: string;
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
        defaultValue={valor ?? undefined}
        className="min-h-14 w-full rounded-2xl border-2 border-selva/20 bg-white px-4 text-base text-ink focus:border-selva"
      >
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.texto}
          </option>
        ))}
      </select>
      {ayuda && <span className="mt-1.5 block text-sm text-cacao/80">{ayuda}</span>}
    </label>
  );
}

/**
 * Una casilla de sí o no.
 *
 * El texto va **a la derecha** y dentro del mismo `<label>`, no encima como en
 * `Campo`: una etiqueta arriba y un cuadrito debajo se leen como dos cosas, y
 * lo que se toca con el dedo en un teléfono es el renglón entero.
 *
 * Ojo al leerla en el servidor: una casilla desmarcada **no viaja** en el
 * `FormData`. Quien la reciba tiene que tratar la ausencia como "no", no como
 * "no me lo mandaron, déjalo como estaba".
 */
export function Casilla({
  nombre,
  etiqueta,
  ayuda,
  marcada = false,
}: {
  nombre: string;
  etiqueta: string;
  ayuda?: string;
  marcada?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        name={nombre}
        defaultChecked={marcada}
        className="mt-0.5 size-5 shrink-0 accent-selva"
      />

      <span className="block">
        <span className="block font-bold text-selva-2">{etiqueta}</span>
        {ayuda && <span className="mt-1 block text-sm text-cacao/80">{ayuda}</span>}
      </span>
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
