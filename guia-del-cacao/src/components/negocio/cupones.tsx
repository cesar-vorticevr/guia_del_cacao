"use client";

import { useActionState, useState } from "react";
import { Area, Aviso, BotonEnviar, Campo } from "@/components/formulario";
import {
  borrarCupon,
  crearCupon,
  type EstadoCupon,
} from "@/lib/negocio/cupones";
import type { Cupon } from "@/lib/datos/cupones";
import { ACEPTA, MEDIDAS, PESO } from "@/lib/imagenes";
import { MONEDA } from "@/lib/vocabulario";

const INICIAL: EstadoCupon = {};

/**
 * El alta de un cupón, plegada tras un botón.
 *
 * Abierta ocupaba más pantalla que los cupones mismos, y quien entra a mirar
 * los suyos no venía a llenar un formulario.
 */
export function NuevoCupon({
  sucursales,
  quedan,
  hoy,
}: {
  sucursales: { id: string; nombre_sucursal: string }[];
  /** Cuántos le caben todavía de los diez. */
  quedan: number;
  /** Hoy en Tabasco, para que el calendario no ofrezca ayer. */
  hoy: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion] = useActionState(crearCupon, INICIAL);

  if (quedan === 0) {
    return (
      <p className="max-w-2xl rounded-3xl border-2 border-mango/50 bg-mango/15 p-5 text-cacao">
        <strong className="text-selva-2">Tienes los 10 vigentes.</strong> Espera
        a que caduque alguno o borra uno para publicar otro. Los caducados no
        ocupan lugar.
      </p>
    );
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="min-h-12 w-fit rounded-full bg-selva px-6 font-bold text-crema shadow-dura-sm transition-transform active:translate-y-0.5"
      >
        Nuevo cupón
      </button>
    );
  }

  return (
    <form
      action={accion}
      className="grid max-w-2xl gap-4 rounded-3xl bg-crema-2 p-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="font-display text-xl">Nuevo cupón</h3>
        <span className="font-mono text-sm text-cacao/70">
          te quedan {quedan} de 10
        </span>
      </div>

      {estado.error && <Aviso>{estado.error}</Aviso>}

      {estado.ok && (
        <p
          role="status"
          className="rounded-2xl border-2 border-lima/50 bg-lima/15 px-4 py-3 font-bold text-selva-2"
        >
          {estado.ok}
        </p>
      )}

      <Campo nombre="nombre" etiqueta="Nombre del cupón" limite={80} />

      <label className="block">
        <span className="mb-1.5 block font-bold text-selva-2">
          Sucursal que lo ofrece
        </span>
        <select
          name="sucursal_id"
          className="min-h-14 w-full rounded-2xl border-2 border-selva/20 bg-white px-4 text-base text-ink"
        >
          {sucursales.map((sucursal) => (
            <option key={sucursal.id} value={sucursal.id}>
              {sucursal.nombre_sucursal}
            </option>
          ))}
        </select>
      </label>

      <Area
        nombre="descripcion"
        etiqueta="Descripción de la oferta"
        ayuda="Qué se lleva exactamente y con qué condiciones."
        limite={400}
        filas={4}
      />

      <Campo
        nombre="costo_mazorcas"
        etiqueta={`Costo en ${MONEDA.plural}`}
        tipo="number"
        ayuda="De 1 a 999."
      />

      <label className="block">
        <span className="mb-1.5 block font-bold text-selva-2">
          Vigencia{" "}
          <span className="font-normal text-cacao">· último día que sirve</span>
        </span>
        <input
          type="date"
          name="vigencia"
          min={hoy}
          defaultValue=""
          className="min-h-14 w-full rounded-2xl border-2 border-selva/20 bg-white px-4 text-base text-ink"
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block font-bold text-selva-2">Imagen</span>
        <input
          type="file"
          name="imagen"
          accept={ACEPTA}
          className="w-full rounded-2xl border-2 border-dashed border-selva/25 bg-white px-4 py-3 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-selva file:px-4 file:py-2 file:font-bold file:text-crema"
        />
        <span className="mt-1.5 block text-sm text-cacao/70">
          {MEDIDAS.cupon}
        </span>
        <span className="block text-sm text-cacao/70">{PESO}</span>
      </label>

      {/*
        Se avisa antes de publicar y no después: un cupón no se puede corregir
        porque alguien pudo canjearlo ya, y enterarse de eso al querer cambiar
        una errata es tarde.
      */}
      <p className="rounded-2xl border-2 border-selva/20 bg-white px-4 py-3 text-cacao">
        <strong className="text-selva-2">
          Revísalo bien antes de publicar.
        </strong>{" "}
        Un cupón no se puede editar: alguien puede canjearlo en cuanto salga, y
        cambiarle el precio o la letra chica después sería cambiarle el trato.
        Si te equivocas, se borra y se hace otro.
      </p>

      <div className="flex flex-wrap gap-3">
        <BotonEnviar>Publicar el cupón</BotonEnviar>

        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="min-h-12 rounded-full border-2 border-selva/25 bg-white px-6 font-bold text-selva-2"
        >
          Cerrar
        </button>
      </div>
    </form>
  );
}

