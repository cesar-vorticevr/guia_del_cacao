"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef } from "react";

/**
 * Las capas decorativas del fondo: ramas, hojas y mazorcas que se desplazan a
 * distinta velocidad al hacer scroll.
 *
 * El modelo es una cinta infinita, no una posición fija en el documento: cada
 * pieza entra por abajo, sube a su propia velocidad y cuando termina de salir
 * por arriba vuelve a aparecer abajo. Se eligió así porque no depende del alto
 * de la página — el directorio mide tres pantallas y un micrositio quince, y
 * con posiciones absolutas la mitad de abajo del sitio se quedaba pelona.
 *
 * Nada de esto se anima con CSS: la posición se escribe a mano sobre el nodo
 * dentro de un requestAnimationFrame. Una transición CSS sobre `transform`
 * pelearía con el scroll y dejaría las piezas siempre un paso atrás.
 */

type Forma = "hoja" | "mazorca" | "grano" | "flor" | "rama" | "arco";

type Pieza = {
  archivo: string;
  /** alto ÷ ancho. Fija el alto del hueco y con él la distancia del recorrido. */
  proporcion: number;
  /** Qué dibujar mientras no exista el PNG. */
  forma: Forma;
  color: string;
};

/**
 * El catálogo. `archivo` es el nombre exacto de `public/parallax/`; mientras
 * un archivo no esté, se pinta el marcador de su forma. Las proporciones salen
 * de las medidas reales de cada PNG, documentadas en el `LEEME.md` de esa
 * carpeta: las ramas verticales son 1024×1536, la horizontal 1536×1024 y las
 * sueltas 1254×1254.
 *
 * Son ocho y no nueve porque solo llegó **una** hoja suelta. No es un hueco:
 * la hoja se usa dos veces con distinto giro y espejo, que era el plan desde
 * el encargo — por eso se pidió asimétrica.
 */
const PIEZAS = {
  ramaTresMazorcas: { archivo: "rama-tres-mazorcas.png", proporcion: 1.5, forma: "rama", color: "#106b46" },
  ramaUnaMazorca: { archivo: "rama-una-mazorca.png", proporcion: 1.5, forma: "rama", color: "#a8d94a" },
  ramaDeHojas: { archivo: "rama-de-hojas.png", proporcion: 0.667, forma: "arco", color: "#0c5236" },
  hoja: { archivo: "hoja.png", proporcion: 1, forma: "hoja", color: "#106b46" },
  mazorcaAmarilla: { archivo: "mazorca-amarilla.png", proporcion: 1, forma: "mazorca", color: "#ffb703" },
  mazorcaRosa: { archivo: "mazorca-rosa.png", proporcion: 1, forma: "mazorca", color: "#ff5d73" },
  flores: { archivo: "flores-de-cacao.png", proporcion: 1, forma: "flor", color: "#ff5d73" },
  granos: { archivo: "granos-de-cacao.png", proporcion: 1, forma: "grano", color: "#8a5a3c" },
} as const satisfies Record<string, Pieza>;

type Instancia = {
  pieza: keyof typeof PIEZAS;
  /**
   * De qué borde de la columna de contenido cuelga, hacia afuera. `centrada`
   * es la excepción: se planta detrás de la columna, no a un lado.
   */
  lado: "izquierda" | "derecha" | "centrada";
  /**
   * Cuántos píxeles de la pieza asoman dentro de la pantalla. El resto queda
   * fuera, cortado por la orilla.
   *
   * Se mide contra la **pantalla** y no contra la columna de contenido. Antes
   * colgaban de la columna —1180 px como mucho— así que en un monitor ancho las
   * piezas se quedaban a trescientos píxeles del borde y el fondo no llegaba a
   * las orillas. Contra la pantalla llegan siempre, y decir cuánto asoma en vez
   * de cuánto se separa hace que el resultado no dependa del ancho del monitor.
   */
  asomo: number;
  ancho: number;
  /** Fracción del recorrido en la que arranca, para que no suban todas juntas. */
  fase: number;
  /** Fracción de la velocidad del scroll. Más bajo = se siente más lejos. */
  velocidad: number;
  giro: number;
  espejo?: boolean;
  opacidad: number;
  /** Ancho mínimo de pantalla en el que aparece. */
  desde: 0 | 640 | 1280;
};

/**
 * La escenografía. Once piezas, no más: el primer ensayo llevaba catorce y los
 * márgenes se veían un jardín, no una decoración.
 *
 * Las ramas grandes solo aparecen de 1280 para arriba, que es donde hay margen
 * de verdad. Debajo de eso quedan las piezas chicas, metidas hacia afuera para
 * que se asomen recortadas por la orilla y no caigan sobre el texto.
 *
 * Las opacidades son bajas a propósito. Esto pasa por detrás de párrafos sobre
 * fondo crema, y una hoja al 100% detrás del texto no es decoración, es un
 * problema de legibilidad.
 */
