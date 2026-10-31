"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { bajarLienzo, dibujarQr } from "@/lib/ra/qr";
import { borrarExperiencia, cambiarEstado, type EstadoExperiencia } from "@/lib/negocio/experiencias";

export type TarjetaDeExperiencia = {
  id: string;
  codigo: string;
  titulo: string;
  estado: "borrador" | "publicada";
  /** Publicada y dentro del cupo de hoy: el link la enseña. */
  seVe: boolean;
  vistas: number;
  miniatura: string | null;
  link: string;
  elementos: number;
};

const NUMERO = new Intl.NumberFormat("es-MX");

/**
 * Las tarjetas de experiencias, como «Mis experiencias» de Vórtice VR: la
 * imagen, sus vistas y su estado, y a la mano Editar, QR, Copiar link y Borrar.
 */
export function Tablero({
  experiencias,
  puedePublicar,
  marca,
}: {
  experiencias: TarjetaDeExperiencia[];
  puedePublicar: boolean;
  /** El nombre del negocio, para el póster. */
  marca: string;
}) {
  const [qr, setQr] = useState<TarjetaDeExperiencia | null>(null);
  const [aviso, setAviso] = useState<EstadoExperiencia>({});

  return (
    <>
      {aviso.error && (
        <p role="alert" className="rounded-2xl bg-guayaba/15 px-4 py-3 font-bold text-cacao">
          {aviso.error}
        </p>
      )}
      {aviso.ok && (
        <p role="status" className="rounded-2xl bg-lima/25 px-4 py-3 font-bold text-selva-2">
          {aviso.ok}
        </p>
      )}

      <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {experiencias.map((e) => (
          <Tarjeta key={e.id} e={e} marca={marca} puedePublicar={puedePublicar} onQr={() => setQr(e)} onAviso={setAviso} />
        ))}
      </ul>

      {qr && <DialogoQr e={qr} marca={marca} onCerrar={() => setQr(null)} />}
    </>
  );
}

