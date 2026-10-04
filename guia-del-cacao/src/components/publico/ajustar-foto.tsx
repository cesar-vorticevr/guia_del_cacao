"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ACERCAMIENTO_MAXIMO,
  ENCUADRE_CENTRADO,
  acercar,
  medidasEnMarco,
  mover,
  ponerEnCampo,
  recortar,
  sePuedeEncuadrar,
  type Encuadre,
  type Medidas,
} from "@/lib/recorte";

/**
 * Acomodar la foto antes de subirla: moverla y acercarla dentro del marco.
 *
 * Lo que había era una promesa y una disculpa: la vista previa enseñaba el
 * recorte centrado y debajo decía «si algo importante queda fuera, recorta la
 * foto antes de subirla». Quien subía una foto vertical con la cara arriba
 * tenía que salir a otra aplicación, recortar allá, volver y subir. La mayoría
 * no vuelve: publica la foto mal recortada, o no publica.
 *
 * Aquí se arrastra con el dedo, se pellizca con dos, y lo que queda dentro del
 * marco es exactamente lo que se sube, ya recortado por el navegador. El
 * servidor recibe una foto que ya tiene la proporción buena y no tiene que
 * adivinar nada.
 *
 * **Se abre solo, en cuanto se elige el archivo.** Un botón de «acomodar» al
 * lado de la miniatura se descubre tarde: para entonces la foto ya se subió
 * como salió. Abrirlo de entrada cuesta un toque a quien no quería tocar nada
 * —el botón grande dice «Listo» y la foto llega centrada, igual que antes— y le
 * ahorra el viaje a quien sí.
 *
 * Con varias fotos se pasa una por una, contando cuántas faltan: es el orden en
 * que se eligieron y es el orden en que van a salir en el carrusel.
 */
export function AjustarFotos({
  archivos,
  proporcion,
  alTerminar,
}: {
  /** Las que se acaban de elegir, en su orden. Solo fotos: un video no se recorta. */
  archivos: File[];
  /** La forma del marco, ancho entre alto. La misma con la que se va a ver. */
  proporcion: number;
  /**
   * Los recortes, en el orden de `archivos`.
   *
   * **Pueden venir menos de las que entraron**, y quien recibe tiene que contar
   * con ello: cerrar a media cola —«Dejarla así», Escape— devuelve las que ya
   * se acomodaron y deja las demás como estaban. Se emparejan por posición: la
   * primera es la primera.
   *
   * Cerrar nunca descarta la foto elegida. Quien abrió esto sin querer sale
   * pulsando una vez y sube lo mismo que habría subido antes, recortado
   * centrado por el servidor.
   */
  alTerminar: (recortadas: File[]) => void;
}) {
  const [indice, setIndice] = useState(0);
  const [hechas, setHechas] = useState<File[]>([]);

  /*
    La dirección con la que el navegador pinta la foto que se está acomodando.

    **Se crea y se tira en los manejadores de evento, nunca al pintar.** Un
    `createObjectURL` reserva memoria y hay que devolverla a mano; hecho en el
    render —con un `useMemo` y un efecto que revoca al limpiar— el doble montaje
    de StrictMode revocaba la dirección entre la primera pintada y la segunda y
    el marco salía en negro. Aquí cada dirección nace cuando se pasa de foto y
    muere en esa misma línea.
  */
  const [url, setUrl] = useState(() =>
    archivos[0] ? URL.createObjectURL(archivos[0]) : "",
  );

  const archivo = archivos[indice];

  /*
    El fondo quieto mientras dure: sin bloquear el desplazamiento del
    documento, arrastrar la foto hacia abajo en un teléfono arrastra la página
    de detrás y el marco se va de la pantalla.
  */
  useEffect(() => {
    const comoEstaba = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = comoEstaba;
    };
  }, []);

  useEffect(() => {
    const alTeclear = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") cerrar();
    };

    document.addEventListener("keydown", alTeclear);
    return () => document.removeEventListener("keydown", alTeclear);
  });

  function cerrar() {
    URL.revokeObjectURL(url);
    alTerminar(hechas);
  }

  function seguir(recortada: File) {
    const hasta = [...hechas, recortada];

    URL.revokeObjectURL(url);

    if (indice + 1 >= archivos.length) {
      alTerminar(hasta);
      return;
    }

    setUrl(URL.createObjectURL(archivos[indice + 1]));
    setHechas(hasta);
    setIndice(indice + 1);
  }

  if (!archivo) return null;

  /*
    El portal sale del formulario a propósito. Esto es `position: fixed`, y
    dentro de un contenedor con `transform` u `overflow` —que los hay, el muro
    está lleno de tarjetas— un fijo deja de ser fijo y se queda recortado dentro
    de la tarjeta.

    Se puede llamar a `document` sin comprobar nada porque esto solo se monta
    desde el `change` de un campo de archivo: en el servidor no llega a
    existir.
  */
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Acomodar la foto"
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-ink/90 p-4"
    >
      {/*
        La `key` por posición es lo que deja este componente sin ceremonia de
        reinicio: al pasar a la siguiente foto, React monta uno nuevo y el
        encuadre, las medidas y la imagen cargada nacen de cero. Sin ella habría
        que acordarse de poner a mano cada cosa en su sitio, y la que se olvide
        se lleva el encuadre de la foto anterior.
      */}
      <UnaFoto
        key={indice}
        archivo={archivo}
        url={url}
        proporcion={proporcion}
        indice={indice}
        total={archivos.length}
        alSeguir={seguir}
        alCerrar={cerrar}
      />
    </div>,
    document.body,
  );
}