/**
 * Un cupón en la lista del negocio.
 *
 * Sin botón de editar, y no por olvido: la única salida es borrarlo. Ponerlo y
 * que al guardar saltara un error sería peor que no ofrecerlo.
 */
export function TarjetaCupon({ cupon }: { cupon: Cupon }) {
  return (
    <li
      className={`grid content-start gap-4 overflow-hidden rounded-3xl bg-crema-2 ${
        cupon.caducado ? "opacity-70" : ""
      }`}
    >
      {cupon.imagen ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={cupon.imagen}
          alt=""
          className={`aspect-square w-full object-cover ${
            cupon.caducado ? "grayscale" : ""
          }`}
        />
      ) : (
        <span
          aria-hidden="true"
          className="grid aspect-square w-full place-items-center bg-white font-display text-4xl text-selva-2"
        >
          {cupon.nombre.charAt(0)}
        </span>
      )}

      <div className="grid gap-3 p-5 pt-0">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-xs tracking-wide text-cacao/70 uppercase">
              Hasta el {cupon.vigenciaTexto}
            </p>

            {/*
              La señal va pegada a la fecha porque es lo que la explica: sola,
              «caducado» obliga a buscar desde cuándo.
            */}
            {cupon.caducado && (
              <span className="rounded-full bg-guayaba px-2 py-0.5 font-mono text-xs font-bold text-ink">
                Caducado
              </span>
            )}
          </div>

          <p className="mt-1 font-display text-xl font-semibold text-selva-2">
            {cupon.nombre}
          </p>
          <p className="text-cacao">{cupon.sucursal}</p>
        </div>

        <p className="text-cacao">{cupon.descripcion}</p>

        <p className="flex items-center gap-2 font-display text-lg font-semibold text-selva">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/marca/mazorca.png" alt="" className="size-6" />
          {cupon.costo}{" "}
          {cupon.costo === 1 ? MONEDA.unaCorta : MONEDA.variasCortas}
        </p>

        <details>
          <summary className="cursor-pointer list-none text-sm text-cacao/70 underline underline-offset-4 hover:text-cacao">
            Borrar este cupón
          </summary>

          <div className="mt-3 grid gap-3 rounded-2xl border-2 border-guayaba/40 bg-guayaba/10 p-4">
            <p className="text-cacao">
              {cupon.caducado
                ? "Ya caducó, así que nadie puede canjearlo. Borrarlo solo lo quita de tu lista."
                : "Deja de ofrecerse de inmediato. Quien ya lo haya canjeado lo conserva: esto no le quita nada a nadie."}
            </p>

            <form action={borrarCupon}>
              <input type="hidden" name="cupon_id" value={cupon.id} />
              <button
                type="submit"
                className="min-h-11 w-full rounded-full bg-guayaba px-5 font-bold text-ink"
              >
                Sí, borrarlo
              </button>
            </form>
          </div>
        </details>
      </div>
    </li>
  );
}
