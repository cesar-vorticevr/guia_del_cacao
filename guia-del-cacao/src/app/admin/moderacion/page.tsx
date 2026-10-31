import Link from "next/link";
import type { Metadata } from "next";
import { numeroDePagina, Paginacion } from "@/components/admin/listas";
import { Pestanas } from "@/components/negocio/pestanas";
import { descartarReportes, eliminarPublicacion, eliminarResena } from "@/lib/admin/acciones";
import {
  comunidadPagina,
  eventosPagina,
  resenasPagina,
  resenasReportadas,
  type PublicacionAdmin,
  type ResenaAdmin,
} from "@/lib/datos/admin";
import { MOTIVOS_DE_REPORTE } from "@/lib/reportes";
import { atenderReportesDeConversacion } from "@/lib/buzon/acciones";
import { MOTIVOS_DE_MENSAJE } from "@/lib/buzon/textos";
import { conversacionDe, conversacionesReportadas, type ConversacionReportada } from "@/lib/datos/buzon";

export const metadata: Metadata = { title: "Moderación · Guía del Cacao" };

const CUANDO = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const BOTON_BORRAR =
  "min-h-11 rounded-full border-2 border-guayaba/50 px-5 py-2.5 font-bold text-cacao";

type Seccion = "reportadas" | "mensajes" | "resenas" | "eventos" | "comunidad";

/** Lo común de una reseña: dónde, quién, qué dijo y qué le respondieron. */
function CuerpoDeResena({ resena }: { resena: ResenaAdmin }) {
  return (
    <>
      <p className="font-mono text-xs tracking-wide text-cacao/70 uppercase">
        {CUANDO.format(new Date(resena.fecha))}
        {resena.sucursales && (
          <>
            {" · "}
            <Link href={`/marca/${resena.sucursales.slug}`} className="underline">
              {resena.sucursales.nombre_sucursal}
            </Link>
          </>
        )}
      </p>

      <p className="mt-1 font-bold text-selva-2">
        {resena.perfiles_publicos?.nombre ?? "Visitante"}
      </p>
      <p className="mt-1 whitespace-pre-line text-cacao">{resena.texto}</p>

      {resena.respuesta_marca && (
        <p className="mt-2 rounded-xl bg-white p-3 text-cacao">
          <span className="block font-bold text-selva-2">Respuesta del negocio</span>
          {resena.respuesta_marca}
        </p>
      )}
    </>
  );
}

function BorrarResena({ id }: { id: string }) {
  return (
    <form action={eliminarResena}>
      <input type="hidden" name="resena_id" value={id} />
      <button type="submit" className={BOTON_BORRAR}>
        Eliminar reseña
      </button>
    </form>
  );
}

