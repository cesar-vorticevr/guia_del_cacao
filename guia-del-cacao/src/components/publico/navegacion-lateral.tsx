"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconoBrujula,
  IconoCalendario,
  IconoCasa,
  IconoPersonas,
} from "@/components/iconos";

type Enlace = {
  href: string;
  texto: string;
  Icono: (props: { className?: string }) => React.ReactElement;
  /** Rutas que también cuentan como "estoy aquí". */
  tambien?: string[];
};

/**
 * Las mismas secciones que la barra de abajo, y en el mismo orden.
 *
 * Es a propósito: quien aprende dónde está "Explorar" en el celular no debería
 * tener que volver a buscarlo en la computadora. Cambia el sitio de la
 * navegación, no su contenido.
 */
const ENLACES: Enlace[] = [
  { href: "/", texto: "Inicio", Icono: IconoCasa },
  {
    href: "/directorio",
    texto: "Explorar",
    Icono: IconoBrujula,
    // El micrositio se llega desde el directorio, así que sigue siendo explorar.
    tambien: ["/marca"],
  },
  { href: "/eventos", texto: "Eventos", Icono: IconoCalendario },
  {
    href: "/comunidad",
    texto: "Comunidad",
    Icono: IconoPersonas,
    tambien: ["/noticias"],
  },
];

function estaEn(ruta: string, enlace: Enlace) {
  if (enlace.href === "/") return ruta === "/";
  if (ruta.startsWith(enlace.href)) return true;
  return (enlace.tambien ?? []).some((otra) => ruta.startsWith(otra));
}

/**
 * La navegación de escritorio, en una columna a la izquierda.
 *
 * Se queda quieta mientras el contenido pasa (`sticky`): en una lista larga —el
 * directorio son varias pantallas— tener que subir hasta arriba para cambiar de
 * sección era el precio de tenerla solo en el encabezado.
 *
 * **En celular no existe.** Ahí la navegación es la barra de abajo, al alcance
 * del pulgar, y duplicarla arriba solo quitaría sitio a lo que se vino a leer.
 */
export function NavegacionLateral() {
  const ruta = usePathname();

  return (
    <nav aria-label="Secciones" className="sticky top-24">
      <ul className="grid gap-1">
        {ENLACES.map((enlace) => {
          const aqui = estaEn(ruta, enlace);

          return (
            <li key={enlace.href}>
              <Link
                href={enlace.href}
                aria-current={aqui ? "page" : undefined}
                className={`flex min-h-12 items-center gap-3 rounded-2xl px-4 font-bold transition-colors ${
                  aqui
                    ? "bg-crema-2 text-selva-2"
                    : "text-cacao hover:bg-crema-2/60 hover:text-selva-2"
                }`}
              >
                <enlace.Icono className="size-6 shrink-0" />
                {enlace.texto}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
