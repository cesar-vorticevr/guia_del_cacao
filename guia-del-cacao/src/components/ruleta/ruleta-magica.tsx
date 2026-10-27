"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LluviaDeMazorcas } from "@/components/lluvia-de-mazorcas";
import { casi, fanfarria, preparar, tic } from "@/components/ruleta/sonidos";
import { girarRuleta } from "@/lib/ruleta/acciones";

export type Gajo = {
  gajo: number;
  texto: string;
  probabilidad: number;
  esPremio: boolean;
  /** En la ruleta de cacao el gajo lleva una imagen en vez de un premio. */
  imagen?: string;
};

/**
 * Cómo gira (000066):
 * - `real`: la base decide el premio y lo guarda.
 * - `cacao`: quien ya tiene su premio sigue girando por diversión; los gajos
 *   son mazorcas, flores y el logo del negocio, y no se guarda nada.
 * - `vista-previa`: el dueño la prueba en su panel; sale un premio al azar con
 *   sus probabilidades, sin guardarse.
 */
export type ModoDeRuleta = "real" | "cacao" | "vista-previa";

/** Los colores de la ruleta de cacao: chocolate y oro. */
const COLORES_CACAO = [
  { fondo: "#4a2c1d", letra: "#fff7e8" },
  { fondo: "#ffe08a", letra: "#22150e" },
  { fondo: "#6b3d22", letra: "#fff7e8" },
  { fondo: "#ffb703", letra: "#22150e" },
  { fondo: "#3a1f12", letra: "#fff7e8" },
  { fondo: "#ff9f43", letra: "#22150e" },
];

/**
 * Los seis colores de la guía, uno por gajo, con la letra que se lee encima.
 * Si cambia la paleta en `globals.css`, cambia aquí.
 */
const COLORES = [
  { fondo: "#ffb703", letra: "#22150e" }, // mango
  { fondo: "#ff5d73", letra: "#22150e" }, // guayaba
  { fondo: "#12b8ac", letra: "#08150f" }, // turquesa
  { fondo: "#a8d94a", letra: "#0c5236" }, // lima
  { fondo: "#106b46", letra: "#fff7e8" }, // selva
  { fondo: "#4a2c1d", letra: "#fff7e8" }, // cacao
];

const PASO = 60;
/** Lo que cabe en un renglón del gajo, en caracteres. */
const RENGLON = 13;

const FECHA = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", timeZone: "UTC" });

/**
 * Las coordenadas con tres decimales. Sin redondear, el servidor y el navegador
 * escriben el mismo número con distinta cola y React avisa al hidratar.
 */
const r3 = (n: number) => Math.round(n * 1000) / 1000;

/** Azar de la animación (no del premio): dónde cae la flecha dentro del gajo. */
const azar = () => Math.random();

/** Parte el texto en dos renglones que quepan en el gajo, por palabras. */
function renglones(texto: string): string[] {
  const palabras = texto.split(/\s+/);
  const lineas = [""];
  for (const palabra of palabras) {
    const actual = lineas[lineas.length - 1];
    if (!actual) lineas[lineas.length - 1] = palabra;
    else if (`${actual} ${palabra}`.length <= RENGLON) lineas[lineas.length - 1] = `${actual} ${palabra}`;
    else if (lineas.length < 2) lineas.push(palabra);
    else {
      lineas[1] = `${lineas[1]} ${palabra}`;
    }
  }
  return lineas.map((l) => (l.length > RENGLON + 2 ? `${l.slice(0, RENGLON)}…` : l));
}

type Resultado = { premio: string; esPremio: boolean; codigo: string | null; venceEn: string | null };

/**
 * La Ruleta Mágica del micrositio (migraciones 000060 y 000062).
 *
 * **El premio no lo decide el navegador.** Al girar se le pregunta a la base
 * (`girar_ruleta`), que tira sobre los seis gajos, guarda el premio y contesta
 * en qué gajo cayó; aquí solo se anima la rueda hasta él.
 *
 * Para que sea divertida: suena un «tic» cada vez que un gajo pasa por la
 * flecha —que rebota con cada uno—, las luces del aro corren mientras gira,
 * y al parar hay fanfarria y lluvia de mazorcas, o dos notas de «casi». Todo
 * el sonido se apaga con el botón de la bocina.
 */
