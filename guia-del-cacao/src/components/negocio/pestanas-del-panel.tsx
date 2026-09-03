"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Pestanas } from "@/components/negocio/pestanas";

/**
 * Las pestañas del panel, marcando sola la sección donde estás.
 *
 * Viven en el layout para que no desaparezcan al entrar en una sección: antes,
 * tocar Eventos llevaba a una pantalla suelta sin menú y volver era usar el
 * botón de atrás. La sección se deduce de la ruta y no de una prop, porque el
 * layout no sabe qué página está pintando.
 *
 * En las pantallas de detalle —editar una sucursal, un producto o un evento— se
 * queda marcada su sección: sigues dentro de Eventos aunque estés mirando uno
 * en concreto.
 */
export function PestanasDelPanel({
  sucursales,
  catalogo,
  cupones,
  monedasPendientes,
  monedasNuevas,
  empezando,
}: {
  sucursales: number;
  catalogo: number;
  /** Cuántos cupones vigentes tiene en el mercado. */
  cupones: number;
  monedasPendientes: number;
  monedasNuevas: boolean;
  /** Todavía no hay ninguna sucursal: el panel es el recorrido de alta. */
  empezando: boolean;
}) {
  const ruta = usePathname();

  /*
    Empezando no hay pestañas —serían cinco caminos a listas vacías—, pero sí
    hace falta la vuelta: el recorrido manda al catálogo a cargar el primer
    producto, y sin esto se llega y no se sale.
  */
  if (empezando) {
    if (ruta === "/negocio/panel") return null;

    return (
      <Link href="/negocio/panel" className="font-bold text-selva underline">
        ← Volver a los primeros pasos
      </Link>
    );
  }

  /*
    En «Mi cuenta» no se pintan: no es una sección del panel sino lo que hay
    detrás del nombre, y tiene sus propias pestañas dentro. Dos filas, una sin
    nada marcado, solo confundirían sobre dónde está uno.
  */
  if (ruta.startsWith("/negocio/panel/cuenta")) return null;

  /*
    Eventos y Foro ya no son pestañas del panel: lo que se publica se maneja
    donde se lee, en /eventos y en /comunidad, y no en un cuarto aparte que
    obligaba a salir del sitio público para escribir sobre él.
  */
  const actual = ruta.startsWith("/negocio/panel/monedas")
    ? "mazorcas"
    : ruta.startsWith("/negocio/panel/mercado")
      ? "mercado"
      : ruta.startsWith("/negocio/panel/catalogo")
        ? "catalogo"
        : // El resto —editar sucursal, publicar— cae en sucursales, que es de
          // donde se llega a todas ellas.
          "sucursales";

  return (
    <Pestanas
      base="/negocio/panel"
      actual={actual}
      pestanas={[
        {
          clave: "sucursales",
          texto: "Sucursales",
          href: "/negocio/panel",
          cuenta: sucursales,
        },
        {
          clave: "catalogo",
          texto: "Catálogo",
          href: "/negocio/panel/catalogo",
          cuenta: catalogo,
        },
        {
          clave: "mercado",
          texto: "Mercado",
          href: "/negocio/panel/mercado",
          cuenta: cupones,
        },
        {
          clave: "mazorcas",
          texto: "Mazorcas",
          href: "/negocio/panel/monedas",
          cuenta: monedasPendientes || undefined,
          destella: monedasNuevas,
        },
      ]}
    />
  );
}