function ListaPublicaciones({
  tipo,
  publicaciones,
  vacio,
}: {
  tipo: "eventos" | "publicaciones";
  publicaciones: PublicacionAdmin[];
  vacio: string;
}) {
  if (publicaciones.length === 0) {
    return <p className="mt-6 rounded-3xl bg-crema-2 p-6 text-cacao">{vacio}</p>;
  }

  return (
    <ul className="mt-6 grid gap-3">
      {publicaciones.map((publicacion) => (
        <li key={publicacion.id} className="rounded-2xl bg-crema-2 p-5">
          <p className="font-mono text-xs tracking-wide text-cacao/70 uppercase">
            {CUANDO.format(new Date(publicacion.fecha))}
            {publicacion.autor && ` · ${publicacion.autor}`}
          </p>
          {publicacion.titulo && (
            <p className="mt-1 font-bold text-selva-2">{publicacion.titulo}</p>
          )}
          <p className="mt-1 line-clamp-3 whitespace-pre-line text-cacao">
            {publicacion.contenido}
          </p>

          <div className="mt-3 flex flex-wrap gap-3">
            {publicacion.enlace && (
              <Link
                href={publicacion.enlace}
                className="flex min-h-11 items-center rounded-full border-2 border-selva/25 bg-white px-5 font-bold text-selva-2"
              >
                Ver
              </Link>
            )}
            <form action={eliminarPublicacion}>
              <input type="hidden" name="publicacion_id" value={publicacion.id} />
              <input type="hidden" name="tipo" value={tipo} />
              <button type="submit" className={BOTON_BORRAR}>
                Eliminar
              </button>
            </form>
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * Moderación, en pestañas.
 *
 * **Reportadas va primero**: son las que alguien —casi siempre el negocio— ya
 * señaló, y revisar esas es lo que hace falta a diario. Las demás pestañas son
 * para buscar a mano, de 20 en 20, hasta la más vieja: antes se veían solo las
 * últimas 40 reseñas y 20 eventos, y lo de antes quedaba fuera de alcance.
 */
export default async function Moderacion({
  searchParams,
}: {
  searchParams: Promise<{ ver?: string; pagina?: string }>;
}) {
  const { ver, pagina } = await searchParams;
  const seccion: Seccion =
    ver === "mensajes" || ver === "resenas" || ver === "eventos" || ver === "comunidad"
      ? ver
      : "reportadas";
  const numero = numeroDePagina(pagina);

  // Las reportadas se piden siempre: su número va en la pestaña. Las
  // conversaciones del buzón (000069) también.
  const [reportadas, mensajes] = await Promise.all([resenasReportadas(), conversacionesReportadas()]);

  const base = "/admin/moderacion";

  return (
    <>
      <h1 className="font-display text-3xl">Moderación</h1>
      <p className="mt-2 text-cacao">
        Eliminar es definitivo. Se borra en vez de esconderse: si algo amerita
        moderación, guardarlo &laquo;por si acaso&raquo; solo alarga el tiempo
        que sigue en la base.
      </p>

      <div className="mt-6">
        <Pestanas
          base={base}
          actual={seccion}
          etiqueta="Qué moderar"
          pestanas={[
            {
              clave: "reportadas",
              texto: "Reportadas",
              cuenta: reportadas.length,
              destella: reportadas.length > 0,
            },
            {
              clave: "mensajes",
              texto: "Mensajes",
              cuenta: mensajes.length,
              destella: mensajes.length > 0,
            },
            { clave: "resenas", texto: "Reseñas" },
            { clave: "eventos", texto: "Eventos" },
            { clave: "comunidad", texto: "Comunidad" },
          ]}
        />
      </div>

      {seccion === "reportadas" &&
        (reportadas.length === 0 ? (
          <p className="mt-6 rounded-3xl bg-crema-2 p-6 text-cacao">
            Nadie ha reportado ninguna reseña. Cuando alguien lo haga, aparece
            aquí.
          </p>
        ) : (
          <ul className="mt-6 grid gap-4">
            {reportadas.map((resena) => (
              <li
                key={resena.id}
                className="rounded-2xl border-2 border-guayaba/40 bg-crema-2 p-5"
              >
                <p className="mb-3 rounded-xl bg-guayaba/15 px-3 py-2 text-sm text-cacao">
                  <strong className="text-selva-2">
                    {resena.reportes === 1
                      ? "1 reporte"
                      : `${resena.reportes} reportes`}
                  </strong>{" "}
                  ·{" "}
                  {resena.motivos
                    .map((m) => MOTIVOS_DE_REPORTE[m as keyof typeof MOTIVOS_DE_REPORTE] ?? m)
                    .join(", ")}{" "}
                  · el último el {CUANDO.format(new Date(resena.ultimo))}
                  {resena.detalles.length > 0 && (
                    <span className="mt-1 block italic">
                      «{resena.detalles[0]}»
                      {resena.detalles.length > 1 &&
                        ` y ${resena.detalles.length - 1} comentario${resena.detalles.length > 2 ? "s" : ""} más`}
                    </span>
                  )}
                </p>

                <CuerpoDeResena resena={resena} />

                <div className="mt-3 flex flex-wrap gap-3">
                  <BorrarResena id={resena.id} />
                  <form action={descartarReportes}>
                    <input type="hidden" name="resena_id" value={resena.id} />
                    <button
                      type="submit"
                      className="min-h-11 rounded-full border-2 border-selva/25 bg-white px-5 py-2.5 font-bold text-selva-2"
                    >
                      Está bien, dejarla
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        ))}

      {seccion === "mensajes" && <SeccionMensajes reportadas={mensajes} />}
      {seccion === "resenas" && <SeccionResenas numero={numero} base={base} />}
      {seccion === "eventos" && <SeccionEventos numero={numero} base={base} />}
      {seccion === "comunidad" && <SeccionComunidad numero={numero} base={base} />}
    </>
  );
}

async function SeccionResenas({ numero, base }: { numero: number; base: string }) {
  const resultado = await resenasPagina(numero);

  return (
    <>
      {resultado.filas.length === 0 ? (
        <p className="mt-6 rounded-3xl bg-crema-2 p-6 text-cacao">Todavía no hay reseñas.</p>
      ) : (
        <ul className="mt-6 grid gap-3">
          {resultado.filas.map((resena) => (
            <li key={resena.id} className="rounded-2xl bg-crema-2 p-5">
              <CuerpoDeResena resena={resena} />
              <div className="mt-3">
                <BorrarResena id={resena.id} />
              </div>
            </li>
          ))}
        </ul>
      )}

      <Paginacion
        base={base}
        pagina={resultado.pagina}
        paginas={resultado.paginas}
        total={resultado.total}
        parametros={{ ver: "resenas" }}
        nombre={resultado.total === 1 ? "reseña" : "reseñas"}
      />
    </>
  );
}

async function SeccionEventos({ numero, base }: { numero: number; base: string }) {
  const resultado = await eventosPagina(numero);

  return (
    <>
      <ListaPublicaciones tipo="eventos" publicaciones={resultado.filas} vacio="Nada publicado aún." />
      <Paginacion
        base={base}
        pagina={resultado.pagina}
        paginas={resultado.paginas}
        total={resultado.total}
        parametros={{ ver: "eventos" }}
        nombre={resultado.total === 1 ? "evento" : "eventos"}
      />
    </>
  );
}

async function SeccionComunidad({ numero, base }: { numero: number; base: string }) {
  const resultado = await comunidadPagina(numero);

  return (
    <>
      <ListaPublicaciones
        tipo="publicaciones"
        publicaciones={resultado.filas}
        vacio="Nadie ha publicado en la comunidad todavía."
      />
      <Paginacion
        base={base}
        pagina={resultado.pagina}
        paginas={resultado.paginas}
        total={resultado.total}
        parametros={{ ver: "comunidad" }}
        nombre={resultado.total === 1 ? "publicación" : "publicaciones"}
      />
    </>
  );
}

/**
 * Conversaciones del buzón con reportes sin revisar (migración 000069).
 *
 * No hay «eliminar»: una conversación no se borra, es la regla del buzón. Lo
 * que hace el administrador es leerla entera, escribirle a quien haga falta
 * desde Personas o su buzón, y marcar los reportes como revisados. Revisados
 * no se borran: queda constancia de que alguien lo señaló y de que se miró.
 */
async function SeccionMensajes({ reportadas }: { reportadas: ConversacionReportada[] }) {
  if (reportadas.length === 0) {
    return (
      <p className="mt-6 rounded-3xl bg-crema-2 p-6 text-cacao">
        Nadie ha reportado ningún mensaje. Cuando alguien lo haga, aparece aquí.
      </p>
    );
  }

  const conversaciones = await Promise.all(reportadas.map((r) => conversacionDe(r.conversacion_id)));

  return (
    <ul className="mt-6 grid gap-4">
      {reportadas.map((reporte, i) => {
        const conversacion = conversaciones[i];
        const nombres = new Map(conversacion?.participantes.map((p) => [p.usuario_id, p.nombre]) ?? []);
        const senalados = (conversacion?.mensajes ?? []).filter((m) =>
          reporte.mensajes_reportados.includes(m.id),
        );

        return (
          <li key={reporte.conversacion_id} className="rounded-2xl border-2 border-guayaba/40 bg-crema-2 p-5">
            <p className="mb-3 rounded-xl bg-guayaba/15 px-3 py-2 text-sm text-cacao">
              <strong className="text-selva-2">
                {reporte.reportes === 1 ? "1 reporte" : `${reporte.reportes} reportes`}
              </strong>{" "}
              ·{" "}
              {reporte.motivos
                .map((m) => MOTIVOS_DE_MENSAJE[m as keyof typeof MOTIVOS_DE_MENSAJE] ?? m)
                .join(", ")}{" "}
              · de {reporte.quienes.join(", ")} · el último el {CUANDO.format(new Date(reporte.ultimo))}
              {reporte.detalles.length > 0 && (
                <span className="mt-1 block italic">«{reporte.detalles[0]}»</span>
              )}
            </p>

            <p className="font-bold text-selva-2">
              {conversacion?.participantes.map((p) => p.nombre).join(" y ") ?? "Conversación"}
            </p>

            {senalados.length > 0 ? (
              <ul className="mt-2 grid gap-2">
                {senalados.map((m) => (
                  <li key={m.id} className="rounded-xl bg-white p-3 text-cacao">
                    <span className="block text-xs font-bold text-selva-2">
                      {nombres.get(m.autor_id)} · {CUANDO.format(new Date(m.creado_en))}
                    </span>
                    <span className="whitespace-pre-line">{m.texto}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-cacao/80">Se reportó la conversación entera.</p>
            )}

            <div className="mt-3 flex flex-wrap gap-3">
              <Link
                href={`/buzon/${reporte.conversacion_id}`}
                className="flex min-h-11 items-center rounded-full border-2 border-selva/25 bg-white px-5 font-bold text-selva-2"
              >
                Leer la conversación
              </Link>
              <form action={atenderReportesDeConversacion}>
                <input type="hidden" name="conversacion_id" value={reporte.conversacion_id} />
                <button
                  type="submit"
                  className="min-h-11 rounded-full border-2 border-selva/25 bg-white px-5 py-2.5 font-bold text-selva-2"
                >
                  Ya lo revisé
                </button>
              </form>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
