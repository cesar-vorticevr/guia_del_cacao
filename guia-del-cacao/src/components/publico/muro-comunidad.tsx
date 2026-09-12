"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { PortadaPublicacion } from "@/components/publico/portada-publicacion";
import { masDelMuro } from "@/lib/publico/muro";
import { MeGusta } from "@/components/publico/me-gusta";
import type { Entrada, Filtro } from "@/lib/datos/comunidad";

/**
 * El muro de la comunidad, agrupado por día y con scroll infinito.
 *
 * Las publicaciones van en la misma retícula que el directorio y el catálogo:
 * foto arriba, quién escribe y de qué trata debajo.
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
}: {
  iniciales: Entrada[];
  cursorInicial: string | null;
  haySesion: boolean;
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
        <div className="mt-5">
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {entradas.map((entrada) => (
              <li
                key={entrada.id}
                className="group flex h-full flex-col overflow-hidden rounded-3xl border-2 border-ink/10 bg-white shadow-dura transition-all hover:-translate-y-0.5 hover:shadow-dura-alta"
              >
                <Link href={entrada.href} className="flex flex-1 flex-col">
                  {/*
                        La foto en 4:3 y fuera del flujo, como en el directorio
                        y el catálogo: con `h-full` en el flujo, una foto alta
                        estira su caja y las tarjetas de la fila dejan de
                        alinearse.
                      */}
                  <span className="relative block aspect-[4/3] w-full shrink-0 overflow-hidden bg-crema-2">
                    <PortadaPublicacion
                      id={entrada.id}
                      foto={entrada.imagen}
                      titulo={entrada.titulo}
                      className="absolute inset-0 size-full"
                    />
                  </span>

                  <div className="flex flex-1 flex-col gap-1 p-4">
                    {/*
                          Quién escribe va primero: en una retícula de cuatro, lo
                          que hace abrir una publicación es de quién es y de qué
                          trata, en ese orden.
                        */}
                    <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                      <span className="font-bold text-selva-2">
                        {entrada.autor}
                      </span>

                      {entrada.detalle && (
                        <span className="w-full text-cacao/70">
                          {entrada.detalle}
                        </span>
                      )}

                      {entrada.oculta && (
                        <span className="rounded-full bg-ink/10 px-2 py-0.5 font-mono text-[0.7rem] font-bold text-cacao">
                          Oculta
                        </span>
                      )}
                    </p>

                    <p className="font-display text-base leading-tight font-semibold text-selva-2 underline-offset-4 group-hover:underline">
                      {entrada.titulo}
                    </p>

                    <p className="mt-auto line-clamp-3 pt-1 text-sm text-cacao">
                      {entrada.resumen}
                    </p>
                  </div>
                </Link>

                {/*
                      El corazón va fuera del enlace —un `button` dentro de un
                      `a` es HTML inválido— pero dentro de la misma caja, en su
                      franja al pie.
                    */}
                <div className="flex items-center gap-3 border-t-2 border-ink/5 px-4 py-2.5">
                  <MeGusta
                    clase="publicacion"
                    id={entrada.id}
                    inicial={entrada.miApoyo}
                    cuantos={entrada.apoyos}
                    comentarios={entrada.comentarios}
                    haySesion={haySesion}
                  />

                  {/*
                        El punto solo aparece cuando hay respuestas que esa
                        persona no ha visto. Si estuviera siempre que hay
                        comentarios, dejaría de significar "hay algo nuevo" y
                        sería parte del dibujo.
                      */}
                  {entrada.sinVer > 0 && (
                    <span
                      className="grid size-5 shrink-0 place-items-center rounded-full bg-guayaba font-mono text-xs font-bold text-ink"
                      aria-label={`${entrada.sinVer} sin leer`}
                    >
                      {entrada.sinVer}
                    </span>
                  )}

                  {/*
                    Cuánto lleva, pegado a la derecha con `ml-auto`. Estaba al
                    lado del autor y ahí se leía como parte del título; aquí es
                    lo que es: un dato de la esquina, junto a los otros dos
                    números.

                    La fecha completa va en el `title`, para quien quiera el
                    dato exacto sin que ocupe sitio.
                  */}
                  <span
                    title={entrada.fechaTexto}
                    className="ml-auto shrink-0 font-mono text-xs text-cacao/60"
                  >
                    {entrada.hace}
                  </span>
                </div>
              </li>
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
