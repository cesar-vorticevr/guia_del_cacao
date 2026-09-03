"use client";

import { useActionState, useState } from "react";
import { Aviso, BotonEnviar } from "@/components/formulario";
import { SelectorEstrellas } from "@/components/publico/estrellas";
import { pedirPuntos, type EstadoPuntos } from "@/lib/puntos/acciones";
import { ACEPTA_MEDIO, PESO_MEDIO } from "@/lib/imagenes";
import { MONEDA } from "@/lib/vocabulario";
import { pesos, type Producto } from "@/lib/tipos";

const INICIAL: EstadoPuntos = {};

const PASOS = ["Tu compra", "Qué compraste", "Tu reseña"] as const;

/**
 * Pedir monedas, paso a paso.
 *
 * Los tres pasos van dentro de un solo formulario y solo se esconden con
 * `hidden`, no se desmontan: si se desmontaran, el archivo que ya eligió la
 * persona se perdería al avanzar y volver. Se envía una sola vez, al final.
 *
 * El QR ya se escaneó —a esta pantalla no se llega de otro modo—, así que el
 * primer paso no lo pide otra vez: ofrece la foto del ticket, que es opcional y
 * sirve para que le crean, no como requisito.
 */
export function PedirMazorcas({
  sucursalId,
  slug,
  negocio,
  productos,
  fotos,
  puedeResenar,
  misEstrellas,
}: {
  sucursalId: string;
  slug: string;
  negocio: string;
  productos: Producto[];
  fotos: Record<string, string | null>;
  /** Falso si ya comentó hoy aquí: entonces la mazorca extra no está en juego. */
  puedeResenar: boolean;
  /** Las estrellas que ya le dio a este negocio, para no empezar de cero. */
  misEstrellas: number | null;
}) {
  const [estado, accion] = useActionState(pedirPuntos, INICIAL);
  const [paso, setPaso] = useState(0);
  const [elegidos, setElegidos] = useState<Record<string, number>>({});
  const [conFoto, setConFoto] = useState(false);
  const [resena, setResena] = useState("");
  const [estrellas, setEstrellas] = useState(misEstrellas ?? 0);

  const cuantos = Object.keys(elegidos).length;
  const monedas = 1 + (puedeResenar && resena.trim().length >= 10 ? 1 : 0);

  const marcar = (id: string, marcado: boolean) =>
    setElegidos((previo) => {
      const copia = { ...previo };
      if (marcado) copia[id] = copia[id] ?? 1;
      else delete copia[id];
      return copia;
    });

  const cambiarCantidad = (id: string, cantidad: number) =>
    setElegidos((previo) => ({
      ...previo,
      [id]: Math.min(99, Math.max(1, cantidad)),
    }));

  return (
    <form action={accion} className="grid gap-5">
      <input type="hidden" name="sucursal_id" value={sucursalId} />
      <input type="hidden" name="slug" value={slug} />

      <ol className="flex gap-2" aria-label="Pasos">
        {PASOS.map((nombre, i) => (
          <li key={nombre} className="min-w-0 flex-1">
            <span
              aria-current={i === paso ? "step" : undefined}
              className={`block truncate rounded-full px-3 py-1.5 text-center text-xs font-bold ${
                i === paso
                  ? "bg-selva text-crema"
                  : i < paso
                    ? "bg-lima/40 text-selva-2"
                    : "bg-crema-2 text-cacao/60"
              }`}
            >
              {i + 1}. {nombre}
            </span>
          </li>
        ))}
      </ol>

      {estado.error && <Aviso>{estado.error}</Aviso>}

      {/* ---------------------------------------------------------------- 1 */}
      <div hidden={paso !== 0} className="grid gap-4">
        <div className="rounded-3xl border-2 border-lima/50 bg-lima/15 p-5">
          <p className="font-display text-lg font-semibold text-selva-2">
            Escaneaste el código de {negocio}
          </p>
          <p className="mt-1 text-cacao">
            Con eso basta para pedir tus {MONEDA.plural}. Si quieres, agrega una
            foto o un video de tu ticket: le ayuda al negocio a resolverlo más
            rápido.
          </p>
        </div>

        <div className="grid gap-2">
          <span className="font-bold text-selva-2">
            Foto o video del ticket{" "}
            <span className="font-normal text-cacao/70">(opcional)</span>
          </span>

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-full border-2 border-selva/25 bg-white px-5 font-bold text-selva-2">
              Abrir la cámara
              <input
                type="file"
                name="comprobante"
                accept={ACEPTA_MEDIO}
                capture="environment"
                onChange={(evento) =>
                  setConFoto(evento.target.files!.length > 0)
                }
                className="sr-only"
              />
            </label>

            <label className="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-full border-2 border-selva/25 bg-white px-5 font-bold text-selva-2">
              Subir una foto
              <input
                type="file"
                name="comprobante_archivo"
                accept={ACEPTA_MEDIO}
                onChange={(evento) =>
                  setConFoto(evento.target.files!.length > 0)
                }
                className="sr-only"
              />
            </label>
          </div>

          <p className="text-sm text-cacao/70">{PESO_MEDIO}</p>
          {conFoto && (
            <p role="status" className="text-sm font-bold text-selva-2">
              Listo. Se manda con tu solicitud.
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => setPaso(1)}
          className="min-h-14 rounded-full bg-selva px-6 font-display text-lg font-semibold text-crema"
        >
          Siguiente
        </button>
      </div>

      {/* ---------------------------------------------------------------- 2 */}
      <div hidden={paso !== 1} className="grid gap-4">
        <fieldset className="grid gap-3">
          <legend className="mb-1 font-bold text-selva-2">
            ¿Qué compraste?
          </legend>

          <ul className="grid gap-3">
            {productos.map((producto) => {
              const marcado = producto.id in elegidos;

              return (
                <li
                  key={producto.id}
                  className={`rounded-2xl border-2 bg-white transition-colors ${
                    marcado ? "border-selva bg-crema-2" : "border-selva/20"
                  }`}
                >
                  <label className="flex min-h-16 cursor-pointer items-center gap-4 p-4">
                    <input
                      type="checkbox"
                      name="producto"
                      value={producto.id}
                      checked={marcado}
                      onChange={(evento) =>
                        marcar(producto.id, evento.target.checked)
                      }
                      className="size-6 shrink-0 accent-selva"
                    />

                    {fotos[producto.id] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={fotos[producto.id]!}
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

                  {marcado && (
                    <div className="flex items-center justify-between gap-4 border-t-2 border-selva/10 px-4 py-3">
                      <span className="font-bold text-selva-2">¿Cuántos?</span>

                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            cambiarCantidad(
                              producto.id,
                              elegidos[producto.id] - 1,
                            )
                          }
                          aria-label={`Quitar uno de ${producto.nombre}`}
                          className="grid size-12 place-items-center rounded-full border-2 border-selva/25 bg-white text-2xl font-bold text-selva-2"
                        >
                          −
                        </button>

                        <input
                          type="number"
                          name={`cantidad-${producto.id}`}
                          value={elegidos[producto.id]}
                          min={1}
                          max={99}
                          onChange={(evento) =>
                            cambiarCantidad(
                              producto.id,
                              Number(evento.target.value) || 1,
                            )
                          }
                          aria-label={`Cuántos ${producto.nombre}`}
                          className="min-h-12 w-16 rounded-2xl border-2 border-selva/20 bg-white text-center font-mono text-lg font-bold text-ink"
                        />

                        <button
                          type="button"
                          onClick={() =>
                            cambiarCantidad(
                              producto.id,
                              elegidos[producto.id] + 1,
                            )
                          }
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
            })}
          </ul>
        </fieldset>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPaso(0)}
            className="min-h-14 rounded-full border-2 border-selva/25 bg-white px-5 font-bold text-selva-2"
          >
            Atrás
          </button>

          <button
            type="button"
            onClick={() => setPaso(2)}
            disabled={cuantos === 0}
            className="min-h-14 flex-1 rounded-full bg-selva px-6 font-display text-lg font-semibold text-crema disabled:opacity-50"
          >
            {cuantos === 0 ? "Elige al menos uno" : "Siguiente"}
          </button>
        </div>
      </div>

      {/* ---------------------------------------------------------------- 3 */}
      <div hidden={paso !== 2} className="grid gap-4">
        {puedeResenar ? (
          <>
            <div className="rounded-3xl bg-mango/20 p-5">
              <p className="font-display text-lg font-semibold text-ink">
                ¿Nos cuentas cómo te fue?
              </p>
              <p className="mt-1 text-cacao">
                Es opcional, pero si dejas reseña el negocio te puede dar una{" "}
                {MONEDA.singular} extra.
              </p>
            </div>

            <div>
              <SelectorEstrellas
                inicial={misEstrellas ?? 0}
                alCambiar={setEstrellas}
              />
              <p className="mt-1.5 text-sm text-cacao/70">
                Tu nota arma el promedio del negocio. Puedes cambiarla después.
              </p>
            </div>

            <label className="block">
              <span className="mb-1.5 block font-bold text-selva-2">
                Tu reseña
              </span>
              <textarea
                name="resena"
                rows={4}
                value={resena}
                onChange={(evento) => setResena(evento.target.value)}
                placeholder="¿Qué probaste? ¿Cómo te atendieron?"
                className="w-full rounded-2xl border-2 border-selva/20 bg-white px-4 py-3 text-base text-ink placeholder:text-cacao/40 focus:border-selva"
              />

              {/*
                Sin estrellas no hay reseña: lo rechaza la base, y decirlo aquí
                evita que quien escribió un párrafo se entere al enviarlo. La
                reseña sigue siendo opcional; lo que no cabe es dejarla suelta,
                sin nota, porque entonces no suma al promedio de nadie.
              */}
              {resena.trim().length >= 10 && estrellas === 0 && (
                <span
                  role="status"
                  className="mt-2 block rounded-2xl border-2 border-mango/50 bg-mango/15 px-4 py-2.5 text-cacao"
                >
                  Ponle estrellas aquí arriba para que tu reseña cuente.
                </span>
              )}
            </label>
          </>
        ) : (
          <p className="rounded-3xl bg-crema-2 p-5 text-cacao">
            Ya dejaste una reseña hoy en este negocio, así que esta vez la{" "}
            {MONEDA.singular} extra no aplica. Tu solicitud sigue valiendo una.
          </p>
        )}

        <div className="rounded-3xl border-2 border-selva/20 bg-white p-5">
          <p className="font-bold text-selva-2">Vas a pedir</p>
          <p className="mt-1 font-mono text-3xl font-bold text-selva">
            {monedas} {monedas === 1 ? MONEDA.unaCorta : MONEDA.variasCortas}
          </p>
          <p className="mt-1 text-sm text-cacao/70">
            {monedas === 1
              ? "Una por tu compra."
              : "Una por tu compra y otra por la reseña."}{" "}
            El negocio decide al final, y puede darte una más si quiere.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPaso(1)}
            className="min-h-14 rounded-full border-2 border-selva/25 bg-white px-5 font-bold text-selva-2"
          >
            Atrás
          </button>

          <span className="min-w-48 flex-1">
            <BotonEnviar>Enviar mi solicitud</BotonEnviar>
          </span>
        </div>
      </div>
    </form>
  );
}
