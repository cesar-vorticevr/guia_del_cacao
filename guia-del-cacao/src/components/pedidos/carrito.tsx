"use client";

import { useActionState, useState } from "react";
import { createPortal } from "react-dom";
import { Aviso } from "@/components/formulario";
import { hacerPedido, type EstadoPedido } from "@/lib/pedidos/acciones";
import { MAX_PIEZAS } from "@/lib/pedidos/textos";
import { pesos } from "@/lib/tipos";

const INICIAL: EstadoPedido = {};

export type Carrito = Record<string, number>;

/** Los botones de una tarjeta del catálogo: «Agregar», y luego − n +. */
export function BotonAgregar({
  cantidad,
  alCambiar,
  nombre,
}: {
  cantidad: number;
  alCambiar: (cantidad: number) => void;
  nombre: string;
}) {
  if (cantidad === 0) {
    return (
      <button
        type="button"
        onClick={() => alCambiar(1)}
        className="mt-2 min-h-10 w-full rounded-full border-2 border-mango/50 bg-white text-sm font-bold text-selva-2 transition-colors hover:border-mango hover:text-mango"
      >
        Agregar
      </button>
    );
  }

  return (
    <span className="mt-2 flex min-h-10 items-center justify-between rounded-full bg-mango/90 px-1 text-ink">
      <button
        type="button"
        onClick={() => alCambiar(cantidad - 1)}
        aria-label={`Quitar un ${nombre}`}
        className="grid size-8 place-items-center rounded-full text-lg font-bold hover:bg-white/50"
      >
        −
      </button>
      <span className="font-mono font-bold" aria-live="polite">
        {cantidad}
      </span>
      <button
        type="button"
        onClick={() => alCambiar(Math.min(cantidad + 1, MAX_PIEZAS))}
        aria-label={`Agregar otro ${nombre}`}
        className="grid size-8 place-items-center rounded-full text-lg font-bold hover:bg-white/50"
      >
        +
      </button>
    </span>
  );
}

/**
 * La barra del pedido, pegada abajo mientras haya algo elegido, y el
 * formulario para mandarlo.
 *
 * Lo que se dice aquí importa más que lo que se pide: **no se paga todavía**.
 * El negocio primero confirma que lo tiene y fija el total; hasta entonces
 * el cliente no ve a dónde transferir. Y el dinero va directo al negocio: la
 * Guía no cobra ni lo guarda.
 */
