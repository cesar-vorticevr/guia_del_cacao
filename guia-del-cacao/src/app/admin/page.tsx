import Link from "next/link";
import type { Metadata } from "next";
import { resumen } from "@/lib/datos/admin";
import { pesos } from "@/lib/tipos";

export const metadata: Metadata = { title: "Administración · Guía del Cacao" };

/**
 * El tablero del administrador: el dinero arriba, luego cómo va la guía, y al
 * final lo que pide atención.
 *
 * Fue la cola de aprobación («Micrositios en revisión»). Desde la migración
 * 000012 nadie revisa antes de publicar, así que esa cola estaba siempre vacía
 * y se quitó. Lo que sí llega solo y pide una mirada son las reseñas
 * reportadas y, desde la 000059, las solicitudes de embajador y lo que se les
 * debe.
 */
export default async function Admin() {
  const numeros = await resumen();

  const dinero = [
    {
      texto: "Ingreso mensual",
      valor: pesos(numeros.ingresoMensual),
      nota: `${numeros.pagando} ${numeros.pagando === 1 ? "micrositio pagando" : "micrositios pagando"}`,
      href: "/admin/micrositios",
    },
    {
      texto: "En prueba",
      valor: String(numeros.enPrueba),
      nota: "Pueden pasar a pagar",
      href: "/admin/micrositios",
    },
    {
      texto: "Sin pagar",
      valor: String(numeros.sinPagar),
      nota: "Ocultos hasta que paguen",
      href: "/admin/micrositios",
    },
    {
      texto: "Por pagar a embajadores",
      valor: pesos(numeros.porPagarAEmbajadores),
      nota: "Comisiones de este corte",
      href: "/admin/embajadores",
    },
  ];

  const guia = [
    { texto: "Publicados", valor: numeros.publicadas, href: "/admin/micrositios" },
    { texto: "Pausados", valor: numeros.pausadas, href: "/admin/micrositios" },
    { texto: "Marcas", valor: numeros.marcas, href: "/admin/micrositios" },
    { texto: "Personas", valor: numeros.perfiles, href: "/admin/usuarios" },
  ];

  const pendientes = [
    numeros.reportadas > 0 && {
      href: "/admin/moderacion",
      titulo:
        numeros.reportadas === 1 ? "1 reseña reportada" : `${numeros.reportadas} reseñas reportadas`,
      texto: "Alguien pidió que la revises. Decide si se borra o se queda.",
    },
    numeros.solicitudesDeEmbajador > 0 && {
      href: "/admin/embajadores",
      titulo:
        numeros.solicitudesDeEmbajador === 1
          ? "1 persona quiere ser embajadora"
          : `${numeros.solicitudesDeEmbajador} personas quieren ser embajadoras`,
      texto: "Apruébala para que reciba su código.",
    },
    numeros.porPagarAEmbajadores > 0 && {
      href: "/admin/embajadores",
      titulo: `Transferir ${pesos(numeros.porPagarAEmbajadores)} a embajadores`,
      texto: "Sus comisiones ya están confirmadas por Stripe.",
    },
  ].filter(Boolean) as { href: string; titulo: string; texto: string }[];

  return (
    <div className="grid gap-10">
      <header>
        <p className="antetitulo">Administración</p>
        <h1 className="mt-2 font-display text-4xl font-medium tracking-tight">
          Cómo va la <em className="texto-oro">guía</em>
        </h1>
      </header>

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {dinero.map((dato, i) => (
          <li key={dato.texto}>
            <Link
              href={dato.href}
              className="tarjeta-magica flex h-full flex-col rounded-3xl border-2 border-ink/10 bg-white p-5"
            >
              <span className="text-sm font-bold uppercase tracking-wider text-cacao/70">{dato.texto}</span>
              <span
                className={`mt-2 font-display text-4xl font-semibold ${i === 0 || i === 3 ? "text-mango drop-shadow-[0_0_12px_rgba(255,183,3,0.45)]" : ""}`}
              >
                {dato.valor}
              </span>
              <span className="mt-1 text-sm text-cacao/70">{dato.nota}</span>
            </Link>
          </li>
        ))}
      </ul>

      <section>
        <h2 className="font-display text-2xl">La guía</h2>
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {guia.map((tarjeta) => (
            <li key={tarjeta.texto}>
              <Link
                href={tarjeta.href}
                className="tarjeta-magica block rounded-2xl border-2 border-ink/10 bg-white p-4"
              >
                <p className="font-display text-3xl font-semibold">{tarjeta.valor}</p>
                <p className="mt-1 text-sm text-cacao">{tarjeta.texto}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-display text-2xl">Para atender</h2>

        {pendientes.length > 0 ? (
          <ul className="mt-4 grid gap-3">
            {pendientes.map((p) => (
              <li key={p.titulo}>
                <Link
                  href={p.href}
                  className="tarjeta-magica flex flex-wrap items-center justify-between gap-3 rounded-3xl border-2 border-mango/40 bg-white p-6"
                >
                  <span className="text-cacao">
                    <strong className="block font-display text-xl text-selva-2">{p.titulo}</strong>
                    {p.texto}
                  </span>
                  <span className="font-bold text-mango">Ir →</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="caja-vacia mt-4 rounded-3xl bg-crema-2 p-6 text-cacao">
            Nada pendiente. Todo en orden.
          </p>
        )}
      </section>
    </div>
  );
}
