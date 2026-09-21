"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PublicacionEnMuro } from "@/components/publico/publicacion-en-muro";
import { masDelMuro } from "@/lib/publico/muro";
import type { Entrada, Filtro } from "@/lib/datos/comunidad";

/**
 * El muro de la comunidad, en una columna y con scroll infinito.
 *
 * Las publicaciones van una debajo de otra, a lo ancho de la columna. Estuvo en
 * la misma retícula de cuatro que el directorio y el catálogo, y era el sitio
 * equivocado para ella: una retícula sirve para ojear y elegir, y un muro se
 * lee en orden. La columna devuelve ese orden y de paso deja que cada
 * publicación diga quién habla antes de lo que dijo.
 *
 * **Es un hilo continuo, sin cabeceras por día.** Las tuvo —"Hoy", "Ayer", el
 * nombre del día— y partían el muro en tramos que con pocas publicaciones
 * dejaban un encabezado por tarjeta. Ahora cada una dice en chico cuánto lleva
 * ("3 h", "2 d", "1 a"), que es lo que hace falta para ubicarla y no obliga a
 * cortar nada.
 *
 * **Los tramos los trae el servidor**, de diez en diez y con cursor. No se
 * cargan todas de golpe para luego irlas destapando: un muro crece sin techo, y
 * el día que haya mil publicaciones esa página pesaría mil publicaciones.
 *
 * El filtro también es del servidor y reinicia el recorrido: filtrar solo lo ya
 * cargado escondería lo viejo sin avisar.
 */
const FILTROS: { valor: Filtro; texto: string }[] = [
  { valor: "todo", texto: "Todo" },
  { valor: "mias", texto: "Mis publicaciones" },
  { valor: "nuevos", texto: "Comentarios nuevos" },
];

export function MuroComunidad({
  iniciales,
  cursorInicial,
  /** Sin sesión no se pintan «mis publicaciones» ni «comentarios nuevos». */
  haySesion,
  origen,
}: {
  iniciales: Entrada[];
  cursorInicial: string | null;
  haySesion: boolean;
  /** Origen del sitio, para los enlaces de compartir de cada tarjeta. */
  origen: string;
}) {
  const [filtro, setFiltro] = useState<Filtro>("todo");
  const [entradas, setEntradas] = useState(iniciales);
  const [cursor, setCursor] = useState(cursorInicial);
  const [cargando, setCargando] = useState(false);

  const centinela = useRef<HTMLDivElement | null>(null);

  /*
    Una petición a la vez. Sin esto, el observador dispara varias veces mientras
    el centinela sigue a la vista y el muro acaba con la misma página repetida
    tres veces.
  */
  const enVuelo = useRef(false);

  const traerMas = useCallback(async () => {
    if (enVuelo.current || cursor === null) return;

    enVuelo.current = true;
    setCargando(true);

    try {
      const pagina = await masDelMuro(filtro, cursor);

      setEntradas((previas) => {
        // Se descartan las repetidas por id: si alguien publica mientras otro
        // baja, un tramo puede traer algo que ya estaba en pantalla.
        const yaEstan = new Set(previas.map((e) => e.id));
        return [
          ...previas,
          ...pagina.entradas.filter((e) => !yaEstan.has(e.id)),
        ];
      });

      setCursor(pagina.siguiente);
    } finally {
      enVuelo.current = false;
      setCargando(false);
    }
  }, [cursor, filtro]);

  // El centinela va debajo del último día. Cuando entra en pantalla, se pide el
  // siguiente tramo; el margen de 400 px lo pide un poco antes de llegar, para
  // que el muro no se sienta parar.
  useEffect(() => {
    const nodo = centinela.current;
    if (!nodo || cursor === null) return;

    const observador = new IntersectionObserver(
      (entradas) => {
        if (entradas[0]?.isIntersecting) void traerMas();
      },
      { rootMargin: "400px" },
    );

    observador.observe(nodo);
    return () => observador.disconnect();
  }, [cursor, traerMas]);

  // Cambiar de filtro reinicia el recorrido: es otra consulta, con su cursor.
  const cambiarFiltro = async (nuevo: Filtro) => {
    if (nuevo === filtro) return;

    setFiltro(nuevo);
    setCargando(true);
    enVuelo.current = true;

    try {
      const pagina = await masDelMuro(nuevo, null);
      setEntradas(pagina.entradas);
      setCursor(pagina.siguiente);
    } finally {
      enVuelo.current = false;
      setCargando(false);
    }
  };

  const opciones = haySesion ? FILTROS : FILTROS.slice(0, 1);

  return (
    <>
      {opciones.length > 1 && (
        <nav aria-label="Filtrar el muro" className="pt-5">
          <ul className="flex flex-wrap gap-2.5">
            {opciones.map((opcion) => {
              const activa = filtro === opcion.valor;

              return (
                <li key={opcion.valor}>
                  <button
                    type="button"
                    onClick={() => void cambiarFiltro(opcion.valor)}
                    aria-pressed={activa}
                    className={`min-h-11 rounded-full border-2 border-ink/10 px-4 py-2 text-sm font-bold shadow-dura-sm transition-transform active:translate-y-0.5 ${
                      activa ? "bg-selva text-crema" : "bg-white text-cacao"
                    }`}
                  >
                    {opcion.texto}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      )}

      {entradas.length === 0 && !cargando ? (
        <p className="mt-5 rounded-3xl bg-crema-2 p-6 text-cacao">
          {filtro === "mias"
            ? "Todavía no has publicado nada."
            : filtro === "nuevos"
              ? "Nadie te ha respondido desde la última vez que miraste."
              : "Todavía no hay nada publicado."}
        </p>
      ) : (
        <div className="mt-4">
          {/*
            Una columna, no una retícula de cuatro.

            La retícula es de la portada y del directorio, donde se ojea para
            elegir. Un muro se lee en orden, y en cuatro columnas el orden deja
            de existir: la vista salta, no hay "la siguiente", y lo publicado
            hace un minuto y hace un mes comparten fila con el mismo peso.
          */}
          <ul className="grid gap-4">
            {entradas.map((entrada) => (
              <PublicacionEnMuro
                key={entrada.id}
                entrada={entrada}
                haySesion={haySesion}
                origen={origen}
              />
            ))}
          </ul>

          {/*
            El centinela y el aviso de carga. El aviso existe para que bajar al
            final no se sienta el final: sin él, el segundo que tarda el tramo
            parece que ya no hay nada más.
          */}
          <div ref={centinela} aria-hidden={!cargando}>
            {cargando && (
              <p role="status" className="py-4 text-center text-cacao/70">
                Trayendo más…
              </p>
            )}

            {cursor === null && entradas.length > 0 && (
              <p className="py-4 text-center text-sm text-cacao/50">
                Llegaste al final del muro.
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