const INSTANCIAS: Instancia[] = [
  { pieza: "ramaTresMazorcas", lado: "izquierda", asomo: 240, ancho: 380, fase: 0, velocidad: 0.15, giro: 0, opacidad: 0.42, desde: 1280 },
  { pieza: "ramaTresMazorcas", lado: "derecha", asomo: 200, ancho: 320, fase: 0.62, velocidad: 0.19, giro: 6, espejo: true, opacidad: 0.32, desde: 1280 },
  { pieza: "ramaUnaMazorca", lado: "derecha", asomo: 190, ancho: 290, fase: 0.28, velocidad: 0.26, giro: -6, espejo: true, opacidad: 0.38, desde: 1280 },
  { pieza: "ramaUnaMazorca", lado: "izquierda", asomo: 160, ancho: 250, fase: 0.8, velocidad: 0.3, giro: 5, opacidad: 0.32, desde: 1280 },

  // La rama de hojas es horizontal: en un margen de 130 px no cabe de ninguna
  // manera. Su lugar es detrás de todo, ancha y casi transparente — a esta
  // opacidad es textura del fondo, no un dibujo que compita con lo que se lee.
  { pieza: "ramaDeHojas", lado: "centrada", asomo: 900, ancho: 900, fase: 0.45, velocidad: 0.1, giro: 0, opacidad: 0.12, desde: 1280 },

  { pieza: "mazorcaAmarilla", lado: "izquierda", asomo: 85, ancho: 120, fase: 0.18, velocidad: 0.42, giro: -12, opacidad: 0.34, desde: 640 },
  { pieza: "mazorcaRosa", lado: "derecha", asomo: 78, ancho: 110, fase: 0.66, velocidad: 0.47, giro: 14, opacidad: 0.34, desde: 640 },
  { pieza: "hoja", lado: "izquierda", asomo: 72, ancho: 105, fase: 0.38, velocidad: 0.56, giro: 25, opacidad: 0.36, desde: 640 },

  // Las tres que también salen en celular, donde la columna se come la pantalla
  // entera y lo único disponible es la orilla. La segunda hoja es la misma
  // ilustración volteada y con otro giro: por eso se pidió asimétrica.
  { pieza: "flores", lado: "izquierda", asomo: 52, ancho: 80, fase: 0.52, velocidad: 0.72, giro: 0, opacidad: 0.3, desde: 0 },
  { pieza: "granos", lado: "derecha", asomo: 48, ancho: 75, fase: 0.22, velocidad: 0.82, giro: 20, opacidad: 0.26, desde: 0 },
  { pieza: "hoja", lado: "derecha", asomo: 60, ancho: 95, fase: 0.88, velocidad: 0.64, giro: -30, espejo: true, opacidad: 0.3, desde: 0 },
];

const VISIBILIDAD: Record<Instancia["desde"], string> = {
  0: "",
  640: "hidden sm:block",
  1280: "hidden xl:block",
};

/** El `%` de JavaScript devuelve negativo con dividendo negativo; este no. */
function modulo(a: number, n: number) {
  return ((a % n) + n) % n;
}

/**
 * La pieza centrada se planta en `left: 50%` y se recorre media anchura para
 * quedar al centro de verdad. Va en el mismo `transform` que el movimiento
 * porque un elemento tiene uno solo: si se pusiera aparte, el que corre en cada
 * cuadro lo borraría.
 */
function corrimiento(instancia: Instancia) {
  return instancia.lado === "centrada" ? -instancia.ancho / 2 : 0;
}

/** De qué borde de la pantalla cuelga, y cuánto se queda fuera. */
function anclaje(instancia: Instancia) {
  if (instancia.lado === "centrada") return { left: "50%" };

  // Lo que no asoma se sale por la orilla, en negativo.
  const fuera = -(instancia.ancho - instancia.asomo);
  return instancia.lado === "izquierda" ? { left: fuera } : { right: fuera };
}

