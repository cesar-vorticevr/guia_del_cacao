import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { EscribirMensaje, RefrescarConversacion } from "@/components/buzon/escribir";
import { ReportarEnBuzon } from "@/components/buzon/reportar";
import { perfilActual } from "@/lib/auth/sesion";
import { tipoDeCuenta } from "@/lib/buzon/textos";
import { conversacionDe, marcarConversacionLeida, misReportesEn } from "@/lib/datos/buzon";
import { haceCuanto } from "@/lib/tiempo";

export const metadata: Metadata = { title: "Conversación · Buzón · Guía del Cacao" };

const DIA = new Intl.DateTimeFormat("es-MX", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "America/Mexico_City",
});

const HORA = new Intl.DateTimeFormat("es-MX", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Mexico_City",
});

/**
 * Una conversación del buzón.
 *
 * La lee una de las dos partes, o el administrador **para moderar**: a él se
 * le enseña sin caja de escribir y con las dos partes nombradas, porque la
 * política no lo deja hablar en una conversación ajena.
 *
 * Abrirla la marca leída y apaga su aviso (`marcar_conversacion_leida`).
 * No hay botón de borrar, ni de editar: lo que se escribe aquí se queda.
 */
export default async function Conversacion({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const perfil = await perfilActual();

  if (!perfil) redirect(`/login?volver=/buzon/${id}`);

  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const conversacion = await conversacionDe(id);
  if (!conversacion) notFound();

  const yo = conversacion.participantes.find((p) => p.usuario_id === perfil.id);
  const otro = conversacion.participantes.find((p) => p.usuario_id !== perfil.id);
  const moderando = !yo;

  const [reportes] = await Promise.all([
    moderando ? Promise.resolve(null) : misReportesEn(id, perfil.id),
    moderando ? Promise.resolve() : marcarConversacionLeida(id),
  ]);

  const nombres = new Map(conversacion.participantes.map((p) => [p.usuario_id, p.nombre]));
  const otroEscribio = conversacion.mensajes.some((m) => m.autor_id !== perfil.id);

  // Los mensajes se agrupan por día, en hora del centro: «martes 28 de octubre».
  const dias = conversacion.mensajes.map((m) => DIA.format(new Date(m.creado_en)));

  return (
    <div className="mx-auto grid max-w-3xl gap-6 py-8">
      <RefrescarConversacion />

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={moderando ? "/admin/moderacion?ver=mensajes" : "/buzon"}
            className="text-sm font-bold text-mango underline underline-offset-4"
          >
            ← {moderando ? "Volver a moderación" : "Tu buzón"}
          </Link>
          <h1 className="mt-2 truncate font-display text-3xl">
            {moderando
              ? conversacion.participantes.map((p) => p.nombre).join(" y ")
              : otro?.nombre}
          </h1>
          {!moderando && otro && (
            <p className="text-sm text-crema/70">{tipoDeCuenta(otro.tipo)}</p>
          )}
        </div>

        {!moderando && otroEscribio && reportes && (
          <ReportarEnBuzon
            conversacionId={id}
            yaReportado={reportes.conversacion}
            texto="Reportar la conversación"
          />
        )}
      </header>

      {moderando && (
        <p className="rounded-2xl border-2 border-mango/50 bg-mango/15 p-4 text-sm font-bold">
          Estás leyendo esta conversación como administrador, para moderarla. Ninguna
          de las dos partes ve que la abriste, y aquí no puedes escribir.
        </p>
      )}

      <ol className="grid gap-3" aria-label="Mensajes">
        {conversacion.mensajes.length === 0 && (
          <li className="rounded-3xl bg-crema-2 p-6 text-center text-cacao">
            Todavía no hay mensajes. Escribe el primero abajo.
          </li>
        )}

        {conversacion.mensajes.map((mensaje, i) => {
          const mio = mensaje.autor_id === perfil.id;
          const fecha = new Date(mensaje.creado_en);
          const dia = dias[i];
          const cambiaDia = i === 0 || dia !== dias[i - 1];

          return (
            <li key={mensaje.id} className="grid gap-3">
              {cambiaDia && (
                <p className="text-center font-mono text-xs tracking-wide text-crema/60 uppercase">
                  {dia}
                </p>
              )}

              <div className={`flex flex-col gap-1 ${mio ? "items-end" : "items-start"}`}>
                {moderando && (
                  <span className="px-2 text-xs font-bold text-mango">{nombres.get(mensaje.autor_id)}</span>
                )}
                <p
                  className={`max-w-[85%] whitespace-pre-line break-words rounded-3xl px-4 py-2.5 ${
                    mio
                      ? "rounded-br-md bg-mango/90 text-ink"
                      : "rounded-bl-md border-2 border-ink/10 bg-white text-cacao"
                  }`}
                >
                  {mensaje.texto}
                </p>
                <span className="flex flex-wrap items-center gap-3 px-2">
                  <time
                    dateTime={mensaje.creado_en}
                    title={`${dia}, ${HORA.format(fecha)}`}
                    className="font-mono text-[0.7rem] text-crema/55"
                  >
                    {HORA.format(fecha)} · {haceCuanto(mensaje.creado_en)}
                  </time>
                  {!mio && !moderando && reportes && (
                    <ReportarEnBuzon
                      conversacionId={id}
                      mensajeId={mensaje.id}
                      yaReportado={reportes.mensajes.has(mensaje.id)}
                    />
                  )}
                </span>
              </div>
            </li>
          );
        })}
      </ol>

      {!moderando && <EscribirMensaje conversacionId={id} />}
    </div>
  );
}
