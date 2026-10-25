"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconoBrujula,
  IconoCalendario,
  IconoCasa,
  IconoMazorca,
  IconoPersonas,
  IconoPersona,
} from "@/components/iconos";
import { FUNCIONES, HAY_ECONOMIA_DE_MAZORCAS } from "@/lib/funciones";
import { MONEDA } from "@/lib/vocabulario";

/**
 * La navegación del celular, al alcance del pulgar.
 *
 * Dos decisiones que no son estéticas:
 *
 * 1. **Explorar va al centro y levantado.** El directorio es la razón de ser
 *    del sitio; si queda como una pestaña más, se pierde entre las otras.
 * 2. **La cuenta enseña el número.** Ver las mazorcas subir es el enganche
 *    del programa, así que el marcador viaja con la persona por todo el sitio
 *    en vez de vivir escondido en /cuenta.
 */

type Pestana = {
  href: string;
  texto: string;
  Icono: (props: { className?: string }) => React.ReactElement;
  /** Rutas que también cuentan como "estoy aquí". */
  tambien?: string[];
};

const IZQUIERDA: Pestana[] = [
  { href: "/", texto: "Inicio", Icono: IconoCasa },
  { href: "/eventos", texto: "Eventos", Icono: IconoCalendario },
];

const DERECHA: Pestana[] = FUNCIONES.comunidad
  ? [
      // Comunidad se quedo con el lugar que tenia Noticias, y con las noticias
      // dentro: eran tres pestanias que casi nadie abria por separado.
      {
        href: "/comunidad",
        texto: "Comunidad",
        Icono: IconoPersonas,
        tambien: ["/noticias"],
      },
    ]
  : [];

const EXPLORAR: Pestana = {
  href: "/directorio",
  texto: "Explorar",
  Icono: IconoBrujula,
  // El micrositio se llega desde el directorio, así que sigue siendo explorar.
  tambien: ["/marca"],
};

/**
 * Las columnas se cuentan, no se escriben a mano: al apagar una función la
 * barra se queda con un hueco si el número no la sigue. Van como literales
 * porque Tailwind lee las clases del código, no las arma en tiempo de
 * ejecución.
 */
const COLUMNAS =
  { 4: "grid-cols-4", 5: "grid-cols-5", 6: "grid-cols-6" }[
    IZQUIERDA.length + DERECHA.length + 2
  ] ?? "grid-cols-5";

function estaEn(ruta: string, pestana: Pestana) {
  if (pestana.href === "/") return ruta === "/";
  const rutas = [pestana.href, ...(pestana.tambien ?? [])];
  return rutas.some((base) => ruta === base || ruta.startsWith(`${base}/`));
}

export function BarraInferior({
  monedas,
  destinoPerfil,
  etiquetaPerfil,
  iconoPerfil,
}: {
  /** Mazorcas del cliente que navega, o null si no hay sesión de cliente. */
  monedas: number | null;
  destinoPerfil: string;
  /**
   * "Mi cuenta" para un visitante, "Perfil" para un negocio o un
   * administrador, y "Entrar" para quien todavía no ha entrado.
   */
  etiquetaPerfil: string;
  iconoPerfil: "mazorca" | "persona";
}) {
  const ruta = usePathname();

  // Sin nada que se pague con mazorcas, el marcador no marca nada: la pestaña
  // vuelve a ser un icono.
  const marcador = HAY_ECONOMIA_DE_MAZORCAS ? monedas : null;

  const pestana = (item: Pestana) => {
    const activa = estaEn(ruta, item);

    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={activa ? "page" : undefined}
        className={`flex min-h-14 flex-col items-center justify-center gap-1 text-[0.68rem] font-bold transition-colors ${
          activa ? "text-mango" : "text-crema/60"
        }`}
      >
        <item.Icono className="size-6" />
        {item.texto}
      </Link>
    );
  };

  const enPerfil = ruta === destinoPerfil || ruta.startsWith(`${destinoPerfil}/`);

  return (
    <nav
      aria-label="Navegación principal"
      className="barra-cristal fixed inset-x-0 bottom-0 z-40 border-t border-mango/20 pb-[env(safe-area-inset-bottom)] sm:hidden"
    >
      <div className={`mx-auto grid max-w-md ${COLUMNAS} items-end`}>
        {IZQUIERDA.map(pestana)}

        <Link
          href={EXPLORAR.href}
          aria-current={estaEn(ruta, EXPLORAR) ? "page" : undefined}
          className="flex flex-col items-center gap-1 pb-2 text-[0.68rem] font-bold text-crema"
        >
          <span
            className={`-mt-6 grid size-14 place-items-center rounded-full border-4 border-[#1c1236] shadow-[0_0_20px_rgb(255_183_3/0.45)] transition-transform active:scale-95 ${
              estaEn(ruta, EXPLORAR) ? "boton-oro text-ink" : "bg-selva text-crema"
            }`}
          >
            <EXPLORAR.Icono className="size-7" />
          </span>
          {EXPLORAR.texto}
        </Link>

        {DERECHA.map(pestana)}

        <Link
          href={destinoPerfil}
          aria-current={enPerfil ? "page" : undefined}
          className={`flex min-h-14 flex-col items-center justify-center gap-1 text-[0.68rem] font-bold transition-colors ${
            enPerfil ? "text-mango" : "text-crema/60"
          }`}
        >
          {marcador === null ? (
            iconoPerfil === "persona" ? (
              <IconoPersona className="size-6" />
            ) : (
              <IconoMazorca className="size-6" />
            )
          ) : (
            <span
              className="grid size-6 place-items-center rounded-full bg-mango font-mono text-[0.7rem] font-bold text-ink"
              aria-label={`${marcador} ${MONEDA.variasCortas}`}
            >
              {marcador > 99 ? "99+" : marcador}
            </span>
          )}
          {etiquetaPerfil}
        </Link>
      </div>
    </nav>
  );
}