/** Una foto en su marco, con todo lo que se le puede hacer. */
function UnaFoto({
  archivo,
  url,
  proporcion,
  indice,
  total,
  alSeguir,
  alCerrar,
}: {
  archivo: File;
  /** Ya hecha por quien manda la cola, que es quien sabe cuándo tirarla. */
  url: string;
  proporcion: number;
  indice: number;
  total: number;
  alSeguir: (recortada: File) => void;
  alCerrar: () => void;
}) {
  const [medidas, setMedidas] = useState<Medidas | null>(null);
  const [encuadre, setEncuadre] = useState<Encuadre>(ENCUADRE_CENTRADO);
  const [trabajando, setTrabajando] = useState(false);

  const marcoRef = useRef<HTMLDivElement>(null);
  const fotoRef = useRef<HTMLImageElement>(null);
  const punteros = useRef(new Map<number, { x: number; y: number }>());

  const ultima = indice + 1 >= total;

  /*
    La rueda del ratón se escucha a mano y no con `onWheel` porque hay que
    llamar a `preventDefault`: React registra ese evento como pasivo, y en un
    oyente pasivo el navegador ignora la cancelación y desplaza la página
    mientras se intenta acercar la foto.
  */
  useEffect(() => {
    const marco = marcoRef.current;
    if (!marco || !medidas) return;

    const alRodar = (evento: WheelEvent) => {
      evento.preventDefault();

      const caja = marco.getBoundingClientRect();

      const foco = {
        x: (evento.clientX - caja.left) / caja.width - 0.5,
        y: (evento.clientY - caja.top) / caja.height - 0.5,
      };

      setEncuadre((antes) =>
        acercar(
          antes,
          Math.exp(-evento.deltaY * 0.0015),
          foco,
          medidas,
          proporcion,
        ),
      );
    };

    marco.addEventListener("wheel", alRodar, { passive: false });
    return () => marco.removeEventListener("wheel", alRodar);
  }, [medidas, proporcion]);

  function alBajarPuntero(evento: React.PointerEvent<HTMLDivElement>) {
    evento.currentTarget.setPointerCapture(evento.pointerId);
    punteros.current.set(evento.pointerId, {
      x: evento.clientX,
      y: evento.clientY,
    });
  }

  function alSoltarPuntero(evento: React.PointerEvent<HTMLDivElement>) {
    punteros.current.delete(evento.pointerId);
  }

  /**
   * Un dedo mueve; dos pellizcan.
   *
   * Los punteros se guardan en un mapa por identificador porque es la única
   * forma de saber dónde está el otro dedo: cada evento trae uno solo. Con el
   * anterior y el actual de este, más la última posición del otro, salen las
   * dos cosas que hacen falta — cuánto se separaron los dedos (el acercamiento)
   * y hacia dónde se fue el punto medio (el arrastre).
   */
  function alMoverPuntero(evento: React.PointerEvent<HTMLDivElement>) {
    const puntos = punteros.current;
    const previo = puntos.get(evento.pointerId);
    const marco = marcoRef.current;

    if (!previo || !marco || !medidas) return;

    const ahora = { x: evento.clientX, y: evento.clientY };
    const otro = [...puntos].find(([id]) => id !== evento.pointerId)?.[1];

    puntos.set(evento.pointerId, ahora);

    const caja = marco.getBoundingClientRect();
    if (!caja.width || !caja.height) return;

    if (!otro) {
      const paso = {
        x: (ahora.x - previo.x) / caja.width,
        y: (ahora.y - previo.y) / caja.height,
      };

      setEncuadre((antes) => mover(antes, paso, medidas, proporcion));
      return;
    }

    const separados = (
      a: { x: number; y: number },
      b: { x: number; y: number },
    ) => Math.hypot(a.x - b.x, a.y - b.y);

    const antesSeparados = separados(previo, otro);
    if (antesSeparados < 1) return;

    const medio = (a: { x: number; y: number }, b: { x: number; y: number }) => ({
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
    });

    const centroAntes = medio(previo, otro);
    const centroAhora = medio(ahora, otro);

    const foco = {
      x: (centroAntes.x - caja.left) / caja.width - 0.5,
      y: (centroAntes.y - caja.top) / caja.height - 0.5,
    };

    const factor = separados(ahora, otro) / antesSeparados;

    const arrastre = {
      x: (centroAhora.x - centroAntes.x) / caja.width,
      y: (centroAhora.y - centroAntes.y) / caja.height,
    };

    setEncuadre((antes) =>
      mover(
        acercar(antes, factor, foco, medidas, proporcion),
        arrastre,
        medidas,
        proporcion,
      ),
    );
  }

  /**
   * Con el teclado: flechas para mover, más y menos para acercar.
   *
   * No es un adorno de accesibilidad. En escritorio, afinar un encuadre con el
   * ratón a pulso es difícil; con las flechas se mueve de a poco y no se
   * escapa. Con Shift el paso es cinco veces más largo, para cruzar la foto sin
   * cincuenta pulsaciones.
   */
  function alTeclearEnMarco(evento: React.KeyboardEvent<HTMLDivElement>) {
    if (!medidas) return;

    const paso = evento.shiftKey ? 0.1 : 0.02;

    const flechas: Record<string, { x: number; y: number }> = {
      ArrowLeft: { x: -paso, y: 0 },
      ArrowRight: { x: paso, y: 0 },
      ArrowUp: { x: 0, y: -paso },
      ArrowDown: { x: 0, y: paso },
    };

    const direccion = flechas[evento.key];

    if (direccion) {
      evento.preventDefault();
      setEncuadre((antes) => mover(antes, direccion, medidas, proporcion));
      return;
    }

    if (evento.key === "+" || evento.key === "=" || evento.key === "-") {
      evento.preventDefault();

      setEncuadre((antes) =>
        acercar(
          antes,
          evento.key === "-" ? 1 / 1.15 : 1.15,
          { x: 0, y: 0 },
          medidas,
          proporcion,
        ),
      );
    }
  }

  function alDeslizar(evento: React.ChangeEvent<HTMLInputElement>) {
    if (!medidas) return;

    const pedida = Number(evento.target.value);

    setEncuadre((antes) =>
      acercar(antes, pedida / antes.escala, { x: 0, y: 0 }, medidas, proporcion),
    );
  }

  /**
   * Guardar esta y pasar a la siguiente, o terminar.
   *
   * Si la foto no llegó a cargarse —formato que el navegador no pinta, archivo
   * roto— pasa el original sin tocar. El servidor lo recortará centrado, que es
   * lo que hacía antes de que esto existiera.
   */
  async function seguir() {
    if (trabajando) return;

    setTrabajando(true);

    const foto = fotoRef.current;

    const recortada =
      foto && medidas
        ? await recortar(foto, encuadre, proporcion, archivo)
        : archivo;

    setTrabajando(false);
    alSeguir(recortada);
  }

  /*
    Cuánto ocupa la foto dentro del marco, en porcentajes del marco. Se pinta
    con las mismas medidas con las que se recorta —las de `recorte.ts`— y no con
    un cálculo propio: si los dos se separaran, lo que se ve aquí dejaría de ser
    lo que se sube, que es justo el defecto que esto arregla.
  */
  const dentro = medidas && medidasEnMarco(medidas, proporcion, encuadre.escala);

  return (
    <div className="grid w-full max-w-lg gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-crema">
          Acomoda tu foto
        </h2>

        {total > 1 && (
          <span aria-live="polite" className="font-mono text-sm text-crema/70">
            {indice + 1} de {total}
          </span>
        )}
      </div>

      {/*
        El marco tiene la forma de la foto que se va a ver, no la de la
        pantalla: `aspectRatio` se la da y el `maxWidth` en `vh` lo encoge
        cuando la pantalla es más baja que ancha, para que no se coma los
        botones. Con `width: 100%` y `maxHeight` habría pasado lo contrario: se
        recortaría la altura y la proporción sería mentira.
      */}
      <div
        ref={marcoRef}
        tabIndex={0}
        onPointerDown={alBajarPuntero}
        onPointerMove={alMoverPuntero}
        onPointerUp={alSoltarPuntero}
        onPointerCancel={alSoltarPuntero}
        onKeyDown={alTeclearEnMarco}
        aria-label="Arrastra la foto para acomodarla. Con el teclado: flechas para moverla, más y menos para acercarla."
        style={{
          aspectRatio: `${proporcion}`,
          maxWidth: `min(100%, ${(60 * proporcion).toFixed(2)}vh)`,
        }}
        className="relative mx-auto w-full cursor-grab touch-none overflow-hidden rounded-2xl border-2 border-crema/20 bg-ink select-none focus-visible:border-mango focus-visible:outline-none active:cursor-grabbing"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={fotoRef}
          src={url}
          alt=""
          draggable={false}
          onLoad={(evento) =>
            setMedidas({
              ancho: evento.currentTarget.naturalWidth,
              alto: evento.currentTarget.naturalHeight,
            })
          }
          style={
            dentro
              ? {
                  width: `${dentro.ancho * 100}%`,
                  height: `${dentro.alto * 100}%`,
                  left: `${(0.5 + encuadre.x) * 100}%`,
                  top: `${(0.5 + encuadre.y) * 100}%`,
                }
              : { visibility: "hidden" }
          }
          className="absolute max-w-none -translate-x-1/2 -translate-y-1/2 select-none"
        />

        {/*
          Los tercios, como en la cámara del teléfono. No son decoración: sin
          una referencia dentro del marco no se sabe si la cara quedó centrada,
          y con el fondo oscuro alrededor el ojo se engaña.
        */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute inset-y-0 left-1/3 w-px bg-crema/20" />
          <div className="absolute inset-y-0 left-2/3 w-px bg-crema/20" />
          <div className="absolute inset-x-0 top-1/3 h-px bg-crema/20" />
          <div className="absolute inset-x-0 top-2/3 h-px bg-crema/20" />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="text-crema/70">
          −
        </span>

        <input
          type="range"
          min={1}
          max={ACERCAMIENTO_MAXIMO}
          step={0.01}
          value={encuadre.escala}
          onChange={alDeslizar}
          disabled={!medidas}
          aria-label="Acercar la foto"
          className="min-h-11 flex-1 accent-mango"
        />

        <span aria-hidden="true" className="text-crema/70">
          +
        </span>

        <button
          type="button"
          onClick={() => setEncuadre(ENCUADRE_CENTRADO)}
          className="min-h-11 shrink-0 rounded-full px-3 text-sm font-bold text-crema/80 underline"
        >
          Centrar
        </button>
      </div>

      <p className="text-sm text-crema/70">
        Arrástrala para moverla y pellízcala para acercarla. Lo que quede dentro
        del marco es justo lo que se va a ver.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={alCerrar}
          className="min-h-14 rounded-full border-2 border-crema/30 px-6 font-display text-lg font-semibold text-crema"
        >
          Dejarla así
        </button>

        <button
          type="button"
          onClick={seguir}
          disabled={trabajando}
          className="min-h-14 rounded-full bg-mango px-6 font-display text-lg font-semibold text-ink disabled:opacity-60"
        >
          {trabajando ? "Un momento…" : ultima ? "Listo" : "Siguiente"}
        </button>
      </div>
    </div>
  );
}

/**
 * Una foto elegida: la que viaja, la que se eligió y con qué pintarla.
 *
 * El original se guarda al lado del recorte porque volver a acomodar parte
 * siempre de él: recortar un recorte no deja alejarse otra vez —el material que
 * quedó fuera ya no está en el archivo— y vuelve a codificar lo ya codificado,
 * que es perder calidad dos veces por cambiar de opinión.
 */
type Puesta = {
  archivo: File;
  original: File;
  url: string;
  esVideo: boolean;
};

/**
 * Lo que hay que hacer alrededor del encuadre, en un solo sitio.
 *
 * Los campos de foto de la plataforma —publicar en la comunidad, editar lo
 * publicado, los del panel del negocio— repiten exactamente la misma
 * coreografía: guardar lo elegido, abrir la cola, recibir los recortes,
 * devolverlos al `<input>` y mantener vivas las miniaturas sin fugar memoria.
 * Escrita en cada sitio, esa coreografía se separa a la primera corrección.
 *
 * Lo que cambia entre ellos —qué se valida antes de aceptar los archivos, cómo
 * se pintan las miniaturas, si el formulario se envía solo— se queda fuera, en
 * cada uno.
 *
 * **Las direcciones de las miniaturas se crean y se tiran en los manejadores de
 * evento**, nunca al pintar. Un `createObjectURL` reserva memoria hasta que se
 * revoca; atado al render, el doble montaje de StrictMode revoca lo que se
 * acaba de crear y las miniaturas salen rotas. Elegir un archivo es un evento y
 * acomodarlo también: ahí es donde una dirección nace y donde muere.
 */
export function useAcomodo(
  proporcion: number,
  /** Se avisa con la lista final cada vez que se cierra el encuadre. */
  alQuedarListo?: (finales: File[]) => void,
) {
  const [puestas, setPuestas] = useState<Puesta[]>([]);

  /** Qué posiciones están en el encuadre. `null` es que está cerrado. */
  const [acomodando, setAcomodando] = useState<number[] | null>(null);

  /*
    El campo se guarda en estado y no en una referencia, aunque una referencia
    sea lo natural para apuntar a un nodo del DOM. Lo que devuelve este gancho se
    lee durante el render —las miniaturas, el encuadre montado—, y el lint de
    React no deja mirar nada que venga de una referencia mientras se pinta: con
    una dentro, todo lo demás queda contagiado. En estado, el nodo es un valor
    más.

    La función que lo recoge tiene que ser estable o React la llamaría con null y
    con el nodo en cada pintada, y cada llamada pediría otra.
  */
  const [campo, setCampo] = useState<HTMLInputElement | null>(null);
  const recogerCampo = useCallback((nodo: HTMLInputElement | null) => {
    setCampo(nodo);
  }, []);

  /**
   * Devolver las fotos al campo cuando React vacía el formulario.
   *
   * React 19 reinicia un formulario no controlado al terminar su acción, y un
   * campo de archivo no se puede rellenar escribiéndole el valor. Así que un
   * envío fallido —el texto demasiado corto, la red que se cae— dejaba el campo
   * sin nada mientras las miniaturas seguían en pantalla: se veían cuatro fotos
   * y no viajaba ninguna, y el segundo intento contestaba «ponle al menos una
   * foto» señalando a las cuatro que se estaban viendo.
   *
   * Se puede arreglar aquí porque los `File` siguen en el estado de este
   * gancho. Antes no había de dónde sacarlos: el propio `catalogo` lo da por
   * perdido y se limita a avisar de que la foto no se guardó.
   *
   * El `setTimeout` no es un adorno: el navegador vacía el campo **después** de
   * despachar el evento, así que ponerlas dentro del oyente sería ponerlas para
   * que las borre a continuación.
   */
  useEffect(() => {
    const formulario = campo?.form;
    if (!formulario || puestas.length === 0) return;

    const alVaciar = () => {
      const archivos = puestas.map((puesta) => puesta.archivo);
      setTimeout(() => ponerEnCampo(campo, archivos), 0);
    };

    formulario.addEventListener("reset", alVaciar);
    return () => formulario.removeEventListener("reset", alVaciar);
  }, [campo, puestas]);

  const poner = (archivo: File, original: File): Puesta => ({
    archivo,
    original,
    url: URL.createObjectURL(archivo),
    esVideo: archivo.type.startsWith("video/"),
  });

  const tirar = (lista: Puesta[]) =>
    lista.forEach((puesta) => URL.revokeObjectURL(puesta.url));

  /**
   * Toma lo elegido y abre la cola. Devuelve si hay algo que acomodar: un video
   * no se recorta, y quien envía solo no debe quedarse esperando un encuadre
   * que no va a abrirse.
   */
  function empezar(elegidos: File[]) {
    tirar(puestas);
    setPuestas(elegidos.map((archivo) => poner(archivo, archivo)));

    const fotos = elegidos.flatMap((archivo, i) =>
      sePuedeEncuadrar(archivo) ? [i] : [],
    );

    setAcomodando(fotos.length > 0 ? fotos : null);

    return fotos.length > 0;
  }

  /** Se vació el campo, o lo elegido se rechazó antes de llegar al encuadre. */
  function limpiar() {
    tirar(puestas);
    setPuestas([]);
    setAcomodando(null);
  }

  /**
   * Vuelven las acomodadas: cada una a su sitio y de vuelta al campo.
   *
   * Pueden venir menos de las que se mandaron —cerrar a media cola es
   * legítimo—, así que se emparejan por posición y lo que no volvió se queda
   * como estaba.
   */
  function alTerminar(recortadas: File[]) {
    const posiciones = acomodando ?? [];

    const finales = puestas.map((puesta, i) => {
      const turno = posiciones.indexOf(i);

      if (turno === -1 || !recortadas[turno]) return puesta;

      URL.revokeObjectURL(puesta.url);
      return poner(recortadas[turno], puesta.original);
    });

    setPuestas(finales);
    setAcomodando(null);
    asentar(finales);
  }

  /**
   * Deja la lista en el campo de archivo, que es lo que de verdad viaja.
   *
   * **Vaciarlo se hace con `value = ""` y no con una lista vacía.** Una
   * `FileList` de cero elementos deja el campo con un archivo elegido a ojos
   * del navegador —el nombre sigue escrito al lado del botón— y `required`
   * no vuelve a saltar. Quitando la última foto, el formulario se podía
   * enviar sin ninguna y el reproche llegaba del servidor.
   */
  function asentar(lista: Puesta[]) {
    const archivos = lista.map((puesta) => puesta.archivo);

    if (campo) {
      if (archivos.length === 0) campo.value = "";
      else ponerEnCampo(campo, archivos);
    }

    alQuedarListo?.(archivos);
  }

  /**
   * Quitar una, sin tocar las demás.
   *
   * Hasta ahora no se podía: un campo de archivo se elige entero, así que
   * arrepentirse de la tercera foto obligaba a cancelar la publicación y
   * empezar de nuevo. Con `DataTransfer` se puede rehacer la lista sin las que
   * sobran, que es lo que el navegador no da por sí solo.
   */
  function quitar(i: number) {
    const fuera = puestas[i];
    if (!fuera) return;

    const quedan = puestas.filter((_, puesto) => puesto !== i);

    URL.revokeObjectURL(fuera.url);
    setPuestas(quedan);

    /*
      Si la que se va estaba en el encuadre, el encuadre se cierra: seguir
      acomodando una foto que ya no se va a subir no lleva a ninguna parte.
      Con varias en cola se cierra igual, que es lo menos sorprendente.
    */
    if (acomodando?.includes(i)) setAcomodando(null);

    asentar(quedan);
  }

  /**
   * Cambiar el orden: la de la posición `de` pasa a la posición `a`.
   *
   * El orden importa y no es un capricho de coleccionista: **la primera es la
   * portada**, la que sale en el muro y la que aparece cuando alguien comparte
   * el enlace. Antes el orden era el que hubiera decidido el selector de
   * archivos del teléfono, y la única forma de cambiarlo era volver a elegirlas
   * todas en el orden correcto.
   */
  function reordenar(de: number, a: number) {
    if (de === a || !puestas[de] || !puestas[a]) return;

    const movidas = [...puestas];
    const [suya] = movidas.splice(de, 1);
    movidas.splice(a, 0, suya);

    setPuestas(movidas);
    asentar(movidas);
  }

  return {
    /** Va en el `<input type="file">`: es por donde se le devuelven los recortes. */
    campo: recogerCampo,
    /** Lo que va a viajar, ya acomodado. */
    archivos: puestas.map((puesta) => puesta.archivo),
    /** Lo mismo, con qué pintarlo y si es un video. */
    previos: puestas,
    empezar,
    limpiar,
    quitar,
    reordenar,
    /** Volver a acomodar una sola, sin repasar la cola entera. */
    acomodarUna: (i: number) => setAcomodando([i]),
    /** Pide el envío del formulario donde vive el campo. */
    pedirEnvio: () => campo?.form?.requestSubmit(),
    /** El encuadre, ya montado. `null` cuando no hay nada que acomodar. */
    encuadre:
      acomodando && acomodando.length > 0 ? (
        <AjustarFotos
          archivos={acomodando.map((i) => puestas[i].original)}
          proporcion={proporcion}
          alTerminar={alTerminar}
        />
      ) : null,
  };
}
