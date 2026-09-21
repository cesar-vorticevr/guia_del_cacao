"use client";

import { useState, useSyncExternalStore } from "react";

/**
 * Si este aparato sabe abrir la hoja de compartir del sistema.
 *
 * Con `useSyncExternalStore` y no con un efecto que llame a `setState`: React
 * pinta primero lo del servidor —el tercer argumento, siempre `false`— y en la
 * misma pasada de hidratación cambia a lo del navegador, sin el render de más
 * que provoca el efecto.
 *
 * No hay nada a lo que suscribirse: la respuesta no cambia mientras la página
 * está abierta, así que la función de suscripción devuelve una baja vacía.
 *
 * El nombre empieza en inglés y no es un descuido: React exige que todo gancho
 * se llame `use…` para poder comprobar las reglas de los ganchos, y `usa…` no
 * le vale. Es lo único del proyecto que no se puede nombrar en español.
 */
const SIN_CAMBIOS = () => () => {};

function useHojaDelSistema() {
  return useSyncExternalStore(
    SIN_CAMBIOS,
    () => typeof navigator !== "undefined" && "share" in navigator,
    () => false,
  );
}

/**
 * Compartir esto, donde sea.
 *
 * Son **dos botones distintos según el aparato**, y cuál sale lo decide
 * `useHojaDelSistema`, aquí arriba: `navigator.share` no existe en el servidor,
 * y preguntarlo a secas durante el render deja el HTML del servidor y el del
 * navegador diciendo cosas distintas, que es lo que React reclama al hidratar.
 *
 * En celular sale **uno solo**, que abre la hoja del sistema: ahí están
 * WhatsApp, Facebook, Instagram y lo que la persona tenga instalado, en su
 * orden y con sus cuentas ya iniciadas. Ninguna lista que yo escriba le va a
 * ganar a esa.
 *
 * En escritorio esa hoja casi no existe, así que salen los tres sitios donde de
 * verdad se comparte esto —WhatsApp, Facebook, X— y copiar el enlace, que es lo
 * que se acaba haciendo para pegarlo en un correo o en un grupo.
 *
 * La foto y el texto de la tarjeta no se mandan aquí: los lee la red del propio
 * enlace, de las etiquetas Open Graph de la página (`lib/compartir`). Por eso
 * basta con pasar la dirección.
 */
