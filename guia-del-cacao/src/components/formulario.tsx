"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { IconoOjo, IconoOjoTachado } from "@/components/iconos";
import { useAcomodo } from "@/components/publico/ajustar-foto";
import { ACEPTA, PESO } from "@/lib/imagenes";

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
 * Un campo de foto que se acomoda antes de subirse.
 *
 * Sustituye a los `<input type="file">` sueltos que había repartidos por los
 * formularios —logo, fondo, galería, evento, noticia, producto, cupón,
 * reseña—, todos con la misma clase copiada y todos con el mismo problema: la
 * foto se subía como saliera y el servidor la recortaba centrada. Quien subía
 * un logo con el texto abajo lo veía decapitado en el directorio y no tenía
 * nada que hacer al respecto.
 *
 * `proporcion` es la forma con la que esa foto se va a ver de verdad, sacada de
 * `PROPORCIONES`. Es el marco que se enseña al acomodar y es lo que se recorta:
 * si aquí se pusiera un número distinto del de la pantalla que la pinta, el
 * encuadre volvería a ser una promesa que no se cumple.
 *
 * `autoEnviar` es para los campos del panel que suben en cuanto se elige, sin
 * botón. Ahí el envío espera a que el encuadre se cierre: mandar la foto sin
 * acomodar y acomodarla después sería subirla dos veces.
 */
export function CampoFoto({
  nombre,
  etiqueta,
  proporcion,
  ayuda,
  acepta = ACEPTA,
  peso = PESO,
  requerido = false,
  varias = false,
  autoEnviar = false,
  clase = "block",
  id,
}: {
  nombre: string;
  etiqueta?: React.ReactNode;
  /** Ancho entre alto del sitio donde se va a ver. Sale de `PROPORCIONES`. */
  proporcion: number;
  ayuda?: React.ReactNode;
  /** Por si el campo acepta video, como el de las reseñas. */
  acepta?: string;
  /** El tope de peso que le toca decir. El del video es otro. */
  peso?: string | null;
  requerido?: boolean;
  varias?: boolean;
  /** Elegir el archivo es la orden: se sube solo, sin botón aparte. */
  autoEnviar?: boolean;
  id?: string;
  /**
   * Cómo se coloca la etiqueta entera.
   *
   * Casi siempre es un bloque debajo de su título, pero en la lista de
   * publicaciones el campo va en un renglón junto a su botón, y ahí tiene que
   * poder encogerse con los demás.
   */
  clase?: string;
}) {
  // Vive dentro del `<form>`, así que puede saber si el envío está en curso.
  const { pending } = useFormStatus();

  /*
    En piezas, no como `acomodo.algo`: al pasar una de ellas a `ref`, el lint de
    React da por contagiado el objeto entero y se queja de todo lo demás que se
    lea al pintar.
  */
  const { campo, previos, empezar, limpiar, acomodarUna, pedirEnvio, encuadre } =
    useAcomodo(proporcion, autoEnviar ? enviar : undefined);

  function enviar() {
    pedirEnvio();
  }

  function alElegir(evento: React.ChangeEvent<HTMLInputElement>) {
    const elegidos = [...(evento.target.files ?? [])];

    if (elegidos.length === 0) {
      limpiar();
      return;
    }

    /*
      Un video no se recorta —aquí no hay nada que lo recodifique—, así que el
      encuadre no llega a abrirse y el envío no debe quedarse esperándolo.
    */
    if (!empezar(elegidos) && autoEnviar) enviar();
  }

  return (
    <label className={clase}>
      {etiqueta && (
        <span className="mb-1.5 block font-bold text-selva-2">{etiqueta}</span>
      )}

      <input
        ref={campo}
        id={id}
        type="file"
        name={nombre}
        accept={acepta}
        multiple={varias}
        required={requerido}
        onChange={alElegir}
        /*
          El campo no se deshabilita mientras sube, aunque se vea la tentación:
          un campo deshabilitado no se serializa, y hacerlo aquí correría el
          riesgo de mandar el formulario sin el archivo.
        */
        className="w-full rounded-2xl border-2 border-dashed border-selva/25 bg-white px-4 py-3 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-selva file:px-4 file:py-2 file:font-bold file:text-crema"
      />

      {encuadre}

      {/*
        La vista previa solo donde la foto espera a un botón. En los campos que
        suben solos, un segundo después la página ya enseña la foto de verdad,
        ya guardada: dejar aquí la miniatura sería enseñar la misma foto dos
        veces y que la de abajo pareciera otra.
      */}
      {!autoEnviar && previos.length > 0 && (
        <span className="mt-2 flex flex-wrap gap-2">
          {previos.map((previo, i) => (
            <span key={previo.url} className="relative block w-40">
              {previo.esVideo ? (
                <video
                  src={previo.url}
                  muted
                  playsInline
                  preload="metadata"
                  style={{ aspectRatio: `${proporcion}`, objectFit: "cover" }}
                  className="w-full rounded-xl border-2 border-selva/15 bg-ink"
                />
              ) : (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previo.url}
                    alt={`Vista previa ${i + 1}`}
                    style={{ aspectRatio: `${proporcion}`, objectFit: "cover" }}
                    className="w-full rounded-xl border-2 border-selva/15 bg-crema-2"
                  />

                  <button
                    type="button"
                    onClick={() => acomodarUna(i)}
                    className="absolute right-1 bottom-1 min-h-11 rounded-full bg-ink/70 px-3 text-sm font-bold text-crema"
                  >
                    Acomodar
                  </button>
                </>
              )}
            </span>
          ))}
        </span>
      )}

      {autoEnviar && pending ? (
        <span role="status" className="mt-1.5 block text-sm font-bold text-selva">
          Subiendo…
        </span>
      ) : (
        <>
          {ayuda && (
            <span className="mt-1.5 block text-sm text-cacao/70">{ayuda}</span>
          )}
          {peso && (
            <span className="block text-sm text-cacao/70">{peso}</span>
          )}
        </>
      )}
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