export function BarraDelPedido({
  sucursalId,
  slug,
  negocio,
  productos,
  carrito,
  alVaciar,
}: {
  sucursalId: string;
  slug: string;
  negocio: string;
  productos: { id: string; nombre: string; precio: number | null }[];
  carrito: Carrito;
  alVaciar: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [entrega, setEntrega] = useState<"recoger" | "envio">("recoger");
  const [estado, accion, enviando] = useActionState(hacerPedido, INICIAL);
  // Si el envío falla, la dirección y la nota vuelven a su campo: React 19
  // vacía el formulario al terminar la acción (ver AGENTS.md).
  const [vuelta, setVuelta] = useState(0);
  const [ultimo, setUltimo] = useState(estado);

  if (estado !== ultimo) {
    setUltimo(estado);
    setVuelta((v) => v + 1);
  }

  const elegidos = productos
    .filter((p) => (carrito[p.id] ?? 0) > 0)
    .map((p) => ({ ...p, cantidad: carrito[p.id] }));

  if (elegidos.length === 0) return null;

  const piezas = elegidos.reduce((suma, p) => suma + p.cantidad, 0);
  const subtotal = elegidos.reduce((suma, p) => suma + (p.precio ?? 0) * p.cantidad, 0);
  const sinPrecio = elegidos.some((p) => p.precio === null);

  return (
    <>
      <div className="fixed inset-x-0 bottom-20 z-30 px-4 sm:bottom-4">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3 rounded-full border-2 border-mango/60 bg-white py-2 pr-2 pl-5 shadow-[0_0_40px_rgb(255_183_3/0.25)]">
          <span className="min-w-0 text-cacao">
            <strong className="text-selva-2">
              {piezas} {piezas === 1 ? "pieza" : "piezas"}
            </strong>{" "}
            · <span className="font-mono font-bold">{pesos(subtotal)}</span>
            {sinPrecio && <span className="text-sm"> + por confirmar</span>}
          </span>
          <button
            type="button"
            onClick={() => setAbierto(true)}
            className="boton-oro brillo min-h-12 shrink-0 rounded-full px-5 font-display text-lg font-semibold text-ink"
          >
            Hacer pedido
          </button>
        </div>
      </div>

      {/*
        El diálogo va por portal al `body`: dentro del `main` (que es
        `relative z-10`) quedaba debajo del encabezado del sitio.
      */}
      {abierto && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-pedido"
          className="fixed inset-0 z-50 grid place-items-end bg-ink/60 p-0 sm:place-items-center sm:p-4"
          onClick={(evento) => {
            if (evento.target === evento.currentTarget) setAbierto(false);
          }}
        >
          <form
            action={accion}
            className="grid max-h-[92vh] w-full max-w-lg gap-4 overflow-y-auto rounded-t-3xl bg-white p-5 text-cacao sm:rounded-3xl"
          >
            <input type="hidden" name="sucursal_id" value={sucursalId} />
            <input type="hidden" name="slug" value={slug} />
            <input
              type="hidden"
              name="productos"
              value={JSON.stringify(elegidos.map((p) => ({ producto_id: p.id, cantidad: p.cantidad })))}
            />

            <div className="flex items-start justify-between gap-3">
              <h2 id="titulo-pedido" className="font-display text-2xl text-selva-2">
                Tu pedido a {negocio}
              </h2>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                aria-label="Cerrar"
                className="grid size-10 shrink-0 place-items-center rounded-full text-xl hover:bg-crema-2"
              >
                ×
              </button>
            </div>

            <ul className="grid gap-1.5">
              {elegidos.map((p) => (
                <li key={p.id} className="flex justify-between gap-3">
                  <span>
                    {p.cantidad} × {p.nombre}
                  </span>
                  <span className="shrink-0 font-mono">
                    {p.precio === null ? "por confirmar" : pesos(p.precio * p.cantidad)}
                  </span>
                </li>
              ))}
              <li className="mt-1 flex justify-between gap-3 border-t-2 border-ink/10 pt-2 font-bold text-selva-2">
                <span>Subtotal</span>
                <span className="font-mono">{pesos(subtotal)}</span>
              </li>
            </ul>

            <fieldset className="grid gap-2">
              <legend className="mb-1.5 font-bold text-selva-2">¿Cómo te lo llevas?</legend>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ["recoger", "Lo recojo"],
                    ["envio", "Que me lo envíen"],
                  ] as const
                ).map(([valor, texto]) => (
                  <label
                    key={valor}
                    className={`flex min-h-12 cursor-pointer items-center justify-center rounded-2xl border-2 px-3 text-center font-bold ${
                      entrega === valor ? "border-selva bg-selva/10 text-selva-2" : "border-selva/20"
                    }`}
                  >
                    <input
                      type="radio"
                      name="entrega"
                      value={valor}
                      checked={entrega === valor}
                      onChange={() => setEntrega(valor)}
                      className="sr-only"
                    />
                    {texto}
                  </label>
                ))}
              </div>
            </fieldset>

            {entrega === "envio" && (
              <label className="block">
                <span className="mb-1.5 block font-bold text-selva-2">¿A dónde?</span>
                <textarea
                  key={vuelta}
                  defaultValue={estado.valores?.direccion}
                  name="direccion"
                  rows={2}
                  required
                  minLength={10}
                  maxLength={300}
                  placeholder="Calle, número, colonia, ciudad"
                  className="w-full rounded-2xl border-2 border-selva/20 bg-white px-4 py-3 text-base text-ink focus:border-selva"
                />
                <span className="mt-1 block text-sm text-cacao/70">
                  El negocio te dice cuánto cuesta el envío al confirmar.
                </span>
              </label>
            )}

            <label className="block">
              <span className="mb-1.5 block font-bold text-selva-2">Nota (opcional)</span>
              <textarea
                key={vuelta}
                defaultValue={estado.valores?.nota}
                name="nota"
                rows={2}
                maxLength={500}
                placeholder="Para cuándo lo quieres, si es regalo…"
                className="w-full rounded-2xl border-2 border-selva/20 bg-white px-4 py-3 text-base text-ink focus:border-selva"
              />
            </label>

            <p className="rounded-2xl bg-crema-2 p-4 text-sm">
              <strong className="text-selva-2">Todavía no pagas.</strong> El negocio confirma
              que lo tiene y te dice el total; entonces te llegan sus datos para transferirle
              directo. La Guía del Cacao no cobra ni guarda tu dinero.
            </p>

            {estado.error && <Aviso>{estado.error}</Aviso>}

            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <button
                type="submit"
                disabled={enviando}
                className="boton-oro brillo min-h-14 rounded-full px-6 font-display text-lg font-semibold text-ink disabled:opacity-60"
              >
                {enviando ? "Mandando…" : "Mandar pedido"}
              </button>
              <button
                type="button"
                onClick={() => {
                  alVaciar();
                  setAbierto(false);
                }}
                className="min-h-14 rounded-full px-5 font-bold text-cacao/70 hover:text-guayaba"
              >
                Vaciar
              </button>
            </div>
          </form>
        </div>,
        document.body,
      )}
    </>
  );
}
