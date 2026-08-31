/**
 * Los íconos de la navegación, dibujados a mano en SVG.
 *
 * Sin librería de íconos a propósito: son unos pocos, se usan en un solo lugar
 * y cualquier paquete pesa más que esto. Todos comparten caja de 24, trazo de 2
 * y puntas redondas, que es lo que los hace ver de la misma familia.
 *
 * Van sin `aria`: quien los usa pone el texto al lado, así que aquí solo
 * estorbarían al lector de pantalla.
 */

type Props = { className?: string };

const BASE = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

export function IconoCasa({ className = "size-6" }: Props) {
  return (
    <svg {...BASE} className={className}>
      <path d="M3.5 10.5 12 3.5l8.5 7" />
      <path d="M5.5 9.5v10h13v-10" />
      <path d="M9.5 19.5v-5h5v5" />
    </svg>
  );
}

export function IconoCalendario({ className = "size-6" }: Props) {
  return (
    <svg {...BASE} className={className}>
      <rect x="3.5" y="5.5" width="17" height="15" rx="3" />
      <path d="M3.5 10.5h17M8 3.5v4M16 3.5v4" />
      <circle cx="8.5" cy="14.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Brújula: explorar es salir a buscar, no rebuscar en una lista. */
export function IconoBrujula({ className = "size-6" }: Props) {
  return (
    <svg {...BASE} className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m15.2 8.8-1.7 4.7-4.7 1.7 1.7-4.7z" />
    </svg>
  );
}

export function IconoPeriodico({ className = "size-6" }: Props) {
  return (
    <svg {...BASE} className={className}>
      <path d="M6.5 4.5h13v15h-13z" />
      <path d="M6.5 8.5h-2v9a2 2 0 0 0 2 2" />
      <path d="M9.5 8.5h7M9.5 12h7M9.5 15.5h4" />
    </svg>
  );
}

/** La moneda de chocolate del pasaporte. */
export function IconoMoneda({ className = "size-6" }: Props) {
  return (
    <svg {...BASE} className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
    </svg>
  );
}

/** Para el perfil de quien no junta monedas: un negocio, un administrador. */
export function IconoPersona({ className = "size-6" }: Props) {
  return (
    <svg {...BASE} className={className}>
      <circle cx="12" cy="8" r="3.8" />
      <path d="M4.5 20c0-3.6 3.4-6 7.5-6s7.5 2.4 7.5 6" />
    </svg>
  );
}

/** Dos siluetas: la comunidad, que no es una persona sino varias. */
export function IconoPersonas({ className = "size-6" }: Props) {
  return (
    <svg {...BASE} className={className}>
      <circle cx="9" cy="8.5" r="3.2" />
      <path d="M3 19.5c0-3.2 2.7-5.3 6-5.3s6 2.1 6 5.3" />
      <path d="M16 6.2a3.2 3.2 0 0 1 0 6" />
      <path d="M17.5 14.6c2.1.6 3.5 2.2 3.5 4.4" />
    </svg>
  );
}

/** Lupa: la del buscador de la portada. */
export function IconoLupa({ className = "size-6" }: Props) {
  return (
    <svg {...BASE} className={className}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 4.5 4.5" />
    </svg>
  );
}

/*
  Los de las redes van rellenos y sin trazo: son logos ajenos y se reconocen por
  su silueta, no por el estilo de la casa. Comparten la misma caja de 24 para
  que se alineen con los demás.
*/
const MARCA = {
  viewBox: "0 0 24 24",
  fill: "currentColor",
  "aria-hidden": true,
} as const;

export function IconoFacebook({ className = "size-6" }: Props) {
  return (
    <svg {...MARCA} className={className}>
      <path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.2c-1.2 0-1.6.8-1.6 1.6V12h2.7l-.4 2.9h-2.3v7A10 10 0 0 0 22 12Z" />
    </svg>
  );
}

export function IconoInstagram({ className = "size-6" }: Props) {
  return (
    <svg {...MARCA} className={className}>
      <path d="M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 1.8.3 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1 .4 2.2.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c-.1 1.2-.3 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .4-2.2.4-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2-.1-1.8-.3-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.4-1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.9c.1-1.2.3-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.4 2.2-.4 1.3-.1 1.7-.1 4.9-.1Zm0 1.8c-3.1 0-3.5 0-4.7.1-1.1.1-1.7.2-2.1.4-.5.2-.9.4-1.2.8-.4.3-.6.7-.8 1.2-.2.4-.3 1-.4 2.1-.1 1.2-.1 1.6-.1 4.7s0 3.5.1 4.7c.1 1.1.2 1.7.4 2.1.2.5.4.9.8 1.2.3.4.7.6 1.2.8.4.2 1 .3 2.1.4 1.2.1 1.6.1 4.7.1s3.5 0 4.7-.1c1.1-.1 1.7-.2 2.1-.4.5-.2.9-.4 1.2-.8.4-.3.6-.7.8-1.2.2-.4.3-1 .4-2.1.1-1.2.1-1.6.1-4.7s0-3.5-.1-4.7c-.1-1.1-.2-1.7-.4-2.1-.2-.5-.4-.9-.8-1.2-.3-.4-.7-.6-1.2-.8-.4-.2-1-.3-2.1-.4-1.2-.1-1.6-.1-4.7-.1Zm0 3.1a4.9 4.9 0 1 1 0 9.8 4.9 4.9 0 0 1 0-9.8Zm0 8.1a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Zm6.2-8.3a1.1 1.1 0 1 1-2.3 0 1.1 1.1 0 0 1 2.3 0Z" />
    </svg>
  );
}

export function IconoTikTok({ className = "size-6" }: Props) {
  return (
    <svg {...MARCA} className={className}>
      <path d="M16.6 2h-3v13.1a2.7 2.7 0 1 1-2.3-2.7V9.3a5.8 5.8 0 1 0 5.3 5.8V8.6a6.9 6.9 0 0 0 3.9 1.2V6.7a3.9 3.9 0 0 1-3.9-3.9V2Z" />
    </svg>
  );
}

export function IconoWhatsApp({ className = "size-6" }: Props) {
  return (
    <svg {...MARCA} className={className}>
      <path d="M12 2a9.9 9.9 0 0 0-8.5 15L2 22l5.2-1.4A9.9 9.9 0 1 0 12 2Zm0 1.8a8.1 8.1 0 1 1-4.1 15.1l-.3-.2-3 .8.8-3-.2-.3A8.1 8.1 0 0 1 12 3.8Zm-3.1 4c-.2 0-.4 0-.6.3-.2.2-.8.8-.8 1.9s.8 2.2.9 2.4c.1.1 1.6 2.5 3.9 3.4 1.9.8 2.3.6 2.7.6.4 0 1.3-.5 1.5-1.1.2-.5.2-1 .1-1.1 0-.1-.2-.2-.4-.3l-1.5-.7c-.2-.1-.4-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1-.2-.1-.9-.4-1.8-1.2-.7-.6-1.1-1.3-1.2-1.5-.1-.2 0-.4.1-.5l.4-.5c.1-.2.2-.3.2-.5s0-.3-.1-.4l-.7-1.6c-.2-.4-.3-.4-.5-.4h-.5Z" />
    </svg>
  );
}

/** Campana: hay algo nuevo que leer. */
export function IconoCampana({ className = "size-6" }: Props) {
  return (
    <svg {...BASE} className={className}>
      <path d="M6.5 10a5.5 5.5 0 0 1 11 0c0 3.2.8 4.7 1.5 5.5H5c.7-.8 1.5-2.3 1.5-5.5Z" />
      <path d="M10 18.5a2 2 0 0 0 4 0" />
    </svg>
  );
}

/** Ojo abierto: la contraseña se está viendo. */
export function IconoOjo({ className = "size-6" }: Props) {
  return (
    <svg {...BASE} className={className}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

/** Ojo tachado: la contraseña está oculta. */
export function IconoOjoTachado({ className = "size-6" }: Props) {
  return (
    <svg {...BASE} className={className}>
      <path d="M6.5 7.2C4.2 8.8 2.5 12 2.5 12s3.5 6.5 9.5 6.5c1.6 0 3-.4 4.2-1" />
      <path d="M9.9 5.8A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3 3.7" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <path d="m4 4 16 16" />
    </svg>
  );
}
