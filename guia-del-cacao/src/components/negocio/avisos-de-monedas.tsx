"use client";

import { useEffect, useState } from "react";
import { conMonedas } from "@/lib/vocabulario";

/** Lo que viaja en el aviso: cuántas mazorcas y a quién se le dieron. */
export type MonedasDadas = { puntos: number; cliente: string };

export const AVISO_MONEDAS = "monedas-otorgadas";
export const AVISO_RECHAZO = "monedas-rechazadas";
export const AVISO_CANCELA = "monedas-canceladas";

/** Lanza el festejo desde donde se resuelve la solicitud. */
export function festejarMonedas(dato: MonedasDadas) {
  window.dispatchEvent(new CustomEvent(AVISO_MONEDAS, { detail: dato }));
}

/**
 * El festejo de haber publicado en la comunidad.
 *
 * Va por el mismo canal que el de las mazorcas, con `puntos` en cero: no cambia
 * de manos ninguna, pero se celebra igual porque escribir algo y que la pantalla
 * se quede muda es lo que hace que nadie vuelva a escribir.
 */
export function festejarPublicacion() {
  window.dispatchEvent(
    new CustomEvent(AVISO_MONEDAS, { detail: { puntos: 0, cliente: "" } }),
  );
}

/**
 * Confirma un rechazo, en voz baja.
 *
 * Rechazar tenía el mismo problema que dar —la tarjeta se va y no queda
 * rastro— pero no merece el mismo ruido: es una decisión que se toma y se
 * olvida, no algo que celebrar. Por eso es una nota en una esquina y no una
 * pantalla completa.
 */
export function avisarRechazo(cliente: string) {
  window.dispatchEvent(new CustomEvent(AVISO_RECHAZO, { detail: cliente }));
}

/**
 * Retira el aviso cuando la base rechaza lo que ya estábamos dando por hecho.
 *
 * Se festeja al pulsar y no al confirmar porque al confirmar la tarjeta ya se
 * fue de la lista; el precio es tener que desdecirse si algo falla, y es un
 * precio pequeño: el error se queda escrito en la tarjeta, que en ese caso
 * sigue ahí.
 */
export function cancelarFestejo() {
  window.dispatchEvent(new Event(AVISO_CANCELA));
}

/*
  Catorce mazorcas cayendo, colocadas a mano y no al azar: `Math.random()` durante
  el render daría una pintada distinta en el servidor y en el navegador. Cada una
  lleva su carril, su retraso y su tamaño para que la lluvia no se vea en fila.
*/
const LLUVIA = [
  { x: 6, tarda: 0.0, tam: 34 },
  { x: 14, tarda: 0.45, tam: 26 },
  { x: 22, tarda: 0.15, tam: 42 },
  { x: 30, tarda: 0.7, tam: 30 },
  { x: 38, tarda: 0.3, tam: 38 },
  { x: 46, tarda: 0.9, tam: 24 },
  { x: 54, tarda: 0.05, tam: 36 },
  { x: 62, tarda: 0.6, tam: 28 },
  { x: 70, tarda: 0.25, tam: 44 },
  { x: 78, tarda: 0.8, tam: 32 },
  { x: 86, tarda: 0.4, tam: 26 },
  { x: 94, tarda: 1.0, tam: 38 },
  { x: 18, tarda: 1.2, tam: 30 },
  { x: 74, tarda: 1.35, tam: 34 },
];

/** Cuánto se queda el festejo antes de irse solo. */
const DURA = 4200;

/** La nota del rechazo se va antes: es una línea, no una celebración. */
const DURA_NOTA = 3200;

/**
 * El festejo de haber dado mazorcas.
 *
 * Va suelto en la página y no dentro de la tarjeta de la solicitud a propósito:
 * al resolverla, la lista se recarga y esa tarjeta desaparece: con ella se iba
 * el aviso de "listo", y dar mazorcas se sentía como si la solicitud se hubiera
 * esfumado. Aquí sobrevive a la recarga porque vive fuera de la lista.
 *
 * Se anuncia con `role="status"`: quien usa lector de pantalla no ve la lluvia
 * de monedas, pero oye lo que pasó, que es lo que importa.
 */