export function BotonCompartir({
  url,
  titulo,
  /** Lo que se dibuja dentro del botón en celular. */
  texto = "Compartir",
  compacto = false,
}: {
  /** Absoluta: una relativa no sirve fuera del sitio. */
  url: string;
  titulo: string;
  texto?: string;
  /**
   * Un solo icono, para la barra de acciones del muro.
   *
   * Ahí no caben cuatro botones: la barra lleva además el corazón, los
   * comentarios y el marcador, y en un teléfono se saldrían de la tarjeta. En
   * celular abre la hoja del sistema igual que siempre; en escritorio copia el
   * enlace, que es lo que se acaba haciendo. La fila con Facebook y WhatsApp
   * sigue en la página de la publicación, donde sí hay sitio.
   */
  compacto?: boolean;
}) {
  const nativo = useHojaDelSistema();
  const [aviso, setAviso] = useState<"nada" | "copiado" | "fallo">("nada");

  /**
   * El portapapeles puede negarse —sin permiso, o con la ventana sin foco— y
   * entonces hay que decirlo. La primera versión se lo tragaba en silencio para
   * no pintar un error rojo por algo tan menor, y el resultado era peor: se
   * pulsaba el botón y no pasaba **nada**, que se lee como roto.
   *
   * Así que el mismo botón contesta las dos cosas, y cuando no pudo deja el
   * enlace a la vista para copiarlo a mano.
   */
  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      setAviso("copiado");
    } catch {
      setAviso("fallo");
    }

    setTimeout(() => setAviso("nada"), 4000);
  }

  /** Abre la hoja del sistema. Solo se llama cuando existe. */
  async function abrirHoja(evento: React.MouseEvent) {
    // Suele vivir dentro de una tarjeta que es un enlace: sin esto, compartir
    // navegaría.
    evento.preventDefault();
    evento.stopPropagation();

    try {
      await navigator.share({ title: titulo, url });
    } catch {
      // Cerrar la hoja sin elegir nada lanza `AbortError`. No es un fallo: es
      // alguien que se arrepintió.
    }
  }

  if (compacto) {
    return (
      <span className="relative">
        <button
          type="button"
          onClick={(evento) => {
            if (nativo) return void abrirHoja(evento);

            evento.preventDefault();
            evento.stopPropagation();
            void copiar();
          }}
          aria-label={nativo ? "Compartir" : "Copiar el enlace para compartir"}
          className="inline-flex min-h-9 items-center rounded-full border-2 border-ink/10 bg-white px-3 text-cacao/60 transition-transform hover:text-selva active:scale-95"
        >
          <IconoCompartir />
        </button>

        {/* El aviso solo aparece al copiar: la hoja del sistema ya se ve sola. */}
        {aviso !== "nada" && (
          <span
            role="status"
            className="absolute top-full right-0 z-20 mt-1 w-44 rounded-xl border-2 border-ink/10 bg-white px-3 py-2 text-xs font-bold text-cacao shadow-dura-sm"
          >
            {aviso === "copiado"
              ? "Enlace copiado"
              : "No se pudo copiar. Ábrela para compartirla."}
          </span>
        )}
      </span>
    );
  }

  if (nativo) {
    return (
      <button
        type="button"
        onClick={abrirHoja}
        className="flex min-h-11 items-center gap-2 rounded-full border-2 border-selva/25 bg-white px-4 text-sm font-bold text-selva-2 shadow-dura-sm transition-transform active:translate-y-0.5"
      >
        <IconoCompartir />
        {texto}
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Enlace
        href={`https://wa.me/?text=${encodeURIComponent(`${titulo} ${url}`)}`}
        texto="WhatsApp"
      />
      {/*
        El `sharer` de Facebook solo recibe la dirección: el título y la foto
        los saca él de las etiquetas de la página. Mandárselos por parámetro
        dejó de funcionar hace años y se ignoran.
      */}
      <Enlace
        href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}
        texto="Facebook"
      />
      <Enlace
        href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(titulo)}&url=${encodeURIComponent(url)}`}
        texto="X"
      />

      <button
        type="button"
        onClick={copiar}
        className="flex min-h-11 items-center gap-2 rounded-full border-2 border-selva/25 bg-white px-4 text-sm font-bold text-selva-2 shadow-dura-sm transition-transform active:translate-y-0.5"
      >
        <IconoCompartir />
        {aviso === "copiado"
          ? "¡Copiado!"
          : aviso === "fallo"
            ? "Cópialo de aquí abajo"
            : "Copiar enlace"}
      </button>

      {/*
        Lo que cambia se anuncia aparte: un lector de pantalla no lee el texto
        de un botón porque cambie solo.
      */}
      <span role="status" className="sr-only">
        {aviso === "copiado"
          ? "Enlace copiado"
          : aviso === "fallo"
            ? "No se pudo copiar. El enlace está escrito debajo."
            : ""}
      </span>

      {/*
        El último recurso, solo si el portapapeles se negó: el enlace escrito,
        en un campo de solo lectura que se selecciona entero al tocarlo. Es feo
        y por eso no está siempre — pero deja a alguien copiarlo a mano en vez
        de mandarlo a buscarlo en la barra de direcciones.
      */}
      {aviso === "fallo" && (
        <input
          readOnly
          value={url}
          onFocus={(evento) => evento.currentTarget.select()}
          aria-label="Enlace para copiar"
          className="min-h-11 w-full rounded-2xl border-2 border-selva/25 bg-white px-4 font-mono text-xs text-cacao"
        />
      )}
    </div>
  );
}

function Enlace({ href, texto }: { href: string; texto: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex min-h-11 items-center rounded-full border-2 border-selva/25 bg-white px-4 text-sm font-bold text-selva-2 shadow-dura-sm transition-transform active:translate-y-0.5"
    >
      {texto}
    </a>
  );
}

/** Decorativo: el texto de al lado ya dice qué hace el botón. */
function IconoCompartir() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3v13" />
      <path d="m7 8 5-5 5 5" />
      <path d="M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />
    </svg>
  );
}
