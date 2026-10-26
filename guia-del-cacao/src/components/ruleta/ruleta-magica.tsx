"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LluviaDeMazorcas } from "@/components/lluvia-de-mazorcas";
import { girarRuleta } from "@/lib/ruleta/acciones";
import type { PremioDeRuleta } from "@/lib/datos/ruleta";

/** Un color por premio, de la paleta de la guía. */
const COLORES = [
  { gajo: "#ffb703", letra: "#22150e" },
  { gajo: "#ff5d73", letra: "#22150e" },
  { gajo: "#12b8ac", letra: "#08150f" },
];
/** Los gajos alternan con este, más oscuro, para que se distingan girando. */
const GAJO_OSCURO = "#1c1236";

/**
 * Las coordenadas con tres decimales. Sin redondear, el servidor y el navegador
 * escriben el mismo número con distinta cola (…946 contra …94596) y React
 * avisa de un desajuste al hidratar.
 */
const r3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Azar para la animación, no para el premio: en qué gajo de los que tocan cae
 * la flecha y dónde dentro de él. Va fuera del componente porque solo se usa
 * al pulsar, nunca al pintar.
 */
const azar = () => Math.random();

/** Seis gajos siempre: con tres premios cada uno sale dos veces. */
const GAJOS = 6;

const FECHA = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

type Ganado = { premio: string; codigo: string; venceEn: string };

/**
 * La Ruleta Mágica del micrositio (migración 000060).
 *
 * **El premio no lo decide el navegador.** Al girar se le pregunta a la base
 * (`girar_ruleta`), que tira, guarda el premio con su código y contesta cuál
 * salió; aquí solo se anima la rueda para que la flecha caiga en ese gajo.
 * Así nadie gana lo que quiera tocando el código de la página.
 *
 * El giro dura cinco segundos y frena como una rueda de verdad. Con «reducir
 * movimiento» no hay vueltas: el premio aparece directo.
 *
 * Las probabilidades se enseñan debajo. Una promoción con premios tiene que
 * decir cuánto chance hay de cada uno, y además es lo que da confianza.
 */
