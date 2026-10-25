import Link from "next/link";
import { EncabezadoQueVuelve } from "@/components/publico/encabezado-que-vuelve";
import { Logotipo } from "@/components/marca";

const SECCIONES = [
  { href: "/directorio", texto: "Explorar" },
  { href: "/eventos", texto: "Eventos" },
  { href: "/comunidad", texto: "Comunidad" },
];

/**
 * El encabezado de las pantallas del negocio.
 *
 * Lleva las mismas secciones que el sitio público: entrar a administrar no es
 * salirse de la guía, y antes el menú desaparecía al pasar al panel — desde ahí
 * no había forma de volver al directorio sin escribir la dirección.
 *
 * Y no lleva botón de "Salir": cerrar sesión es una decisión, no algo que deba
 * estar a un dedo de distancia en todas las pantallas. Vive en «Mi cuenta»,
 * junto a lo demás que se hace una vez.
 */
export function BarraSesion({
  nombre,
  cuenta = "/negocio/panel/cuenta",
}: {
  nombre: string;
  /**
   * A dónde lleva el botón con su nombre: la cuenta del negocio, o la del
   * administrador. Apuntaba siempre a la del negocio y el administrador se
   * quedaba sin dónde cerrar sesión.
   */
  cuenta?: string;
}) {
  return (
    <EncabezadoQueVuelve>
      <header className="barra-cristal flex h-16 items-center text-crema">
      <div className="mx-auto flex w-[92vw] max-w-[1180px] items-center justify-between gap-4">
        <Logotipo />

        <nav className="hidden gap-1 sm:flex" aria-label="Secciones">
          {SECCIONES.map((seccion) => (
            <Link
              key={seccion.href}
              href={seccion.href}
              className="rounded-full px-3 py-2 font-bold transition-colors hover:bg-white/10 hover:text-mango"
            >
              {seccion.texto}
            </Link>
          ))}
        </nav>

        <Link
          href={cuenta}
          className="min-h-10 max-w-40 truncate rounded-full border-2 border-mango/40 px-4 py-2 text-sm font-bold transition-colors hover:border-mango hover:text-mango"
        >
          {nombre}
        </Link>
      </div>
      </header>
    </EncabezadoQueVuelve>
  );
}
