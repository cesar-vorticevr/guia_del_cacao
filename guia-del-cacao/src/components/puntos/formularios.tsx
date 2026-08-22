"use client";

import { useActionState, useState } from "react";
import { Aviso, BotonEnviar } from "@/components/formulario";
import { pedirPuntos, resolverSolicitud, type EstadoPuntos } from "@/lib/puntos/acciones";
import { pesos, type Producto } from "@/lib/tipos";

const INICIAL: EstadoPuntos = {};

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
function LineaProducto({ producto, foto }: { producto: Producto; foto: string | null }) {
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
          <span className="block font-bold text-selva-2">{producto.nombre}</span>
          {producto.descripcion && (
            <span className="block text-sm text-cacao">{producto.descripcion}</span>
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
                setCantidad(Math.min(99, Math.max(1, Number(evento.target.value) || 1)))
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

      <BotonEnviar>Pedir mis monedas</BotonEnviar>
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
}: {
  solicitudId: string;
  sucursalId: string;
  /**
   * Cuantas le tocan por lo que trae la solicitud: una por la compra, dos si
   * ademas dejo resena. Se marca ese boton para que quien atiende no tenga que
   * calcularlo, pero los tres siguen ahi: la tercera es cortesia del negocio.
   */
  sugeridas: number;
}) {
  const [estado, accion] = useActionState(resolverSolicitud, INICIAL);

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

  return (
    <div className="grid gap-3">
      <Resultado estado={estado} />

      <div className="flex flex-wrap gap-2.5">
        {[1, 2, 3].map((puntos) => (
          <form key={puntos} action={accion} className="min-w-24 flex-1">
            {comunes}
            <input type="hidden" name="decision" value={String(puntos)} />
            <button
              type="submit"
              className={`min-h-14 w-full rounded-full px-5 font-display text-lg font-semibold ${
                puntos === sugeridas
                  ? "bg-selva text-crema"
                  : "border-2 border-selva/25 bg-white text-selva-2"
              }`}
            >
              {puntos} {puntos === 1 ? "moneda" : "monedas"}
              {puntos === sugeridas && (
                <span className="block text-xs font-normal">le tocan</span>
              )}
            </button>
          </form>
        ))}

        <form action={accion}>
          {comunes}
          <input type="hidden" name="decision" value="rechazar" />
          <button
            type="submit"
            className="min-h-14 rounded-full border-2 border-guayaba/50 px-5 font-bold text-cacao"
          >
            Rechazar
          </button>
        </form>
      </div>
    </div>
  );
}