export function RuletaMagica({
  sucursalId,
  premios,
  reglas,
  puedeGirar,
  motivo,
  volver,
}: {
  sucursalId: string;
  premios: PremioDeRuleta[];
  /** «Una vez al día · el premio vale 30 días». */
  reglas: string;
  /** Solo un cliente con sesión gira. */
  puedeGirar: boolean;
  /** Por qué no puede girar: sin sesión, o con una cuenta que no es de cliente. */
  motivo: "sin-sesion" | "no-es-cliente" | null;
  /** A dónde vuelve al iniciar sesión. */
  volver: string;
}) {
  const [angulo, setAngulo] = useState(0);
  const [girando, setGirando] = useState(false);
  const [ganado, setGanado] = useState<Ganado | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rueda = useRef<SVGGElement>(null);
  const pendiente = useRef<Ganado | null>(null);

  // Los gajos: los premios repetidos hasta llenar seis, en orden.
  const gajos = Array.from({ length: GAJOS }, (_, i) => premios[i % premios.length]);
  const paso = 360 / GAJOS;

  async function girar() {
    if (girando) return;
    setError(null);
    setGanado(null);
    setGirando(true);

    const resultado = await girarRuleta(sucursalId);

    if ("error" in resultado) {
      setGirando(false);
      setError(resultado.error);
      return;
    }

    const ganado = { premio: resultado.premio, codigo: resultado.codigo, venceEn: resultado.venceEn };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setGirando(false);
      setGanado(ganado);
      return;
    }

    // Uno de los gajos de ese premio, al azar, para que no caiga siempre igual.
    const posibles = gajos.flatMap((g, i) => (g.orden === resultado.orden ? [i] : []));
    const gajo = posibles[Math.floor(azar() * posibles.length)];
    // El centro del gajo, contado desde arriba en el sentido del reloj, y un
    // pequeño desvío dentro del gajo para que no pare siempre en el centro.
    const centro = gajo * paso + paso / 2 + (azar() - 0.5) * paso * 0.6;
    const actual = ((angulo % 360) + 360) % 360;
    const falta = (360 - centro - actual + 720) % 360;
    pendiente.current = ganado;
    setAngulo(angulo + 6 * 360 + falta);
    // Respaldo: si la pestaña se fue al fondo mientras giraba, el navegador
    // no anima ni avisa del final, y el premio se quedaría sin enseñarse.
    window.setTimeout(terminar, 5400);
  }

  function terminar() {
    if (!pendiente.current) return;
    setGanado(pendiente.current);
    pendiente.current = null;
    setGirando(false);
  }

  // Al terminar de girar, el premio.
  useEffect(() => {
    const nodo = rueda.current;
    if (!nodo) return;
    const alTerminar = () => terminar();
    nodo.addEventListener("transitionend", alTerminar);
    return () => nodo.removeEventListener("transitionend", alTerminar);
  }, []);

  return (
    <div className="relative flex flex-col items-center gap-6">
      <div className="relative w-full max-w-[22rem]">
        {/* La flecha, arriba, apuntando hacia adentro. */}
        <svg
          viewBox="0 0 40 46"
          aria-hidden
          className="absolute left-1/2 top-[-0.6rem] z-10 w-10 -translate-x-1/2 drop-shadow-[0_0_10px_rgba(255,209,102,0.9)]"
        >
          <path d="M20 44 L4 6 Q20 -2 36 6 Z" fill="#ffd166" stroke="#fff3c4" strokeWidth="2" />
        </svg>

        <svg viewBox="0 0 200 200" className="w-full drop-shadow-[0_0_40px_rgba(255,183,3,0.35)]">
          <defs>
            <radialGradient id="centro-ruleta">
              <stop offset="0%" stopColor="#3a1f12" />
              <stop offset="100%" stopColor="#1a0c06" />
            </radialGradient>
            <linearGradient id="aro-ruleta" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#ffe08a" />
              <stop offset="50%" stopColor="#ffb703" />
              <stop offset="100%" stopColor="#ff9f43" />
            </linearGradient>
          </defs>

          {/* El aro de oro con sus luces quietas: brillan, no parpadean. */}
          <circle cx="100" cy="100" r="98" fill="url(#aro-ruleta)" />
          {Array.from({ length: 18 }, (_, i) => {
            const a = (i * 20 * Math.PI) / 180;
            return (
              <circle
                key={i}
                cx={r3(100 + 92 * Math.sin(a))}
                cy={r3(100 - 92 * Math.cos(a))}
                r="2.2"
                fill="#fff8dc"
                className="drop-shadow-[0_0_3px_rgba(255,255,255,0.9)]"
              />
            );
          })}

          <g
            ref={rueda}
            style={{
              transform: `rotate(${angulo}deg)`,
              transformOrigin: "100px 100px",
              transition: "transform 5s cubic-bezier(0.12, 0.8, 0.12, 1)",
            }}
          >
            {gajos.map((premio, i) => {
              const desde = ((i * paso - 90) * Math.PI) / 180;
              const hasta = (((i + 1) * paso - 90) * Math.PI) / 180;
              const r = 86;
              const color = COLORES[(premio.orden - 1) % COLORES.length];
              const oscuro = i % 2 === 1 && premios.length < GAJOS;
              const medio = i * paso + paso / 2;
              const texto = premio.texto.length > 16 ? `${premio.texto.slice(0, 15)}…` : premio.texto;
              return (
                <g key={i}>
                  <path
                    d={`M100 100 L${r3(100 + r * Math.cos(desde))} ${r3(100 + r * Math.sin(desde))} A${r} ${r} 0 0 1 ${r3(100 + r * Math.cos(hasta))} ${r3(100 + r * Math.sin(hasta))} Z`}
                    fill={oscuro ? GAJO_OSCURO : color.gajo}
                    stroke="#fff3c4"
                    strokeWidth="0.8"
                  />
                  <text
                    x="100"
                    y="100"
                    transform={`rotate(${medio} 100 100) translate(0 -52)`}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="7.5"
                    fontWeight="700"
                    fill={oscuro ? color.gajo : color.letra}
                    style={{ fontFamily: "var(--font-jakarta), sans-serif" }}
                  >
                    {texto}
                  </text>
                </g>
              );
            })}
          </g>

          <circle cx="100" cy="100" r="17" fill="url(#centro-ruleta)" stroke="url(#aro-ruleta)" strokeWidth="3" />
          <image href="/marca/mazorca.png" x="89" y="89" width="22" height="22" />
        </svg>
      </div>

      {puedeGirar ? (
        <button
          type="button"
          onClick={girar}
          disabled={girando}
          className="boton-oro brillo min-h-14 rounded-full px-10 font-display text-xl font-semibold text-ink disabled:opacity-70"
        >
          {girando ? "Girando…" : "¡Girar la ruleta!"}
        </button>
      ) : motivo === "sin-sesion" ? (
        <Link
          href={`/login?volver=${encodeURIComponent(volver)}`}
          className="boton-oro brillo inline-flex min-h-14 items-center rounded-full px-10 font-display text-xl font-semibold text-ink"
        >
          Entra para girar
        </Link>
      ) : (
        <p className="text-center text-sm text-crema/70">
          La ruleta es para los visitantes: entra con una cuenta de cliente para girarla.
        </p>
      )}

      {error && (
        <p role="alert" className="max-w-md rounded-2xl border-2 border-mango/50 bg-mango/15 px-4 py-3 text-center font-bold">
          {error}
        </p>
      )}

      <div className="text-center text-sm text-crema/65">
        <p>{reglas}</p>
        <p className="mt-1">
          Probabilidades:{" "}
          {premios.map((p, i) => (
            <span key={p.orden}>
              {i > 0 && " · "}
              {p.texto} {p.probabilidad}%
            </span>
          ))}
        </p>
      </div>

      {ganado && (
        <div
          role="dialog"
          aria-label="Ganaste un premio"
          className="fixed inset-0 z-50 grid place-items-center bg-ink/70 p-4 backdrop-blur-sm"
        >
          <LluviaDeMazorcas />
          <div className="relative w-full max-w-md animate-brinca rounded-[2rem] border border-mango/50 bg-[#14231c] p-8 text-center text-crema shadow-[0_0_80px_rgb(255_183_3/0.35)]">
            <p className="antetitulo">¡Ganaste!</p>
            <p className="texto-oro mt-3 font-display text-4xl font-semibold leading-tight">{ganado.premio}</p>
            <p className="mt-5 text-sm text-crema/70">Tu código</p>
            <p className="mt-1 select-all font-mono text-3xl font-bold tracking-[0.15em] text-mango">
              {ganado.codigo}
            </p>
            <p className="mt-3 text-sm text-crema/75">
              Enséñalo en el negocio antes del {FECHA.format(new Date(`${ganado.venceEn}T00:00:00Z`))}.
              Ya quedó guardado en tus premios.
            </p>
            <div className="mt-6 grid gap-3">
              <Link
                href="/cuenta?ver=premios"
                className="boton-oro brillo inline-flex min-h-12 items-center justify-center rounded-full px-6 font-bold text-ink"
              >
                Ver mis premios
              </Link>
              <a
                href="#resenas"
                onClick={() => setGanado(null)}
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-mango/40 px-6 font-bold transition-colors hover:border-mango hover:text-mango"
              >
                Déjale una reseña o pregunta
              </a>
              <button
                type="button"
                onClick={() => setGanado(null)}
                className="text-sm text-crema/60 underline-offset-4 hover:underline"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