export function CapasDeCacao({
  disponibles,
  /**
   * `pantalla` cuelga el fondo del viewport y acompaña a todo el sitio.
   * `franja` lo encierra en la sección que lo contenga, que debe ser
   * `relative` y recortar lo que se salga.
   */
  variante = "pantalla",
  /**
   * Deja fuera la pieza centrada, que es la única que pasa por detrás del
   * texto en vez de asomarse por la orilla.
   *
   * Existe porque el fondo se quitó una vez de detrás del contenido: competía
   * con lo que se venía a leer. En el encabezado de la portada hace falta que
   * se vea cacao, pero no a costa de leer el titular sobre una rama.
   */
  soloOrillas = false,
}: {
  disponibles: string[];
  variante?: "pantalla" | "franja";
  soloOrillas?: boolean;
}) {
  const nodos = useRef<(HTMLDivElement | null)[]>([]);
  const caja = useRef<HTMLDivElement | null>(null);
  const yaEstan = new Set(disponibles);

  // Se filtra una vez y se usa la misma lista en el efecto y al pintar: si las
  // dos recorrieran listas distintas, los índices de `nodos` dejarían de
  // corresponder y cada pieza se movería con la velocidad de otra.
  const piezas = useMemo(
    () =>
      soloOrillas ? INSTANCIAS.filter((i) => i.lado !== "centrada") : INSTANCIAS,
    [soloOrillas],
  );

  useEffect(() => {
    // El contenedor ya se oculta solo con `motion-reduce:hidden`; esto es para
    // no gastar cuadros calculando posiciones que nadie va a ver.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let pendiente = 0;

    const colocar = () => {
      pendiente = 0;

      // El recorrido se mide contra la caja donde vive el fondo. Colgado del
      // viewport es la pantalla; dentro de una franja es la franja, y usar la
      // pantalla ahí dejaría a casi todas las piezas fuera del recorte.
      const alto =
        variante === "franja"
          ? (caja.current?.offsetHeight ?? window.innerHeight)
          : window.innerHeight;

      const y = window.scrollY;

      piezas.forEach((instancia, i) => {
        const nodo = nodos.current[i];
        if (!nodo) return;

        // Lo que tarda la pieza en cruzar: de asomada por abajo a salida por
        // arriba. Cuando el avance llega aquí, el módulo la devuelve al inicio
        // y el salto no se ve porque ocurre fuera de la pantalla.
        const recorrido = alto + instancia.ancho * PIEZAS[instancia.pieza].proporcion;
        const avance = y * instancia.velocidad + instancia.fase * recorrido;
        const desplazamiento = alto - modulo(avance, recorrido);

        nodo.style.transform =
          `translate3d(${corrimiento(instancia)}px, ${desplazamiento.toFixed(1)}px, 0)` +
          ` rotate(${instancia.giro}deg)` +
          (instancia.espejo ? " scaleX(-1)" : "");
      });
    };

    const alMoverse = () => {
      if (pendiente) return;
      pendiente = requestAnimationFrame(colocar);
    };

    colocar();
    window.addEventListener("scroll", alMoverse, { passive: true });
    window.addEventListener("resize", alMoverse);

    return () => {
      if (pendiente) cancelAnimationFrame(pendiente);
      window.removeEventListener("scroll", alMoverse);
      window.removeEventListener("resize", alMoverse);
    };
  }, [variante, piezas]);

  return (
    <div
      ref={caja}
      aria-hidden
      className={`pointer-events-none z-0 overflow-hidden select-none motion-reduce:hidden ${
        variante === "franja"
          ? "absolute inset-y-0 left-1/2 w-[104vw] -translate-x-1/2"
          : "fixed inset-0"
      }`}
    >
      {/*
        La referencia es el ancho entero, no la columna de contenido.

        Antes esto repetía el ancho del `main` —1180 px como mucho— y las piezas
        colgaban de sus bordes. En un monitor de 1850 eso las dejaba a
        trescientos píxeles de la orilla: el fondo se acababa antes que la
        pantalla y se veía una franja de crema vacía a cada lado.

        Colgando de la pantalla llegan siempre al borde, y lo que las mantiene
        lejos del texto ya no es esta caja sino cuánto asoma cada una: casi
        todas se quedan medio cortadas por la orilla, que es donde el contenido
        no llega ni en celular.
      */}
      <div className="relative h-full w-full">
        {piezas.map((instancia, i) => {
          const pieza = PIEZAS[instancia.pieza];
          const existe = yaEstan.has(pieza.archivo);

          return (
            <div
              key={i}
              ref={(nodo) => {
                nodos.current[i] = nodo;
              }}
              className={`absolute top-0 will-change-transform ${VISIBILIDAD[instancia.desde]}`}
              style={{
                ...anclaje(instancia),
                width: instancia.ancho,
                height: instancia.ancho * pieza.proporcion,
                opacity: instancia.opacidad,
                // Antes de que corra el JS todas viven debajo del pliegue: si
                // arrancaran en `top: 0` se vería un amontonamiento en la
                // primera pintada.
                transform: `translate3d(${corrimiento(instancia)}px, 110vh, 0)`,
              }}
            >
              {existe ? (
                /*
                  Va por `next/image` y no por un `img` pelón como el resto del
                  sitio. Los otros apuntan a Storage, que Next no puede tocar;
                  estos son estáticos y pesan 8 MB entre los ocho. Con `sizes`
                  en el ancho exacto al que se ve, Next sirve un WebP de ese
                  tamaño y no el PNG completo — un adorno de fondo no puede
                  costar más que la página.
                */
                <Image
                  src={`/parallax/${pieza.archivo}`}
                  alt=""
                  fill
                  sizes={`${instancia.ancho}px`}
                  className="object-contain"
                />
              ) : (
                <Marcador forma={pieza.forma} color={pieza.color} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * El dibujo de relleno mientras la ilustración de verdad no existe.
 *
 * No pretende ser bonito: sirve para ver el movimiento, los tamaños y en qué
 * parte de la pantalla cae cada capa antes de tener los PNG. Respeta la paleta
 * y el contorno café del sistema para que el ensayo se parezca al resultado.
 */
function Marcador({ forma, color }: { forma: Forma; color: string }) {
  const comun = {
    className: "size-full",
    xmlns: "http://www.w3.org/2000/svg",
    fill: "none",
    stroke: "#4a2c1d",
    strokeWidth: 9,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  } as const;

  if (forma === "hoja") {
    return (
      <svg {...comun} viewBox="0 0 200 200">
        <path d="M100 22 C152 62 158 142 100 180 C42 142 48 62 100 22 Z" fill={color} />
        <path d="M100 34 L100 168" />
        <path d="M100 70 L128 58 M100 70 L72 58 M100 104 L134 96 M100 104 L66 96" />
      </svg>
    );
  }

  if (forma === "mazorca") {
    return (
      <svg {...comun} viewBox="0 0 200 200">
        <path d="M100 40 L100 22" />
        <path d="M100 34 C142 66 144 148 100 182 C56 148 58 66 100 34 Z" fill={color} />
        <path d="M100 40 C118 78 118 142 100 176 M100 40 C82 78 82 142 100 176" />
        <path d="M76 56 C66 96 68 136 82 168 M124 56 C134 96 132 136 118 168" />
      </svg>
    );
  }

  if (forma === "grano") {
    return (
      <svg {...comun} viewBox="0 0 200 200">
        <path d="M74 30 C104 42 108 88 74 108 C40 88 44 42 74 30 Z" fill={color} />
        <path d="M74 42 C82 62 82 88 74 100" />
        <path d="M132 92 C162 104 166 150 132 170 C98 150 102 104 132 92 Z" fill={color} />
        <path d="M132 104 C140 124 140 150 132 162" />
      </svg>
    );
  }

  if (forma === "flor") {
    return (
      <svg {...comun} viewBox="0 0 200 200">
        {[0, 72, 144, 216, 288].map((angulo) => (
          <ellipse
            key={angulo}
            cx="100"
            cy="58"
            rx="24"
            ry="36"
            fill={color}
            transform={`rotate(${angulo} 100 100)`}
          />
        ))}
        <circle cx="100" cy="100" r="20" fill="#ffb703" />
      </svg>
    );
  }

  if (forma === "rama") {
    return (
      <svg {...comun} viewBox="0 0 200 300">
        <path d="M0 250 C60 240 110 200 140 130 C152 100 152 70 148 40" strokeWidth={14} />
        <ellipse cx="58" cy="196" rx="26" ry="44" fill={color} transform="rotate(-38 58 196)" />
        <ellipse cx="112" cy="140" rx="24" ry="40" fill={color} transform="rotate(-18 112 140)" />
        <ellipse cx="156" cy="72" rx="22" ry="38" fill={color} transform="rotate(14 156 72)" />
        <ellipse cx="96" cy="238" rx="22" ry="36" fill={color} transform="rotate(34 96 238)" />
        <ellipse cx="150" cy="188" rx="20" ry="34" fill="#ffb703" />
      </svg>
    );
  }

  return (
    <svg {...comun} viewBox="0 0 300 200">
      <path d="M0 46 C80 132 220 132 300 56" strokeWidth={12} />
      <ellipse cx="52" cy="128" rx="18" ry="34" fill={color} transform="rotate(-14 52 128)" />
      <ellipse cx="106" cy="158" rx="18" ry="34" fill={color} transform="rotate(-6 106 158)" />
      <ellipse cx="162" cy="162" rx="18" ry="34" fill={color} transform="rotate(6 162 162)" />
      <ellipse cx="218" cy="142" rx="18" ry="34" fill={color} transform="rotate(12 218 142)" />
      <ellipse cx="266" cy="110" rx="18" ry="34" fill={color} transform="rotate(20 266 110)" />
    </svg>
  );
}
