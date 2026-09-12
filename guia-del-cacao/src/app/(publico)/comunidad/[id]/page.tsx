import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Comentarios } from "@/components/publico/comentarios";
import { BotonBorrarTema } from "@/components/publico/foro";
import { perfilActual } from "@/lib/auth/sesion";
import { temaPorId, yaApoye } from "@/lib/datos/foro";
import { anotarVisita } from "@/lib/datos/comunidad";
import { GaleriaPublicacion } from "@/components/publico/galeria-publicacion";
import { MeGusta } from "@/components/publico/me-gusta";
import { CelebrarPublicacion } from "@/components/publico/celebrar-publicacion";
import { urlDePublicacion } from "@/lib/imagenes";
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

  return { title: `${tema.titulo} · Comunidad · Guía del Cacao` };
}

export default async function Publicacion({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ nueva?: string }>;
}) {
  const { id } = await params;

  // `?nueva=1` lo pone la acción al redirigir después de publicar: es lo que
  // dispara el festejo, ya en la página de la publicación recién hecha.
  const { nueva } = await searchParams;

  const [tema, perfil, comentarios] = await Promise.all([
    temaPorId(id),
    perfilActual(),
    comentariosDe("publicacion", id),
  ]);

  if (!tema) notFound();

  /*
    Abrirla es haberla visto: esto apaga el aviso de "comentarios nuevos" del
    muro. Se anota al entrar y no al salir porque quien abre y cierra sin bajar
    ya vio lo que habia, y la hora de salida dependeria de un evento del
    navegador que no siempre llega.
  */
  if (perfil) await anotarVisita(perfil.id, id);

  const esMio = perfil?.id === tema.autor_id;

  // Si ya le dio corazón, para pintarlo lleno sin que tenga que tocarlo.
  const apoyado = perfil ? await yaApoye(perfil.id, id) : false;

  const mios = cuantosSon(comentarios, perfil?.id);
  const leQueda = mios < TOPE_COMENTARIOS.publicacion;

  /*
    Comentar ya no pide ser cliente ni tener mazorcas: comenta cualquier cuenta
    (migración 000044). Lo único que queda es el tope de comentarios por
    publicación, que existe para que una conversación no la acapare una persona.
  */
  const motivo = !perfil ? (
    <>
      <Link
        href={`/login?volver=/comunidad/${id}`}
        className="font-bold text-selva underline"
      >
        Inicia sesión
      </Link>{" "}
      para comentar.
    </>
  ) : (
    `Ya dejaste tus ${TOPE_COMENTARIOS.publicacion} comentarios aquí.`
  );

  return (
    <article className="mx-auto max-w-2xl py-6">
      {nueva && <CelebrarPublicacion />}

      <Link href="/comunidad" className="font-bold text-selva underline">
        ← Volver a la comunidad
      </Link>

      <p className="mt-4 font-mono text-xs tracking-wide text-cacao/70 uppercase">
        {CUANDO.format(new Date(tema.fecha))} ·{" "}
        {tema.perfiles_publicos?.nombre ?? "Alguien"}
        {tema.fecha_edicion && " · editado"}
      </p>

      <h1 className="mt-1.5 font-display text-3xl">{tema.titulo}</h1>

      <p className="mt-4 whitespace-pre-line text-lg text-cacao">
        {tema.contenido}
      </p>

      {tema.imagenes.length > 0 && (
        <GaleriaPublicacion
          fotos={tema.imagenes
            .map((ruta) => urlDePublicacion(ruta))
            .filter((u): u is string => u !== null)}
          titulo={tema.titulo}
        />
      )}

      {/*
        El corazón, con su contador y el de comentarios al lado. Aquí había dos
        cosas que se fueron con las mazorcas: un botón para **regalar** una de
        las cinco que la plataforma daba al día, y un "apoyar" que costaba una
        mazorca propia y era solo de las cuentas de cliente. Ahora es un
        corazón, gratis, y lo da cualquiera.
      */}
      <div className="mt-6">
        <MeGusta
          clase="publicacion"
          id={id}
          inicial={apoyado}
          cuantos={tema.apoyos}
          comentarios={comentarios.filter((c) => !c.oculto).length}
          haySesion={Boolean(perfil)}
        />
      </div>

      {esMio && (
        <div className="mt-4">
          <BotonBorrarTema temaId={id} />
        </div>
      )}

      <Comentarios
        contexto="publicacion"
        referenciaId={id}
        comentarios={conElPropioArriba(comentarios, perfil?.id).map(
          (comentario) => ({
            id: comentario.id,
            autor: comentario.perfiles_publicos?.nombre ?? "Alguien",
            texto: comentario.texto,
            fechaTexto: CUANDO.format(new Date(comentario.fecha)),
            editado: comentario.fecha_edicion !== null,
            oculto: comentario.oculto,
            esMio: comentario.usuario_id === perfil?.id,
            autorId: comentario.usuario_id,
            respondeA: comentario.responde_a,
          }),
        )}
        puedeComentar={Boolean(perfil && leQueda)}
        motivo={perfil && leQueda ? null : motivo}
        // Quien modera es quien publicó: es su conversación.
        puedeOcultar={Boolean(esMio)}
      />
    </article>
  );
}
