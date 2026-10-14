import Link from "next/link";
import type { Metadata } from "next";
import { resumen } from "@/lib/datos/admin";

export const metadata: Metadata = { title: "Administración · Guía del Cacao" };

/**
 * La portada del panel: los números de un vistazo y lo que pide atención.
 *
 * Fue la cola de aprobación («Micrositios en revisión»). Desde la migración
 * 000012 nadie revisa antes de publicar —un negocio con micrositio completo y
 * plan sale directo—, así que esa cola estaba siempre vacía y se quitó. Lo que
 * sí llega solo y pide una mirada son las reseñas reportadas.
 */
export default async function Admin() {
  const numeros = await resumen();

  const tarjetas = [
    { texto: "Publicados", valor: numeros.publicadas, href: "/admin/micrositios" },
    { texto: "Pausados", valor: numeros.pausadas, href: "/admin/micrositios" },
    { texto: "Marcas", valor: numeros.marcas, href: "/admin/micrositios" },
    { texto: "Personas", valor: numeros.perfiles, href: "/admin/usuarios" },
  ];

  return (
    <>
      <h1 className="font-display text-3xl">Administración</h1>

      <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tarjetas.map((tarjeta) => (
          <li key={tarjeta.texto}>
            <Link
              href={tarjeta.href}
              className="block rounded-2xl bg-crema-2 p-4 transition-transform hover:-translate-y-0.5"
            >
              <p className="font-mono text-3xl font-bold text-selva">{tarjeta.valor}</p>
              <p className="mt-1 text-sm text-cacao">{tarjeta.texto}</p>
            </Link>
          </li>
        ))}
      </ul>

      <h2 className="mt-10 font-display text-2xl">Para atender</h2>

      {numeros.reportadas > 0 ? (
        <Link
          href="/admin/moderacion"
          className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-3xl border-2 border-guayaba/40 bg-guayaba/10 p-6 transition-transform hover:-translate-y-0.5"
        >
          <span className="text-cacao">
            <strong className="block font-display text-xl text-selva-2">
              {numeros.reportadas === 1
                ? "1 reseña reportada"
                : `${numeros.reportadas} reseñas reportadas`}
            </strong>
            Alguien pidió que la revises. Decide si se borra o se queda.
          </span>
          <span className="font-bold text-selva-2">Revisar →</span>
        </Link>
      ) : (
        <p className="mt-4 rounded-3xl bg-crema-2 p-6 text-cacao">
          Nada pendiente: nadie ha reportado ninguna reseña.
        </p>
      )}
    </>
  );
}
