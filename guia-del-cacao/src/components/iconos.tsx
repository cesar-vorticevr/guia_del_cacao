/**
 * Los íconos de la navegación, dibujados a mano en SVG.
 *
 * Sin librería de íconos a propósito: son cinco, se usan en un solo lugar y
 * cualquier paquete pesa más que esto. Todos comparten caja de 24, trazo de 2
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