function Tarjeta({
  e,
  marca,
  puedePublicar,
  onQr,
  onAviso,
}: {
  e: TarjetaDeExperiencia;
  marca: string;
  puedePublicar: boolean;
  onQr: () => void;
  onAviso: (a: EstadoExperiencia) => void;
}) {
  const [pendiente, empezar] = useTransition();
  const [copiado, setCopiado] = useState(false);

  const estado =
    e.estado === "borrador"
      ? { texto: "Borrador", clase: "bg-ink/10 text-cacao" }
      : e.seVe
        ? { texto: "Publicada", clase: "bg-lima/30 text-selva-2" }
        : { texto: "Oculta: sin cupo o sin Pro", clase: "bg-guayaba/20 text-cacao" };

  async function copiar() {
    try {
      await navigator.clipboard.writeText(e.link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1600);
    } catch {
      window.prompt("Copia tu link:", e.link);
    }
  }

  function borrar() {
    if (!window.confirm(`¿Borrar «${e.titulo || "Sin título"}»? El link y el QR dejarán de funcionar.`)) return;
    empezar(async () => onAviso(await borrarExperiencia(e.id)));
  }

  function alternar() {
    empezar(async () => onAviso(await cambiarEstado(e.id, e.estado === "publicada" ? "borrador" : "publicada")));
  }

  return (
    <li
      className={`group overflow-hidden rounded-3xl border-2 bg-white transition-shadow ${
        e.seVe ? "border-mango/60 shadow-[0_0_28px_rgb(255_183_3/0.25)]" : "border-ink/10"
      } ${pendiente ? "opacity-60" : ""}`}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-[#1c1236]">
        {e.miniatura ? (
          <img src={e.miniatura} alt="" className="h-full w-full object-contain" loading="lazy" />
        ) : (
          <div className="grid h-full place-items-center text-sm font-bold text-crema/70">Sin imagen todavía</div>
        )}
        <span className={`absolute top-3 left-3 rounded-full px-3 py-1 text-xs font-bold ${estado.clase}`}>
          {estado.texto}
        </span>
        <span className="absolute top-3 right-3 rounded-full bg-[#1c1236]/80 px-3 py-1 text-xs font-bold text-mango">
          ✦ Realidad aumentada
        </span>
      </div>

      <div className="grid gap-3 p-5">
        <div>
          <h3 className="font-display text-xl leading-tight">{e.titulo || "Sin título"}</h3>
          <p className="mt-1 flex flex-wrap gap-x-3 text-sm text-cacao/80">
            <span>
              <strong className="text-cacao">{NUMERO.format(e.vistas)}</strong> {e.vistas === 1 ? "vista" : "vistas"}
            </span>
            <span>
              {e.elementos} {e.elementos === 1 ? "elemento" : "elementos"}
            </span>
            <span className="font-mono">/ra/{e.codigo}</span>
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={`/negocio/panel/experiencias/${e.id}`}
            className="boton-oro brillo inline-flex min-h-10 items-center rounded-full px-4 text-sm font-bold text-ink"
          >
            Editar
          </Link>
          <button type="button" onClick={onQr} className={BOTON}>
            QR
          </button>
          <BotonPoster e={e} marca={marca} />
          <button type="button" onClick={copiar} className={BOTON}>
            {copiado ? "¡Copiado!" : "Copiar link"}
          </button>
          {(e.estado === "publicada" || puedePublicar) && e.elementos > 0 && (
            <button type="button" onClick={alternar} disabled={pendiente} className={BOTON}>
              {e.estado === "publicada" ? "Pasar a borrador" : "Publicar"}
            </button>
          )}
          <button
            type="button"
            onClick={borrar}
            disabled={pendiente}
            className="min-h-10 rounded-full px-3 text-sm font-bold text-cacao/70 underline hover:text-guayaba"
          >
            Borrar
          </button>
        </div>
      </div>
    </li>
  );
}

const BOTON =
  "min-h-10 rounded-full border-2 border-mango/50 bg-white px-4 text-sm font-bold text-selva-2 shadow-[0_0_14px_rgb(255_183_3/0.18)] transition-transform hover:-translate-y-px disabled:opacity-50";

/**
 * Baja el póster tamaño carta (`lib/ra/poster-pdf`): la imagen que se enfoca,
 * grande, con el QR debajo, listo para imprimir y pegar. `jspdf` y `qrcode` se
 * piden al pulsar. Sin imagen no hay póster: es lo que la cámara busca.
 */
function BotonPoster({ e, marca }: { e: TarjetaDeExperiencia; marca: string }) {
  const [estado, setEstado] = useState<"listo" | "armando" | "fallo">("listo");
  if (!e.miniatura) return null;
  const imagen = e.miniatura;

  async function bajar() {
    setEstado("armando");
    try {
      const [{ armarPosterPdf }, { bajarBlob, enNombreDeArchivo }] = await Promise.all([
        import("@/lib/ra/poster-pdf"),
        import("@/lib/descargas"),
      ]);
      const pdf = await armarPosterPdf({ titulo: e.titulo, marca, imagen, destino: e.link });
      bajarBlob(pdf, `poster-${enNombreDeArchivo(`${marca} ${e.titulo || e.codigo}`)}.pdf`);
      setEstado("listo");
    } catch {
      setEstado("fallo");
    }
  }

  return (
    <button
      type="button"
      onClick={bajar}
      disabled={estado === "armando"}
      title="Hoja carta con tu imagen y el QR, para imprimir"
      className={BOTON}
    >
      {estado === "armando" ? "Armando el póster…" : estado === "fallo" ? "No se pudo, reintenta" : "🖨️ Póster carta"}
    </button>
  );
}

function DialogoQr({ e, marca, onCerrar }: { e: TarjetaDeExperiencia; marca: string; onCerrar: () => void }) {
  const lienzo = useRef<HTMLCanvasElement>(null);
  const dialogo = useRef<HTMLDialogElement>(null);
  const [listo, setListo] = useState(false);

  // Se dibuja al montar; el diálogo se abre como modal para que Esc lo cierre.
  function alMontar(el: HTMLDialogElement | null) {
    dialogo.current = el;
    if (!el || el.open) return;
    el.showModal();
    requestAnimationFrame(async () => {
      if (lienzo.current) {
        await dibujarQr(lienzo.current, e.link);
        setListo(true);
      }
    });
  }

  return (
    <dialog
      ref={alMontar}
      onClose={onCerrar}
      className="m-auto w-[min(92vw,420px)] rounded-3xl border-2 border-mango/50 bg-white p-6 shadow-[0_0_60px_rgb(255_183_3/0.35)] backdrop:bg-[#1c1236]/70"
    >
      <h2 className="font-display text-2xl">{e.titulo || "Tu experiencia"}</h2>
      <p className="mt-1 text-sm text-cacao/80">
        Imprímelo junto a tu imagen: quien lo escanea abre la cámara y la ve cobrar vida.
      </p>
      <canvas ref={lienzo} aria-label="Código QR" className="mt-4 w-full rounded-2xl border border-ink/10" />
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!listo}
          onClick={() => lienzo.current && bajarLienzo(lienzo.current, `QR-${e.codigo}.png`)}
          className="boton-oro brillo inline-flex min-h-11 items-center rounded-full px-5 font-bold text-ink disabled:opacity-60"
        >
          Descargar QR
        </button>
        <BotonPoster e={e} marca={marca} />
        <button type="button" onClick={() => dialogo.current?.close()} className={BOTON}>
          Cerrar
        </button>
      </div>
    </dialog>
  );
}
