import Link from "next/link";
import type { Metadata } from "next";
import { listarCategorias } from "@/lib/datos/categorias";
import {
  PERIODOS,
  esPeriodo,
  tableroDeActividad,
  type Periodo,
} from "@/lib/datos/actividad";

export const metadata: Metadata = { title: "Métricas · Guía del Cacao" };

const NUMERO = new Intl.NumberFormat("es-MX");
const DIA = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

function n(valor: number | undefined) {
  return NUMERO.format(valor ?? 0);
}

const COLUMNAS = [
  "Negocio",
  "Visitas",
  "WhatsApp",
  "Tel.",
  "Correo",
  "Mapa",
  "Redes",
  "Compartir",
  "PDF",
  "Eventos",
  "Reseñas",
  "Estrellas",
  "Favoritos",
];

/**
 * Lo que pasa en la guía: visitas, búsquedas y cada botón de contacto
 * (migración 000052), con reseñas, favoritos y cuentas al lado.
 *
 * El orden es el de las preguntas: ¿viene gente? ¿la gente contacta a los
 * negocios? ¿a cuáles? ¿qué busca? La tabla por negocio es el reporte para la
 * Secretaría y el argumento para que un negocio pase a un plan de pago.
 */
export default async function Metricas({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  const { periodo: pedido } = await searchParams;
  const periodo: Periodo = esPeriodo(pedido) ? pedido : "30";
  const [t, categorias] = await Promise.all([
    tableroDeActividad(periodo),
    listarCategorias(),
  ]);

  const maximo = Math.max(1, ...t.serie.map((d) => d.visitas));

  const grandes = [
    { cifra: t.totales.vista_pagina, texto: "visitas a la guía" },
    { cifra: t.totales.vista_micrositio, texto: "visitas a micrositios" },
    { cifra: t.contactos, texto: "contactos a negocios" },
    { cifra: t.totales.busqueda, texto: "búsquedas" },
  ];

  const botones = [
    { cifra: t.totales.whatsapp, texto: "WhatsApp" },
    { cifra: t.totales.telefono, texto: "Teléfono" },
    { cifra: t.totales.correo, texto: "Correo" },
    { cifra: t.totales.mapa, texto: "Cómo llegar" },
    { cifra: t.totales.red, texto: "Redes sociales" },
    { cifra: t.totales.compartir, texto: "Compartir" },
    { cifra: t.totales.catalogo_pdf, texto: "Catálogo en PDF" },
    { cifra: t.totales.vista_evento, texto: "Visitas a eventos" },
  ];

  const comunidad = [
    { cifra: t.publicados, texto: "negocios publicados (hoy)" },
    { cifra: t.negociosNuevos, texto: "cuentas de negocio nuevas" },
    { cifra: t.clientesNuevos, texto: "cuentas de visitante nuevas" },
    { cifra: t.resenas, texto: "reseñas" },
    { cifra: t.calificaciones, texto: "calificaciones" },
    { cifra: t.favoritos, texto: "favoritos guardados" },
    { cifra: t.eventosNuevos, texto: "eventos publicados" },
    { cifra: t.publicacionesNuevas, texto: "publicaciones en la comunidad" },
    { cifra: t.comentariosNuevos, texto: "comentarios" },
  ];

  const nombreDeFiltro = (detalle: string) => {
    const [clave, valor = ""] = detalle.split(":");
    if (clave === "categoria") {
      const categoria = categorias.find((c) => String(c.id) === valor);
      return `Tipo: ${categoria?.nombre ?? valor}`;
    }
    // La base guarda el detalle en minúsculas.
    return `Estado: ${valor.replace(/(^|\s)\p{L}/gu, (l) => l.toUpperCase())}`;
  };

  const listas = [
    {
      titulo: "Lo más buscado",
      filas: t.busquedas.map((f) => ({ ...f, texto: f.detalle })),
    },
    {
      titulo: "Filtros más usados",
      filas: t.filtros.map((f) => ({ ...f, texto: nombreDeFiltro(f.detalle) })),
    },
    {
      titulo: "Páginas más vistas",
      filas: t.paginas.map((f) => ({ ...f, texto: f.detalle })),
    },
    {
      titulo: "Redes más pulsadas",
      filas: t.redes.map((f) => ({ ...f, texto: f.detalle })),
    },
  ];

  return (
    <>
      <h1 className="font-display text-3xl">Métricas</h1>
      <p className="mt-2 text-cacao">
        Solo conteos: la guía no guarda quién hizo cada cosa. No cuentan las
        visitas de cada negocio a su propia página ni las tuyas.
      </p>

      <nav aria-label="Periodo" className="mt-5 flex flex-wrap gap-2">
        {(Object.keys(PERIODOS) as Periodo[]).map((clave) => (
          <Link
            key={clave}
            href={`/admin/metricas?periodo=${clave}`}
            aria-current={clave === periodo ? "page" : undefined}
            className={`min-h-11 rounded-full border-2 px-4 py-2 font-bold ${
              clave === periodo
                ? "border-selva bg-selva text-crema"
                : "border-selva/20 bg-white text-selva-2"
            }`}
          >
            {PERIODOS[clave].texto}
          </Link>
        ))}
      </nav>

      <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {grandes.map((dato) => (
          <div
            key={dato.texto}
            className="flex flex-col-reverse rounded-3xl bg-selva px-4 py-5 text-crema"
          >
            <dt className="mt-1 text-sm text-crema/85">{dato.texto}</dt>
            <dd className="font-mono text-3xl font-bold">{n(dato.cifra)}</dd>
          </div>
        ))}
      </dl>

      <section className="mt-8">
        <h2 className="font-display text-xl font-semibold text-selva-2">
          Qué botones se pulsan
        </h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {botones.map((dato) => (
            <div
              key={dato.texto}
              className="flex flex-col-reverse rounded-2xl bg-crema-2 px-4 py-3"
            >
              <dt className="text-sm text-cacao/80">{dato.texto}</dt>
              <dd className="font-mono text-2xl font-bold text-selva-2">
                {n(dato.cifra)}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-xl font-semibold text-selva-2">
          Día por día
        </h2>
        {t.serie.length === 0 ? (
          <p className="mt-3 rounded-3xl bg-crema-2 p-5 text-cacao">
            Todavía no hay actividad en este periodo.
          </p>
        ) : (
          <ul className="mt-3 grid gap-1.5">
            {t.serie.slice(-31).map((d) => (
              <li
                key={d.dia}
                className="grid grid-cols-[4.5rem_1fr] items-center gap-x-3 text-sm sm:grid-cols-[4.5rem_1fr_auto]"
              >
                <span className="text-cacao/80">
                  {DIA.format(new Date(`${d.dia}T00:00:00Z`))}
                </span>
                <span className="h-4 rounded-full bg-crema-2">
                  <span
                    className="block h-4 rounded-full bg-selva"
                    style={{ width: `${(d.visitas / maximo) * 100}%` }}
                  />
                </span>
                <span className="col-start-2 font-mono text-cacao sm:col-start-3">
                  {n(d.visitas)} visitas · {n(d.contactos)} contactos
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-display text-xl font-semibold text-selva-2">
            Por negocio
          </h2>
          <a
            href={`/admin/metricas/csv?periodo=${periodo}`}
            className="min-h-11 rounded-full border-2 border-selva/25 bg-white px-5 py-2.5 font-bold text-selva-2"
          >
            Descargar en Excel (CSV)
          </a>
        </div>

        {/* La tabla se desplaza sola en el celular: son demasiadas columnas
            para apilarlas y seguir comparando un negocio con otro. */}
        <div className="mt-3 overflow-x-auto rounded-2xl border-2 border-ink/10 bg-white">
          <table className="w-full min-w-[56rem] text-left text-sm">
            <thead className="bg-crema-2 text-selva-2">
              <tr>
                {COLUMNAS.map((titulo) => (
                  <th key={titulo} className="px-3 py-2.5 font-bold">
                    {titulo}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {t.negocios.map((fila) => (
                <tr key={fila.id} className="border-t border-ink/10">
                  <td className="min-w-52 px-3 py-2.5">
                    <Link
                      href={`/marca/${fila.slug}`}
                      className="font-bold text-selva-2 underline"
                    >
                      {fila.negocio}
                    </Link>
                    <span className="block text-xs text-cacao/70">
                      {fila.sucursal} · {fila.estado}
                    </span>
                  </td>
                  {[
                    fila.actividad.vista_micrositio,
                    fila.actividad.whatsapp,
                    fila.actividad.telefono,
                    fila.actividad.correo,
                    fila.actividad.mapa,
                    fila.actividad.red,
                    fila.actividad.compartir,
                    fila.actividad.catalogo_pdf,
                    fila.actividad.vista_evento,
                    fila.resenas,
                  ].map((cifra, i) => (
                    <td key={i} className="px-3 py-2.5 font-mono">
                      {n(cifra)}
                    </td>
                  ))}
                  <td className="px-3 py-2.5 font-mono">
                    {fila.promedio === null
                      ? "—"
                      : `${fila.promedio.toFixed(1)} (${fila.calificaciones})`}
                  </td>
                  <td className="px-3 py-2.5 font-mono">{n(fila.favoritos)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        {listas.map((lista) => (
          <section key={lista.titulo} className="rounded-3xl bg-crema-2 p-5">
            <h2 className="font-display text-lg font-semibold text-selva-2">
              {lista.titulo}
            </h2>
            {lista.filas.length === 0 ? (
              <p className="mt-2 text-sm text-cacao/70">Nada todavía.</p>
            ) : (
              <ol className="mt-2 grid gap-1 text-sm">
                {lista.filas.map((fila) => (
                  <li key={fila.detalle} className="flex justify-between gap-3">
                    <span className="break-all text-cacao">{fila.texto}</span>
                    <span className="font-mono text-selva-2">
                      {n(Number(fila.total))}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        ))}
      </div>

      <section className="mt-8">
        <h2 className="font-display text-xl font-semibold text-selva-2">
          La comunidad
        </h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {comunidad.map((dato) => (
            <div
              key={dato.texto}
              className="flex flex-col-reverse rounded-2xl bg-crema-2 px-4 py-3"
            >
              <dt className="text-sm text-cacao/80">{dato.texto}</dt>
              <dd className="font-mono text-2xl font-bold text-selva-2">
                {n(dato.cifra)}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </>
  );
}
