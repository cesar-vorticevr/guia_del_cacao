"use client";

import { useActionState } from "react";
import { regalarMazorca, type EstadoRegalo } from "@/lib/foro/regalos";
import { festejarMonedas } from "@/components/negocio/avisos-de-monedas";

const INICIAL: EstadoRegalo = {};

/**
 * El botón de dar una mazorca, en una publicación o en un comentario.
 *
 * Es el mismo botón en los dos sitios a propósito: desde fuera es la misma
 * decisión —«esto me gustó»— y lo único que cambia es a quién le llega.
 *
 * Cuando ya no se puede, el botón sigue ahí pero apagado y diciendo por qué. Si
 * desapareciera, quien lo buscara pensaría que se rompió algo; y el motivo
 * —«ya le diste hoy», «se te acabaron»— es justo lo que enseña cómo funciona la
 * bolsa diaria sin tener que explicarla en ningún sitio.
 */
export function RegalarMazorca({
  aPerfil,
  aNombre,
  publicacionId,
  comentarioId,
  /** Si quien mira ya le dio una a esta persona hoy. */
  yaLeDi,
  /** Cuántas le quedan hoy por repartir. */
  quedan,
  /** Es suya: no se puede regalar a uno mismo. */
  esMia,
  /** Sin sesión no hay bolsa: el botón lleva a entrar. */
  haySesion,
}: {
  aPerfil: string;
  aNombre: string;
  publicacionId?: string;
  comentarioId?: string;
  yaLeDi: boolean;
  quedan: number;
  esMia: boolean;
  haySesion: boolean;
}) {
  const [estado, accion, pendiente] = useActionState(regalarMazorca, INICIAL);

  if (esMia) return null;

  const dada = yaLeDi || Boolean(estado.ok);
  const sinBolsa = quedan < 1;
  const bloqueado = !haySesion || dada || sinBolsa || pendiente;

  const motivo = !haySesion
    ? "Entra para regalar mazorcas"
    : dada
      ? `Ya le diste una hoy a ${aNombre}`
      : sinBolsa
        ? "Ya repartiste tus 5 de hoy"
        : `Darle una mazorca a ${aNombre}`;

  return (
    <form
      action={accion}
      onSubmit={() => {
        // El festejo arranca al pulsar, como al dar mazorcas en el panel: al
        // responder la lista se recarga y este botón ya no existe para contarlo.
        if (!bloqueado) festejarMonedas({ puntos: 1, cliente: aNombre });
      }}
      className="inline-flex flex-col items-start gap-1"
    >
      <input type="hidden" name="a_perfil" value={aPerfil} />
      {publicacionId && (
        <input type="hidden" name="publicacion_id" value={publicacionId} />
      )}
      {comentarioId && (
        <input type="hidden" name="comentario_id" value={comentarioId} />
      )}

      <button
        type="submit"
        disabled={bloqueado}
        title={motivo}
        className={`inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-bold transition-transform ${
          dada
            ? "border-2 border-lima/60 bg-lima/20 text-selva-2"
            : bloqueado
              ? "border-2 border-selva/15 bg-white text-cacao/50"
              : "border-2 border-mango bg-mango/20 text-ink active:translate-y-0.5"
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/marca/mazorca.png"
          alt=""
          className={`size-5 ${bloqueado && !dada ? "opacity-40 grayscale" : ""}`}
        />
        {dada ? "Ya se la diste" : "Donar 1 mazorca"}
      </button>

      {estado.error && (
        <span role="alert" className="text-xs text-cacao">
          {estado.error}
        </span>
      )}
    </form>
  );
}
