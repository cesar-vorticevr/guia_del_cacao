"use client";

import { useActionState, useEffect, useState } from "react";
import { Aviso, BotonEnviar } from "@/components/formulario";
import {
  avisarRechazo,
  cancelarFestejo,
  festejarMonedas,
} from "@/components/negocio/avisos-de-monedas";
import {
  pedirPuntos,
  resolverSolicitud,
  type EstadoPuntos,
} from "@/lib/puntos/acciones";
import { pesos, type Producto } from "@/lib/tipos";

const INICIAL: EstadoPuntos = {};

/**
 * Rechazar, en el mismo hueco que guarda cuántas mazorcas se pulsaron.
 *
 * Es cero porque no se da ninguna, y así los cuatro botones se bloquean con la
 * misma comprobación mientras la decisión va y viene.
 */
const RECHAZO = 0;

/** El tope de la spec §5.4.6: 3 por persona, marca y día. */
const TOPE_DIARIO = 3;

function Resultado({ estado }: { estado: EstadoPuntos }) {
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
 * Una línea del menú: qué compró y cuánto.
 *
 * La cantidad solo aparece cuando el producto está marcado. Enseñar seis
 * contadores en cero al abrir el menú convierte una lista en un formulario, y
 * esto se usa de pie, en un stand, con una mano.
 */
function LineaProducto({
  producto,
  foto,
}: {
  producto: Producto;
  foto: string | null;
}) {
  const [elegido, setElegido] = useState(false);
  const [cantidad, setCantidad] = useState(1);

  const cambiar = (paso: number) =>
    setCantidad((actual) => Math.min(99, Math.max(1, actual + paso)));

  return (
    <li
      className={`rounded-2xl border-2 bg-white transition-colors ${
        elegido ? "border-selva bg-crema-2" : "border-selva/20"
      }`}
    >
      <label className="flex min-h-16 cursor-pointer items-center gap-4 p-4">
        <input
          type="checkbox"
          name="producto"
          value={producto.id}
          checked={elegido}
          onChange={(evento) => setElegido(evento.target.checked)}
          className="size-6 shrink-0 accent-selva"
        />

        {foto && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={foto}
            alt=""
            className="size-14 shrink-0 rounded-xl border-2 border-selva/10 object-cover"
          />
        )}

        <span className="min-w-0 flex-1">
          <span className="block font-bold text-selva-2">
            {producto.nombre}
          </span>
          {producto.descripcion && (
            <span className="block text-sm text-cacao">
              {producto.descripcion}
            </span>
          )}
        </span>

        {producto.precio !== null && (
          <span className="shrink-0 font-mono font-bold text-selva">
            {pesos(producto.precio)}
          </span>
        )}
      </label>

      {elegido && (
        <div className="flex items-center justify-between gap-4 border-t-2 border-selva/10 px-4 py-3">
          <span className="font-bold text-selva-2">¿Cuántos?</span>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => cambiar(-1)}
              aria-label={`Quitar uno de ${producto.nombre}`}
              className="grid size-12 place-items-center rounded-full border-2 border-selva/25 bg-white text-2xl font-bold text-selva-2"
            >
              −
            </button>

            {/*
              El número es un campo de verdad, no solo texto entre botones:
              quien compró doce no debería tener que picar doce veces.
            */}
            <input
              type="number"
              name={`cantidad-${producto.id}`}
              value={cantidad}
              min={1}
              max={99}
              onChange={(evento) =>
                setCantidad(
                  Math.min(99, Math.max(1, Number(evento.target.value) || 1)),
                )
              }
              aria-label={`Cuántos ${producto.nombre}`}
              className="min-h-12 w-16 rounded-2xl border-2 border-selva/20 bg-white text-center font-mono text-lg font-bold text-ink"
            />

            <button
              type="button"
              onClick={() => cambiar(1)}
              aria-label={`Agregar uno de ${producto.nombre}`}
              className="grid size-12 place-items-center rounded-full border-2 border-selva/25 bg-white text-2xl font-bold text-selva-2"
            >
              +
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

/**
 * Lo que ve el cliente después de escanear el QR o tocar el botón: elige qué
 * compró y cuánto de cada cosa.
 *
 * Casillas grandes a propósito: esto se usa de pie, en un stand, con una mano.
 */
export function FormularioPedirPuntos({
  sucursalId,
  slug,
  productos,
  fotos,
}: {
  sucursalId: string;
  slug: string;
  productos: Producto[];
  /** URL de la foto de cada producto, por id. Las arma el servidor. */
  fotos: Record<string, string | null>;
}) {
  const [estado, accion] = useActionState(pedirPuntos, INICIAL);

  return (
    <form action={accion} className="grid gap-4">
      <input type="hidden" name="sucursal_id" value={sucursalId} />
      <input type="hidden" name="slug" value={slug} />
      <Resultado estado={estado} />

      <fieldset className="grid gap-3">
        <legend className="mb-1 font-bold text-selva-2">¿Qué compraste?</legend>

        <ul className="grid gap-3">
          {productos.map((producto) => (
            <LineaProducto
              key={producto.id}
              producto={producto}
              foto={fotos[producto.id] ?? null}
            />
          ))}
        </ul>
      </fieldset>

      <BotonEnviar>Pedir mis mazorcas</BotonEnviar>
    </form>
  );
}

/**
 * Lo que ve la marca: aprueba con 1, 2 o 3 puntos, o rechaza.
 *
 * Los tres botones van a la vista, sin menú desplegable: quien atiende decide
 * en un segundo y no debería tener que abrir nada.
 */
export function BotonesResolver({
  solicitudId,
  sucursalId,
  sugeridas,
  cliente,
  dadasHoy,
}: {
  solicitudId: string;
  sucursalId: string;
  /**
   * Cuantas le tocan por lo que trae la solicitud: una por la compra, dos si
   * ademas dejo resena. Se marca ese boton para que quien atiende no tenga que
   * calcularlo, pero los tres siguen ahi: la tercera es cortesia del negocio.
   */
  sugeridas: number;
  /** A quién se le dan: el festejo lo dice por su nombre. */
  cliente: string;
  /**
   * Cuántas lleva ya hoy en esta marca.
   *
   * El tope son 3 por persona, marca y día. Al llegar, los botones se van en
   * vez de quedarse ahí para que la base los rechace: ofrecer algo que va a
   * fallar es peor que no ofrecerlo.
   */
  dadasHoy: number;
}) {
  const [estado, accion, pendiente] = useActionState(
    resolverSolicitud,
    INICIAL,
  );

  /** El botón que se acaba de pulsar, para que se note cuál fue. */
  const [pulsado, setPulsado] = useState<number | null>(null);

  // Cuál se está dando ahora mismo. Sale de `pendiente` y no de un estado
  // propio: así, al acabar, el botón vuelve solo sin tener que acordarse de
  // limpiarlo desde un efecto.
  const dando = pendiente ? pulsado : null;

  // Si la base rechaza lo que ya estábamos celebrando, se retira el festejo. El
  // festejo es de fuera de React —un aviso al `window`—, que es justo lo que un
  // efecto sirve para sincronizar.
  useEffect(() => {
    if (estado.error) cancelarFestejo();
  }, [estado.error]);

  /**
   * Cada opción va en su propio formulario, con la decisión en un campo oculto.
   *
   * No se usa `name`/`value` sobre el botón: React descarta esos atributos
   * cuando el botón lleva un `formAction` con función, porque los necesita para
   * codificar qué acción invocar. La decisión llegaría vacía y la solicitud se
   * quedaría pendiente sin que nadie entienda por qué.
   */
  const comunes = (
    <>
      <input type="hidden" name="solicitud_id" value={solicitudId} />
      <input type="hidden" name="sucursal_id" value={sucursalId} />
    </>
  );

  const cupo = Math.max(0, TOPE_DIARIO - dadasHoy);

  if (cupo === 0) {
    return (
      <p className="rounded-2xl border-2 border-mango/50 bg-mango/15 px-4 py-3 text-cacao">
        <strong className="text-selva-2">
          {cliente} ya recibió sus {TOPE_DIARIO} mazorcas de hoy
        </strong>{" "}
        en tu negocio. Esta solicitud se puede resolver mañana, cuando el tope
        vuelva a cero.
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      <Resultado estado={estado} />

      {/*
        Los tres de dar, en una fila para ellos solos. Con rechazar al lado eran
        cuatro botones repartiéndose media columna —la tarjeta va a dos por
        fila— y el número acababa partido en dos renglones.
      */}
      <div className="flex gap-2.5">
        {/*
          Solo las que caben en lo que le queda hoy. Si ya lleva dos, dar tres
          la rechazaría la base: el botón sobra.
        */}
        {[1, 2, 3]
          .filter((puntos) => puntos <= cupo)
          .map((puntos) => (
            <form
              key={puntos}
              action={accion}
              className="min-w-0 flex-1"
              /*
              El festejo arranca aquí, al enviar, y no cuando la acción
              responde: al responder, la lista se recarga sin esta solicitud y
              estos botones ya no existen para contarlo.
            */
              onSubmit={() => {
                setPulsado(puntos);
                festejarMonedas({ puntos, cliente });
              }}
            >
              {comunes}
              <input type="hidden" name="decision" value={String(puntos)} />
              {/*
              La que le toca no lleva letrero: va en verde, con su mazorca
              delante y un aro de color alrededor. "Le tocan" en letra chica
              debajo del número explicaba algo que el color ya dice, y encima
              hacía el botón sugerido más alto que los otros dos.
            */}
              <button
                type="submit"
                disabled={dando !== null}
                className={`flex min-h-14 w-full items-center justify-center gap-2 rounded-full px-5 font-display text-lg font-semibold transition-transform disabled:opacity-60 ${
                  dando === puntos
                    ? "scale-105 bg-lima text-ink disabled:opacity-100"
                    : puntos === sugeridas
                      ? "bg-selva text-crema ring-3 ring-mango active:translate-y-0.5"
                      : "border-2 border-selva/25 bg-white text-selva-2 active:translate-y-0.5"
                }`}
              >
                {(dando === puntos || puntos === sugeridas) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src="/marca/mazorca.png" alt="" className="size-6" />
                )}

                {dando === puntos ? (
                  "¡Va!"
                ) : (
                  <>
                    {puntos} {puntos === 1 ? "mazorca" : "mazorcas"}
                  </>
                )}
              </button>
            </form>
          ))}
      </div>

      {/*
        Rechazar va debajo y en letra pequeña: es la salida, no lo que se viene
        a hacer aquí. Deja su propia nota —discreta, abajo— por la misma razón
        que dar deja el festejo: la tarjeta se va con la recarga y sin eso la
        solicitud parecía esfumarse.
      */}
      <form
        action={accion}
        onSubmit={() => {
          setPulsado(RECHAZO);
          avisarRechazo(cliente);
        }}
      >
        {comunes}
        <input type="hidden" name="decision" value="rechazar" />
        <button
          type="submit"
          disabled={dando !== null}
          className="min-h-11 w-full rounded-full text-sm font-bold text-cacao/70 underline underline-offset-4 transition-colors hover:text-cacao disabled:opacity-60"
        >
          {dando === RECHAZO ? "Rechazando…" : "Rechazar esta solicitud"}
        </button>
      </form>
    </div>
  );
}
