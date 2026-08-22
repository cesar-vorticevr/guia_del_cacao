import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Comentarios } from "@/components/publico/comentarios";
import { BotonApoyar, BotonBorrarTema } from "@/components/publico/foro";
import { perfilActual } from "@/lib/auth/sesion";
import { temaPorId, yaApoye } from "@/lib/datos/foro";
import { pasaporteDe } from "@/lib/datos/puntos";
import {
  comentariosDe,
  conElPropioArriba,
  cuantosSon,
  TOPE_COMENTARIOS,
} from "@/lib/datos/comentarios";

const CUANDO = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const tema = await temaPorId(id);

  if (!tema) return { title: "No encontrado · Guía del Cacao" };

  return { title: `${tema.titulo} · Foro · Guía del Cacao` };
}

export default async function TemaDelForo({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [tema, perfil, comentarios] = await Promise.all([
    temaPorId(id),
    perfilActual(),
    comentariosDe("foro", id),
  ]);

  if (!tema) notFound();

  const esCliente = perfil?.rol === "cliente" && perfil.rol_confirmado;
  const esMio = perfil?.id === tema.autor_id;

  // Apoyar y comentar dependen de cosas que solo se pueden preguntar sabiendo
  // quién mira: cuántas monedas le quedan y si ya apoyó.
  let monedas = 0;
  let apoyado = false;

  if (esCliente) {
    [monedas, apoyado] = await Promise.all([
      pasaporteDe(perfil.id).then((p) => p.puntos),
      yaApoye(perfil.id, id),
    ]);
  }

  const mios = cuantosSon(comentarios, perfil?.id);
  const leQueda = mios < TOPE_COMENTARIOS.foro;

  const motivo = !perfil ? (
    <>
      <Link href={`/login?volver=/comunidad/tema/${id}`} className="font-bold text-selva underline">
        Inicia sesión
      </Link>{" "}
      para participar en el foro.
    </>
  ) : !esCliente ? (
    "El foro es de las cuentas de cliente."
  ) : (
    `Ya dejaste tus ${TOPE_COMENTARIOS.foro} comentarios en este tema.`
  );

  return (
    <article className="mx-auto max-w-2xl py-6">
      <Link href="/comunidad" className="font-bold text-selva underline">
        ← Volver a la comunidad
      </Link>

      <p className="mt-4 font-mono text-xs tracking-wide text-cacao/70 uppercase">
        {CUANDO.format(new Date(tema.fecha))} ·{" "}
        {tema.perfiles_publicos?.nombre ?? "Alguien"}
        {tema.fecha_edicion && " · editado"}
      </p>

      <h1 className="mt-1.5 font-display text-3xl">{tema.titulo}</h1>

      <p className="mt-4 whitespace-pre-line text-lg text-cacao">{tema.contenido}</p>

      <div className="mt-6">
        {esCliente ? (
          <BotonApoyar
            temaId={id}
            yaApoyaste={apoyado}
            esMio={Boolean(esMio)}
            monedas={monedas}
            apoyos={tema.apoyos}
          />
        ) : (
          <p className="rounded-3xl bg-crema-2 p-5 text-cacao">
            {tema.apoyos === 0
              ? "Todavía nadie lo apoya."
              : `${tema.apoyos} ${
                  tema.apoyos === 1 ? "persona lo apoya" : "personas lo apoyan"
                }.`}
          </p>
        )}
      </div>

      {esMio && (
        <div className="mt-4">
          <BotonBorrarTema temaId={id} />
        </div>
      )}

      <Comentarios
        contexto="foro"
        referenciaId={id}
        comentarios={conElPropioArriba(comentarios, perfil?.id).map((comentario) => ({
          id: comentario.id,
          autor: comentario.perfiles_publicos?.nombre ?? "Alguien",
          texto: comentario.texto,
          fechaTexto: CUANDO.format(new Date(comentario.fecha)),
          editado: comentario.fecha_edicion !== null,
          oculto: comentario.oculto,
          esMio: comentario.usuario_id === perfil?.id,
        }))}
        puedeComentar={Boolean(esCliente && leQueda)}
        motivo={esCliente && leQueda ? null : motivo}
        // En el foro quien modera es quien abrió el tema: es su conversación.
        puedeOcultar={Boolean(esMio)}
      />
    </article>
  );
}
