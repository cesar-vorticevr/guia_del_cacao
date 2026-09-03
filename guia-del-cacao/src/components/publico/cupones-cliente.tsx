"use client";

import { useActionState } from "react";
import { canjearCupon, type EstadoCanje } from "@/lib/publico/canjes";
import { festejarMonedas } from "@/components/negocio/avisos-de-monedas";
import { MONEDA } from "@/lib/vocabulario";

const INICIAL: EstadoCanje = {};

/** Un cupón que se puede canjear, con lo que cuesta y el botón. */
export function CuponDisponible({
  cupon,
  /** Cuántas mazorcas tiene quien mira. */
  saldo,
  haySesion,
  esCliente,
}: {
  cupon: {
    id: string;
    nombre: string;
    descripcion: string;
    costo: number;
    imagen: string | null;
    marca: string;
    sucursal: string;
    vigenciaTexto: string;
    yaEsMio: boolean;
  };
  saldo: number;
  haySesion: boolean;
  esCliente: boolean;
}) {
  const [estado, accion, pendiente] = useActionState(canjearCupon, INICIAL);

  const alcanza = saldo >= cupon.costo;
  const mio = cupon.yaEsMio || Boolean(estado.ok);

  return (
    <li className="grid content-start overflow-hidden rounded-3xl bg-crema-2">
      {cupon.imagen ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={cupon.imagen}
          alt=""
          className="aspect-square w-full object-cover"
          loading="lazy"
        />
      ) : (
        <span
          aria-hidden="true"
          className="grid aspect-square w-full place-items-center bg-white font-display text-4xl text-selva-2"
        >
          {cupon.nombre.charAt(0)}
        </span>
      )}

      <div className="grid gap-3 p-5">
        <div>
          <p className="font-mono text-xs tracking-wide text-cacao/70 uppercase">
            Hasta el {cupon.vigenciaTexto}
          </p>
          <p className="mt-1 font-display text-xl font-semibold text-selva-2">
            {cupon.nombre}
          </p>
          <p className="text-cacao">
            {cupon.marca}
            {cupon.sucursal && (
              <span className="text-cacao/70"> · {cupon.sucursal}</span>
            )}
          </p>
        </div>

        <p className="text-cacao">{cupon.descripcion}</p>

        <p className="flex items-center gap-2 font-display text-lg font-semibold text-selva">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/marca/mazorca.png" alt="" className="size-6" />
          {cupon.costo}{" "}
          {cupon.costo === 1 ? MONEDA.unaCorta : MONEDA.variasCortas}
        </p>

        {estado.error && (
          <p
            role="alert"
            className="rounded-2xl border-2 border-guayaba/40 bg-guayaba/10 px-4 py-2.5 text-cacao"
          >
            {estado.error}
          </p>
        )}

        {mio ? (
          <p className="rounded-full border-2 border-lima/60 bg-lima/20 px-4 py-2.5 text-center font-bold text-selva-2">
            Ya es tuyo
          </p>
        ) : (
          <form
            action={accion}
            onSubmit={() => {
              // El festejo arranca al pulsar, como al dar mazorcas: al responder
              // la página se recarga y este botón ya no está para contarlo.
              if (alcanza && esCliente) {
                festejarMonedas({ puntos: 0, cliente: cupon.nombre });
              }
            }}
          >
            <input type="hidden" name="cupon_id" value={cupon.id} />

            {/*
              Cuando no alcanza, el botón se queda pero apagado y diciendo qué
              falta: escondido, quien mira no sabría si el cupón es para él.
            */}
            <button
              type="submit"
              disabled={!haySesion || !esCliente || !alcanza || pendiente}
              className={`min-h-12 w-full rounded-full px-5 font-bold transition-transform ${
                haySesion && esCliente && alcanza
                  ? "bg-selva text-crema active:translate-y-0.5"
                  : "border-2 border-selva/20 bg-white text-cacao/60"
              }`}
            >
              {!haySesion
                ? "Entra para canjear"
                : !esCliente
                  ? "Solo cuentas de cliente"
                  : alcanza
                    ? "Canjear"
                    : `Te faltan ${cupon.costo - saldo}`}
            </button>
          </form>
        )}
      </div>
    </li>
  );
}
