"use client";

import { useActionState } from "react";
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
 * Lo que ve el cliente después de escanear el QR: elige qué compró.
 *
 * Casillas grandes a propósito: esto se usa de pie, en un stand, con una mano.
 */
export function FormularioPedirPuntos({
  sucursalId,
  slug,
  productos,
}: {
  sucursalId: string;
  slug: string;
  productos: Producto[];
}) {
  const [estado, accion] = useActionState(pedirPuntos, INICIAL);

  return (
    <form action={accion} className="grid gap-4">
      <input type="hidden" name="sucursal_id" value={sucursalId} />
      <input type="hidden" name="slug" value={slug} />
      <Resultado estado={estado} />

      <fieldset className="grid gap-3">
        <legend className="mb-1 font-bold text-selva-2">¿Qué compraste?</legend>

        {productos.map((producto) => (
          <label
            key={producto.id}
            className="flex min-h-16 cursor-pointer items-center gap-4 rounded-2xl border-2 border-selva/20 bg-white p-4 has-[:checked]:border-selva has-[:checked]:bg-crema-2"
          >
            <input
              type="checkbox"
              name="producto"
              value={producto.id}
              className="size-6 shrink-0 accent-selva"
            />
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
        ))}
      </fieldset>

      <BotonEnviar>Pedir mis puntos</BotonEnviar>
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
}: {
  solicitudId: string;
  sucursalId: string;
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
              className="min-h-14 w-full rounded-full bg-selva px-5 font-display text-lg font-semibold text-crema"
            >
              {puntos} {puntos === 1 ? "punto" : "puntos"}
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
