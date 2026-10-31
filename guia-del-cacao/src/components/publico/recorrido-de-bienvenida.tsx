"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { LluviaDeMazorcas } from "@/components/lluvia-de-mazorcas";

/** Dónde se anota que ya se vio. Solo es comodidad: si falla, se vuelve a ver. */
const CLAVE = "guia-recorrido-visto";

type Paso = {
  antetitulo: string;
  titulo: React.ReactNode;
  texto: string;
  /** Las ilustraciones que flotan alrededor de la tarjeta en este paso. */
  adornos: { src: string; clase: string; gira: string }[];
  icono: string;
};

const PASOS: Paso[] = [
  {
    antetitulo: "Bienvenido",
    titulo: (
      <>
        El <em className="texto-oro pr-1">cacao</em> de México, en un solo lugar
      </>
    ),
    texto:
      "Fincas, chocolaterías, museos y talleres de todo el país. Te enseñamos lo importante en cuatro pasos.",
    adornos: [
      { src: "/parallax/mazorca-amarilla.png", clase: "-top-16 -left-10 w-28 sm:w-36", gira: "-14deg" },
      { src: "/parallax/mazorca-rosa.png", clase: "-right-8 -bottom-14 w-24 sm:w-32", gira: "12deg" },
    ],
    icono: "/marca/logotipo.png",
  },
  {
    antetitulo: "Explora",
    titulo: (
      <>
        Encuentra tu próximo <em className="texto-oro pr-1">antojo</em>
      </>
    ),
    texto:
      "Busca por estado o por lo que se te antoje. Cada negocio tiene su página: catálogo con precios, cómo llegar y lo que opina la gente.",
    adornos: [
      { src: "/parallax/hoja.png", clase: "-top-12 -right-6 w-24 sm:w-32", gira: "20deg" },
      { src: "/parallax/granos-de-cacao.png", clase: "-bottom-10 -left-8 w-24 sm:w-28", gira: "-8deg" },
    ],
    icono: "/parallax/rama-una-mazorca.png",
  },
  {
    antetitulo: "Pide directo",
    titulo: (
      <>
        Pide y platica <em className="texto-oro pr-1">con el negocio</em>
      </>
    ),
    texto:
      "Arma tu pedido desde su catálogo y habla con ellos en tu buzón. Confirman que lo tienen y les pagas directo, sin intermediarios.",
    adornos: [
      { src: "/parallax/flores-de-cacao.png", clase: "-top-14 -left-8 w-28 sm:w-32", gira: "-10deg" },
      { src: "/parallax/mazorca-amarilla.png", clase: "-right-10 -bottom-12 w-24 sm:w-28", gira: "16deg" },
    ],
    icono: "/parallax/granos-de-cacao.png",
  },
  {
    antetitulo: "Magia",
    titulo: (
      <>
        Gira, gana y mira <em className="texto-oro pr-1">cobrar vida</em>
      </>
    ),
    texto:
      "Muchos negocios tienen su Ruleta Mágica con premios de verdad, y carteles que cobran vida al enfocarlos con tu celular.",
    adornos: [
      { src: "/parallax/mazorca-rosa.png", clase: "-top-14 -right-8 w-24 sm:w-32", gira: "-18deg" },
      { src: "/parallax/hoja.png", clase: "-bottom-10 -left-10 w-24 sm:w-28", gira: "28deg" },
    ],
    icono: "/parallax/flores-de-cacao.png",
  },
];

/** Estrellas del fondo, fijas y no al azar: el servidor y el navegador pintan lo mismo. */
const ESTRELLAS = [
  [8, 12, 0], [22, 70, 0.6], [35, 25, 1.2], [48, 85, 0.3], [61, 15, 1.8], [74, 60, 0.9],
  [86, 30, 1.5], [93, 78, 0.4], [15, 45, 2.1], [55, 50, 1.1], [80, 8, 0.7], [30, 92, 1.6],
  [5, 88, 1.3], [68, 90, 0.2], [42, 6, 2.4], [97, 48, 1.9],
] as const;

function suscribir() {
  return () => {};
}

/** Si este navegador ya lo vio. */
function leerEstado(): "visto" | "nuevo" {
  try {
    return window.localStorage.getItem(CLAVE) ? "visto" : "nuevo";
  } catch {
    return "nuevo";
  }
}

/**
 * El recorrido de bienvenida: cinco pantallas sobre la noche de la selva, con
 * mazorcas flotando y estrellas, que cuentan lo importante y terminan
 * invitando a registrarse —sobre todo a quien tiene un negocio de cacao—.
 *
 * Sale **la primera vez** que alguien sin sesión entra a la portada, y otra vez
 * con `/?recorrido=1` (el enlace «¿Cómo funciona?» del pie): eso lo lee la
 * página y llega como `pedido`. Se omite con un botón, con Esc o tocando fuera,
 * y no vuelve. Lo que recuerda que ya se vio vive en `localStorage`: si el
 * navegador no lo deja, se vuelve a enseñar, que es lo menos malo.
 *
 * Si ya se vio se lee con `useSyncExternalStore` y no en un efecto: en el
 * servidor dice «visto» (no se pinta nada) y al hidratar pregunta al navegador.
 */