export function AvisosDeMonedas() {
  const [dado, setDado] = useState<MonedasDadas | null>(null);
  const [rechazado, setRechazado] = useState<string | null>(null);

  useEffect(() => {
    function alDar(evento: Event) {
      setRechazado(null);
      setDado((evento as CustomEvent<MonedasDadas>).detail);
    }

    function alRechazar(evento: Event) {
      setDado(null);
      setRechazado((evento as CustomEvent<string>).detail);
    }

    function alFallar() {
      setDado(null);
      setRechazado(null);
    }

    window.addEventListener(AVISO_MONEDAS, alDar);
    window.addEventListener(AVISO_RECHAZO, alRechazar);
    window.addEventListener(AVISO_CANCELA, alFallar);

    return () => {
      window.removeEventListener(AVISO_MONEDAS, alDar);
      window.removeEventListener(AVISO_RECHAZO, alRechazar);
      window.removeEventListener(AVISO_CANCELA, alFallar);
    };
  }, []);

  useEffect(() => {
    if (!dado) return;

    const reloj = setTimeout(() => setDado(null), DURA);
    return () => clearTimeout(reloj);
  }, [dado]);

  useEffect(() => {
    if (!rechazado) return;

    const reloj = setTimeout(() => setRechazado(null), DURA_NOTA);
    return () => clearTimeout(reloj);
  }, [rechazado]);

  if (rechazado) {
    return (
      <p
        role="status"
        /*
          Abajo y a un lado, sin velo ni animación de entrada: confirma que
          pasó algo y se quita de en medio. Rechazar es rutina.
        */
        className="fixed bottom-5 left-1/2 z-50 w-[min(92vw,26rem)] -translate-x-1/2 rounded-2xl border-2 border-selva/20 bg-white px-5 py-3 text-center text-cacao shadow-dura sm:left-6 sm:translate-x-0 sm:text-left"
      >
        Rechazaste la solicitud de{" "}
        <strong className="text-selva-2">{rechazado}</strong>. No se le dio
        ninguna mazorca.
      </p>
    );
  }

  if (!dado) return null;

  return (
    <div
      // Se cierra al tocar en cualquier parte: quien atiende una fila no puede
      // esperar cuatro segundos a que se vaya solo.
      onClick={() => setDado(null)}
      className="fixed inset-0 z-50 grid place-items-center overflow-hidden bg-ink/45 p-6"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 motion-reduce:hidden"
      >
        {LLUVIA.map((mazorca, i) => (
          <span
            key={i}
            className="absolute top-0 animate-cae"
            style={{
              left: `${mazorca.x}%`,
              animationDelay: `${mazorca.tarda}s`,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/marca/mazorca.png"
              alt=""
              style={{ width: `${mazorca.tam}px` }}
            />
          </span>
        ))}
      </div>

      <div
        role="status"
        className="relative w-full max-w-md animate-brinca rounded-3xl border-4 border-mango bg-crema p-8 text-center shadow-dura-alta"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/marca/mazorca.png"
          alt=""
          className="mx-auto size-20 animate-late"
        />

        <p className="mt-3 font-display text-3xl font-semibold text-selva-2">
          {dado.puntos === 0
            ? "¡Ya está publicado!"
            : `¡${conMonedas(dado.puntos, true)} para ${dado.cliente}!`}
        </p>

        <p className="mt-3 text-cacao">
          {dado.puntos === 0
            ? "Ya está en el muro. Cuando alguien te comente o te regale una mazorca, te avisamos aquí."
            : "Ya están en su cuenta y le avisamos en el momento. Así es como se gana un cliente que vuelve."}
        </p>

        <p className="mt-5 text-sm text-cacao/70">Toca para cerrar</p>
      </div>
    </div>
  );
}