export function RuletaMagica({
  sucursalId,
  gajos,
  reglas,
  puedeGirar,
  motivo,
  volver,
  frecuenciaDiaria,
  enlacePremios,
  esDemo = false,
  modo = "real",
  recuerdo = null,
}: {
  sucursalId: string;
  gajos: Gajo[];
  reglas: string;
  puedeGirar: boolean;
  /** Por qué no puede girar quien mira. */
  motivo: "sin-sesion" | "sin-rol" | "propia" | null;
  volver: string;
  /** Para decir «vuelve mañana» cuando sale suerte. */
  frecuenciaDiaria: boolean;
  /** Dónde ve sus premios quien gira: la cuenta de cliente o la del negocio. */
  enlacePremios: string;
  /** Ruleta de demostración: gira siempre y no guarda el premio (000064). */
  esDemo?: boolean;
  modo?: ModoDeRuleta;
  /** En la de cacao: lo que ya ganó, para recordárselo al parar. */
  recuerdo?: { premio: string; codigo: string | null; esPremio: boolean } | null;
}) {
  const local = modo !== "real";
  const [angulo, setAngulo] = useState(0);
  const [girando, setGirando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sonido, setSonido] = useState(true);
  const router = useRouter();

  // Al cerrar el resultado, la página se vuelve a pintar: si ya no le toca
  // girar, la rueda grande se encoge a su aviso. La demo se queda como está.
  function cerrar() {
    setResultado(null);
    if (!esDemo && !local) router.refresh();
  }

  /**
   * El giro de la de cacao y de la vista previa: lo tira el navegador porque
   * no hay nada que ganar ni que guardar. En la vista previa respeta las
   * probabilidades para que el dueño vea cómo saldría.
   */
  function tiroLocal() {
    const total = gajos.reduce((s, g) => s + Number(g.probabilidad), 0) || 1;
    let tiro = Math.random() * total;
    const gajo = gajos.find((g) => (tiro -= Number(g.probabilidad)) < 0) ?? gajos[gajos.length - 1];
    return {
      gajo: gajo.gajo,
      premio: gajo.texto,
      esPremio: modo === "vista-previa" && gajo.esPremio,
      codigo: modo === "vista-previa" && gajo.esPremio ? "VISTA-PREVIA" : null,
      venceEn: null,
    };
  }

  const rueda = useRef<SVGGElement>(null);
  const flecha = useRef<SVGSVGElement>(null);
  const pendiente = useRef<Resultado | null>(null);
  const sonidoRef = useRef(true);
  const cuadro = useRef(0);

  // Las probabilidades, sumadas por premio: un premio repetido en dos gajos
  // se enseña una vez, con su chance completo.
  const chances = new Map<string, number>();
  for (const g of gajos) chances.set(g.texto, (chances.get(g.texto) ?? 0) + Number(g.probabilidad));

  /** Sigue la rueda mientras gira: un «tic» y un rebote por gajo que pasa. */
  function seguir() {
    const nodo = rueda.current;
    if (!nodo) return;
    let ultimo = -1;
    let previo = 0;
    const paso = () => {
      const m = getComputedStyle(nodo).transform;
      const partes = m.startsWith("matrix") ? m.slice(7, -1).split(",").map(Number) : [1, 0];
      const grados = ((Math.atan2(partes[1], partes[0]) * 180) / Math.PI + 360) % 360;
      const bajoLaFlecha = Math.floor(((360 - grados) % 360) / PASO);
      if (bajoLaFlecha !== ultimo) {
        if (ultimo !== -1) {
          const velocidad = Math.min(Math.abs(grados - previo) / 20, 1);
          if (sonidoRef.current) tic(velocidad);
          const f = flecha.current;
          if (f) {
            f.classList.remove("flechazo");
            void f.getBoundingClientRect();
            f.classList.add("flechazo");
          }
        }
        ultimo = bajoLaFlecha;
      }
      previo = grados;
      cuadro.current = requestAnimationFrame(paso);
    };
    cuadro.current = requestAnimationFrame(paso);
  }

  function terminar() {
    const final = pendiente.current;
    if (!final) return;
    pendiente.current = null;
    cancelAnimationFrame(cuadro.current);
    setGirando(false);
    setResultado(final);
    if (sonidoRef.current) (final.esPremio ? fanfarria : casi)();
  }

  async function girar() {
    if (girando) return;
    preparar();
    setError(null);
    setResultado(null);
    setGirando(true);

    const respuesta = local ? tiroLocal() : await girarRuleta(sucursalId);

    if ("error" in respuesta) {
      setGirando(false);
      setError(respuesta.error);
      return;
    }

    pendiente.current = {
      premio: respuesta.premio,
      esPremio: respuesta.esPremio,
      codigo: respuesta.codigo,
      venceEn: respuesta.venceEn,
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      terminar();
      return;
    }

    // El centro del gajo que salió, contado desde arriba en el sentido del
    // reloj, con un pequeño desvío para que no pare siempre al centro.
    const centro = (respuesta.gajo - 1) * PASO + PASO / 2 + (azar() - 0.5) * PASO * 0.6;
    const actual = ((angulo % 360) + 360) % 360;
    const falta = (360 - centro - actual + 720) % 360;
    setAngulo(angulo + 7 * 360 + falta);
    seguir();
    // Respaldo: si la pestaña se fue al fondo, el navegador no avisa del final.
    window.setTimeout(terminar, 6400);
  }

  useEffect(() => {
    const nodo = rueda.current;
    if (!nodo) return;
    const alTerminar = () => terminar();
    nodo.addEventListener("transitionend", alTerminar);
    return () => {
      nodo.removeEventListener("transitionend", alTerminar);
      cancelAnimationFrame(cuadro.current);
    };
  }, []);

  return (
    <div className="relative flex flex-col items-center gap-6">
      <button
        type="button"
        onClick={() => {
          sonidoRef.current = !sonido;
          setSonido(!sonido);
        }}
        aria-label={sonido ? "Silenciar la ruleta" : "Activar el sonido de la ruleta"}
        className="absolute right-0 top-0 z-20 grid size-10 place-items-center rounded-full border border-mango/40 text-lg"
      >
        {sonido ? "🔊" : "🔇"}
      </button>

      <div className={`relative w-full max-w-[24rem] ${girando ? "ruleta-girando" : ""}`}>
        {/* La flecha, arriba, que rebota con cada gajo que pasa. */}
        <svg
          ref={flecha}
          viewBox="0 0 40 46"
          aria-hidden
          className="absolute left-1/2 top-[-0.7rem] z-10 w-11 -translate-x-1/2 origin-top drop-shadow-[0_0_10px_rgba(255,209,102,0.9)]"
        >
          <path d="M20 44 L4 6 Q20 -2 36 6 Z" fill="#ffd166" stroke="#fff3c4" strokeWidth="2" />
        </svg>

        <svg viewBox="0 0 200 200" className="ruleta-rueda w-full">
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

          <circle cx="100" cy="100" r="98" fill="url(#aro-ruleta)" />
          {/* Las luces del aro: quietas en reposo, corren cuando gira. */}
          {Array.from({ length: 18 }, (_, i) => {
            const a = (i * 20 * Math.PI) / 180;
            return (
              <circle
                key={i}
                cx={r3(100 + 92 * Math.sin(a))}
                cy={r3(100 - 92 * Math.cos(a))}
                r="2.3"
                fill="#fff8dc"
                className="foco-ruleta"
                style={{ animationDelay: `${(i % 3) * 0.12}s` }}
              />
            );
          })}

          <g
            ref={rueda}
            style={{
              transform: `rotate(${angulo}deg)`,
              transformOrigin: "100px 100px",
              transition: "transform 6s cubic-bezier(0.1, 0.75, 0.1, 1)",
            }}
          >
            {gajos.map((g, i) => {
              const desde = ((i * PASO - 90) * Math.PI) / 180;
              const hasta = (((i + 1) * PASO - 90) * Math.PI) / 180;
              const r = 86;
              const color = (modo === "cacao" ? COLORES_CACAO : COLORES)[i % COLORES.length];
              const medio = i * PASO + PASO / 2;
              if (g.imagen) {
                // La ruleta de cacao: una imagen de pie en el centro del gajo,
                // mirando hacia afuera; el logo, sobre su círculo claro.
                const rad = (medio * Math.PI) / 180;
                const cx = r3(100 + 54 * Math.sin(rad));
                const cy = r3(100 - 54 * Math.cos(rad));
                const lado = 34;
                const esLogo = !g.imagen.startsWith("/");
                return (
                  <g key={i}>
                    <path
                      d={`M100 100 L${r3(100 + r * Math.cos(desde))} ${r3(100 + r * Math.sin(desde))} A${r} ${r} 0 0 1 ${r3(100 + r * Math.cos(hasta))} ${r3(100 + r * Math.sin(hasta))} Z`}
                      fill={color.fondo}
                      stroke="#fff3c4"
                      strokeWidth="1"
                    />
                    <g transform={`rotate(${medio} ${cx} ${cy})`}>
                      {esLogo && <circle cx={cx} cy={cy} r={lado / 2 + 1.5} fill="#fff7e8" stroke="#ffd166" strokeWidth="1.2" />}
                      <image
                        href={g.imagen}
                        x={cx - lado / 2}
                        y={cy - lado / 2}
                        width={lado}
                        height={lado}
                        preserveAspectRatio="xMidYMid meet"
                        clipPath={esLogo ? `circle(${lado / 2}px)` : undefined}
                        style={{ filter: "drop-shadow(0 0 3px rgba(255,209,102,0.7))" }}
                      />
                    </g>
                  </g>
                );
              }
              // El texto va a lo largo del radio, de dentro hacia fuera; en la
              // mitad izquierda se voltea para no quedar de cabeza.
              const volteado = medio > 180;
              const lineas = renglones(g.texto);
              const tam = lineas.some((l) => l.length > 11) ? 6.4 : 7.4;
              return (
                <g key={i}>
                  <path
                    d={`M100 100 L${r3(100 + r * Math.cos(desde))} ${r3(100 + r * Math.sin(desde))} A${r} ${r} 0 0 1 ${r3(100 + r * Math.cos(hasta))} ${r3(100 + r * Math.sin(hasta))} Z`}
                    fill={color.fondo}
                    stroke="#fff3c4"
                    strokeWidth="1"
                  />
                  <text
                    transform={`rotate(${volteado ? medio + 90 : medio - 90} 100 100)`}
                    x={volteado ? 45 : 155}
                    y={100}
                    textAnchor="middle"
                    fontSize={tam}
                    fontWeight="800"
                    fill={color.letra}
                    style={{ fontFamily: "var(--font-jakarta), sans-serif" }}
                  >
                    {lineas.map((linea, n) => (
                      <tspan
                        key={n}
                        x={volteado ? 45 : 155}
                        dy={n === 0 ? (lineas.length === 2 ? -tam * 0.15 : tam * 0.35) : tam * 1.15}
                      >
                        {linea}
                      </tspan>
                    ))}
                  </text>
                </g>
              );
            })}
          </g>

          <circle cx="100" cy="100" r="18" fill="url(#centro-ruleta)" stroke="url(#aro-ruleta)" strokeWidth="3" />
          <image href="/marca/mazorca.png" x="88" y="88" width="24" height="24" className="ruleta-centro" />
        </svg>
      </div>

      {puedeGirar ? (
        <button
          type="button"
          onClick={girar}
          disabled={girando}
          className="boton-oro brillo min-h-14 rounded-full px-10 font-display text-xl font-semibold text-ink disabled:opacity-70"
        >
          {girando ? "¡Girando!" : "¡Girar la ruleta!"}
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
          {motivo === "propia"
            ? "Es tu ruleta: así la ven tus visitantes. Gira las de otros negocios."
            : "Termina de crear tu cuenta para girar la ruleta."}
        </p>
      )}

      {error && (
        <p role="alert" className="max-w-md rounded-2xl border-2 border-mango/50 bg-mango/15 px-4 py-3 text-center font-bold">
          {error}
        </p>
      )}

      {modo === "cacao" ? (
        <p className="max-w-md text-center text-sm text-crema/70">
          Esta es la ruleta de cacao: ya no da premios, es solo para divertirte. Tu premio ya está
          guardado.
        </p>
      ) : (
        <div className="text-center text-sm text-crema/65">
          <p>{reglas}</p>
          <p className="mt-1">
            Probabilidades:{" "}
            {[...chances].map(([texto, chance], i) => (
              <span key={texto}>
                {i > 0 && " · "}
                {texto} {Math.round(chance * 10) / 10}%
              </span>
            ))}
          </p>
        </div>
      )}

      {resultado && (
        <div
          role="dialog"
          aria-label={resultado.esPremio ? "Ganaste un premio" : "Suerte para la próxima"}
          className="fixed inset-0 z-50 grid place-items-center bg-ink/70 p-4 backdrop-blur-sm"
        >
          {resultado.esPremio && <LluviaDeMazorcas />}
          <div className="relative w-full max-w-md animate-brinca rounded-[2rem] border border-mango/50 bg-[#14231c] p-8 text-center text-crema shadow-[0_0_80px_rgb(255_183_3/0.35)]">
            {modo === "cacao" ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element -- adorno del diálogo, ya ligero */}
                <img src="/parallax/flores-de-cacao.png" alt="" className="mx-auto h-20 w-auto drop-shadow-[0_0_14px_rgb(255_209_102/0.7)]" />
                <p className="mt-3 font-display text-3xl font-semibold">¡Qué buen giro!</p>
                {recuerdo?.esPremio ? (
                  <p className="mt-2 text-crema/80">
                    Ya tienes tu premio de esta ruleta: <strong className="text-mango">{recuerdo.premio}</strong>
                    {recuerdo.codigo && (
                      <>
                        {" "}· código <strong className="select-all font-mono tracking-wider text-mango">{recuerdo.codigo}</strong>
                      </>
                    )}
                    . Canjéalo en el negocio.
                  </p>
                ) : (
                  <p className="mt-2 text-crema/80">Ya giraste esta ruleta. Esta vuelta es solo por diversión.</p>
                )}
              </>
            ) : resultado.esPremio ? (
              <>
                <p className="antetitulo">{modo === "vista-previa" ? "Vista previa" : "¡Ganaste!"}</p>
                <p className="texto-oro mt-3 font-display text-4xl font-semibold leading-tight">{resultado.premio}</p>
                <p className="mt-5 text-sm text-crema/70">{esDemo ? "Código de muestra" : "Tu código"}</p>
                <p className="mt-1 select-all font-mono text-3xl font-bold tracking-[0.15em] text-mango">
                  {resultado.codigo}
                </p>
                {modo === "vista-previa" ? (
                  <p className="mt-3 text-sm text-crema/75">
                    Así lo verán tus clientes. En la vista previa el premio no se guarda.
                  </p>
                ) : esDemo ? (
                  <p className="mt-3 text-sm text-crema/75">
                    Es una ruleta de demostración: este premio no se guarda ni se canjea.
                    Gírala las veces que quieras.
                  </p>
                ) : resultado.venceEn && (
                  <p className="mt-3 text-sm text-crema/75">
                    Enséñalo en el negocio antes del{" "}
                    {FECHA.format(new Date(`${resultado.venceEn}T00:00:00Z`))}. Ya quedó guardado en tus
                    premios.
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="text-5xl">🍀</p>
                <p className="mt-3 font-display text-3xl font-semibold">¡Uy, casi!</p>
                <p className="mt-2 text-crema/75">
                  Suerte para la próxima.
                  {frecuenciaDiaria && !esDemo ? " Vuelve mañana por otro giro." : esDemo ? " Vuelve a girar cuando quieras." : ""}
                </p>
              </>
            )}
            <div className="mt-6 grid gap-3">
              {(modo === "cacao" ? recuerdo?.esPremio : resultado.esPremio && modo === "real") && !esDemo && (
                <Link
                  href={enlacePremios}
                  className="boton-oro brillo inline-flex min-h-12 items-center justify-center rounded-full px-6 font-bold text-ink"
                >
                  Ver mis premios
                </Link>
              )}
              {modo === "cacao" && (
                <button
                  type="button"
                  onClick={() => {
                    setResultado(null);
                    girar();
                  }}
                  className="boton-oro brillo inline-flex min-h-12 items-center justify-center rounded-full px-6 font-bold text-ink"
                >
                  Girar otra vez
                </button>
              )}
              {modo !== "vista-previa" && (
                <a
                  href="#resenas"
                  onClick={cerrar}
                  className="inline-flex min-h-12 items-center justify-center rounded-full border border-mango/40 px-6 font-bold transition-colors hover:border-mango hover:text-mango"
                >
                  Déjale una reseña o pregunta
                </a>
              )}
              <button
                type="button"
                onClick={cerrar}
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