export function RecorridoDeBienvenida({
  conSesion,
  pedido = false,
}: {
  conSesion: boolean;
  /** La URL lo pidió (`?recorrido=1`): sale aunque ya se haya visto. */
  pedido?: boolean;
}) {
  const router = useRouter();
  const estado = useSyncExternalStore(suscribir, leerEstado, () => "visto" as const);
  // En el servidor no hay `document` para el portal: el recorrido se pinta solo
  // ya en el navegador, también cuando lo pide la URL.
  const enNavegador = useSyncExternalStore(suscribir, () => true, () => false);
  const [cerrado, setCerrado] = useState(false);
  const [paso, setPaso] = useState(0);

  const abierto = enNavegador && !cerrado && (pedido || (estado === "nuevo" && !conSesion));
  const total = PASOS.length + 1;
  const ultimo = paso === total - 1;

  const cerrar = useCallback(() => {
    setCerrado(true);
    try {
      window.localStorage.setItem(CLAVE, new Date().toISOString());
    } catch {
      // Sin almacenamiento, la próxima vez se vuelve a ver. No pasa nada.
    }
    // Quitar `?recorrido=1` para que volver a pulsar el enlace lo abra otra vez.
    if (pedido) router.replace("/", { scroll: false });
  }, [pedido, router]);

  // El teclado: flechas para moverse, Esc para omitir. Y mientras está abierto
  // la página de atrás no se desplaza.
  useEffect(() => {
    if (!abierto) return;

    const alTeclear = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") cerrar();
      if (evento.key === "ArrowRight") setPaso((p) => Math.min(p + 1, total - 1));
      if (evento.key === "ArrowLeft") setPaso((p) => Math.max(p - 1, 0));
    };

    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", alTeclear);
    return () => {
      document.body.style.overflow = antes;
      window.removeEventListener("keydown", alTeclear);
    };
  }, [abierto, cerrar, total]);

  if (!abierto) return null;

  const actual = PASOS[paso];

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="recorrido-titulo"
      className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto px-4 py-10"
      onClick={(evento) => {
        if (evento.target === evento.currentTarget) cerrar();
      }}
    >
      {/* La noche: degradado, auroras y estrellas que titilan. */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 bg-[#120c22]/95 backdrop-blur-md">
        <div className="absolute -top-1/4 -left-1/4 size-[70vmax] rounded-full bg-[radial-gradient(circle,rgb(168_85_247/0.28),transparent_60%)] blur-3xl motion-safe:animate-[aurora_18s_ease-in-out_infinite_alternate]" />
        <div className="absolute -right-1/4 -bottom-1/4 size-[70vmax] rounded-full bg-[radial-gradient(circle,rgb(255_183_3/0.22),transparent_60%)] blur-3xl motion-safe:animate-[aurora_24s_ease-in-out_infinite_alternate-reverse]" />
        <div className="absolute top-1/3 left-1/2 size-[50vmax] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgb(34_197_94/0.16),transparent_60%)] blur-3xl" />
        {ESTRELLAS.map(([x, y, tarda], i) => (
          <span
            key={i}
            className="absolute size-1.5 rounded-full bg-[#ffe9a8] shadow-[0_0_12px_4px_rgb(255_209_102/0.6)] motion-safe:animate-titila"
            style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${tarda}s` }}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={cerrar}
        className="fixed top-4 right-4 z-10 rounded-full border border-white/25 bg-white/10 px-5 py-2 text-sm font-bold text-[#fff7e8] backdrop-blur transition-colors hover:border-[#ffb703] hover:text-[#ffb703]"
      >
        Omitir
      </button>

      <div key={paso} className="relative w-full max-w-lg motion-safe:animate-aparece-magia">
        {/* Las ilustraciones flotan alrededor de la tarjeta, cada una a su ritmo. */}
        {(actual?.adornos ?? ADORNOS_FINALES).map((adorno, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={adorno.src + i}
            src={adorno.src}
            alt=""
            aria-hidden="true"
            className={`pointer-events-none absolute z-10 drop-shadow-[0_0_24px_rgb(255_183_3/0.45)] motion-safe:animate-flota ${adorno.clase}`}
            style={{ "--gira": adorno.gira, animationDelay: `${i * 1.3}s` } as React.CSSProperties}
          />
        ))}

        <div className="relative overflow-hidden rounded-[2.5rem] border border-[#ffb703]/40 bg-[linear-gradient(160deg,rgb(46_26_74/0.92),rgb(18_40_30/0.92))] px-6 pt-10 pb-7 text-center text-[#fff7e8] shadow-[0_0_80px_rgb(255_183_3/0.25),inset_0_0_0_1px_rgb(255_255_255/0.06)] sm:px-10">
          {ultimo && <LluviaDeMazorcas />}

          {actual ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={actual.icono}
                alt=""
                aria-hidden="true"
                className="mx-auto size-24 object-contain drop-shadow-[0_0_30px_rgb(255_183_3/0.6)] motion-safe:animate-flota sm:size-28"
              />
              <p className="mt-5 font-mono text-xs font-bold tracking-[0.3em] text-[#ffb703] uppercase">
                {actual.antetitulo}
              </p>
              <h2 id="recorrido-titulo" className="mt-3 text-balance font-display text-3xl leading-tight text-[#fff7e8] sm:text-4xl">
                {actual.titulo}
              </h2>
              <p className="mx-auto mt-4 max-w-sm text-pretty text-[#fff7e8]/80">{actual.texto}</p>
            </>
          ) : (
            <PasoFinal alElegir={cerrar} />
          )}

          {/* El avance: un punto por paso, el actual alargado y de oro. */}
          <div className="mt-8 flex items-center justify-center gap-2" aria-label={`Paso ${paso + 1} de ${total}`}>
            {Array.from({ length: total }, (_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setPaso(i)}
                aria-label={`Ir al paso ${i + 1}`}
                aria-current={i === paso ? "step" : undefined}
                className={`h-2 rounded-full transition-all duration-500 ${
                  i === paso ? "w-8 bg-[#ffb703] shadow-[0_0_12px_rgb(255_183_3/0.8)]" : "w-2 bg-white/30 hover:bg-white/60"
                }`}
              />
            ))}
          </div>

          {!ultimo && (
            <div className="mt-6 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setPaso((p) => Math.max(p - 1, 0))}
                className={`min-h-12 rounded-full px-5 font-bold text-[#fff7e8]/70 transition-opacity hover:text-[#fff7e8] ${
                  paso === 0 ? "pointer-events-none opacity-0" : ""
                }`}
              >
                ← Atrás
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => setPaso((p) => p + 1)}
                className="boton-oro brillo min-h-12 rounded-full px-7 font-display text-lg font-semibold text-[#22150e]"
              >
                {paso === 0 ? "Empezar ✨" : "Siguiente"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

const ADORNOS_FINALES: Paso["adornos"] = [
  { src: "/parallax/rama-tres-mazorcas.png", clase: "-top-20 -left-12 w-36 sm:w-44", gira: "-12deg" },
  { src: "/parallax/mazorca-amarilla.png", clase: "-right-10 -bottom-14 w-24 sm:w-32", gira: "14deg" },
];

/**
 * El cierre: la invitación. Arriba y en grande, a quien tiene un negocio de
 * cacao —es a quien más le cambia la guía—; debajo, crear cuenta para pedir;
 * y al final, quedarse mirando, que también vale.
 */
function PasoFinal({ alElegir }: { alElegir: () => void }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/marca/logotipo.png"
        alt=""
        aria-hidden="true"
        className="mx-auto size-24 drop-shadow-[0_0_30px_rgb(255_183_3/0.6)] motion-safe:animate-flota sm:size-28"
      />
      <p className="mt-5 font-mono text-xs font-bold tracking-[0.3em] text-[#ffb703] uppercase">
        ¿Tienes un negocio de cacao?
      </p>
      <h2 id="recorrido-titulo" className="mt-3 text-balance font-display text-3xl leading-tight text-[#fff7e8] sm:text-4xl">
        Ponlo en el <em className="texto-oro pr-1">mapa del cacao</em> de México
      </h2>
      <p className="mx-auto mt-4 max-w-sm text-pretty text-[#fff7e8]/80">
        Tu página con catálogo, pedidos, reseñas, Ruleta Mágica y un QR para tu mostrador.{" "}
        <strong className="text-[#ffd166]">15 días gratis, sin tarjeta.</strong>
      </p>

      <div className="mt-7 grid gap-3">
        <Link
          href="/soy-negocio"
          onClick={alElegir}
          autoFocus
          className="boton-oro brillo grid min-h-14 place-items-center rounded-full px-6 font-display text-lg font-semibold text-[#22150e]"
        >
          Registrar mi negocio gratis
        </Link>
        <Link
          href="/registro/cliente"
          onClick={alElegir}
          className="grid min-h-12 place-items-center rounded-full border border-[#ffb703]/50 px-6 font-bold text-[#fff7e8] transition-colors hover:border-[#ffb703] hover:text-[#ffb703]"
        >
          Crear mi cuenta para pedir y ganar premios
        </Link>
        <button
          type="button"
          onClick={alElegir}
          className="min-h-11 rounded-full px-6 text-sm font-bold text-[#fff7e8]/70 hover:text-[#fff7e8]"
        >
          Solo quiero explorar
        </button>
      </div>
    </>
  );
}
