import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Comentarios } from "@/components/publico/comentarios";
import { BotonBorrarTema } from "@/components/publico/foro";
import { origenDelSitio, perfilActual } from "@/lib/auth/sesion";
import { temaPorId, yaApoye } from "@/lib/datos/foro";
import { anotarVisita } from "@/lib/datos/comunidad";
import { CarruselPublicacion } from "@/components/publico/carrusel-publicacion";
import { MeGusta } from "@/components/publico/me-gusta";
import { CelebrarPublicacion } from "@/components/publico/celebrar-publicacion";
import { esVideo, urlDePublicacion } from "@/lib/imagenes";
import { comoSeLlama } from "@/lib/nombres";
import {
  apoyosDeComentarios,
  comentariosDe,
  conElPropioArriba,
  cuantosSon,
  participantesDe,
  TOPE_COMENTARIOS,
} from "@/lib/datos/comentarios";
import { haceCuanto } from "@/lib/tiempo";
import { tarjetaSocial } from "@/lib/compartir";
import { BotonCompartir } from "@/components/publico/boton-compartir";

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

  return tarjetaSocial({
    titulo: `${comoSeLlama(tema.titulo, tema.contenido)} · Comunidad`,
    descripcion: tema.contenido,
    imagen: urlDePublicacion(tema.imagenes?.[0]),
    ruta: `/comunidad/${id}`,
    tipo: "article",
  });
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

  const [tema, perfil, comentarios, origen] = await Promise.all([
    temaPorId(id),
    perfilActual(),
    comentariosDe("publicacion", id),
    // El botón de compartir necesita la dirección completa: una relativa no
    // sirve fuera del sitio.
    origenDelSitio(),
  ]);

  if (!tema) notFound();

  /*
    Abrirla es haberla visto: esto apaga el aviso de "comentarios nuevos" del
    muro. Se anota al entrar y no al salir porque quien abre y cierra sin bajar
    ya vio lo que habia, y la hora de salida dependeria de un evento del
    navegador que no siempre llega.
  */
  if (perfil) await anotarVisita(perfil.id, id);

  const nombre = comoSeLlama(tema.titulo, tema.contenido);

  /*
    Lo que lleva la publicación, en el orden en que se subió. Si es video se
    decide por la extensión, igual que en el resto del sitio.
  */
  const medios = tema.imagenes
    .map((ruta) => ({ url: urlDePublicacion(ruta), esVideo: esVideo(ruta) }))
    .filter((m): m is { url: string; esVideo: boolean } => m.url !== null);

  const esMio = perfil?.id === tema.autor_id;

  // Si ya le dio corazón, para pintarlo lleno sin que tenga que tocarlo.
  const apoyado = perfil ? await yaApoye(perfil.id, id) : false;

  /*
    Los corazones de los comentarios, todos en una consulta, y a quién se puede
    etiquetar: quien publicó y quien comentó, nadie más.
  */
  const corazones = await apoyosDeComentarios(
    comentarios.map((c) => c.id),
    perfil?.id,
  );

  const participantes = participantesDe(comentarios, {
    id: tema.autor_id,
    nombre: tema.perfiles_publicos?.nombre ?? "",
  });

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

      {/*
        El mismo orden que en el muro: primero lo que se ve y después lo que se
        lee. Y el mismo carrusel, no la galería de antes — la galería ponía las
        fotos en retícula, que es cómo se mira un álbum, no cómo se mira una
        publicación. Aquí se pasa de una a otra, igual que allá.

        Ya no hay título: desde la migración 000050 una publicación no se
        titula. Donde hace falta un nombre —la pestaña, la tarjeta al
        compartir— lo saca `comoSeLlama` de las primeras palabras del texto.
      */}
      {medios.length > 0 && (
        <CarruselPublicacion
          medios={medios}
          titulo={nombre}
          className="mt-3 overflow-hidden rounded-2xl border-2 border-ink/10"
        />
      )}

      <p className="mt-4 whitespace-pre-line text-lg text-cacao">
        {tema.contenido}
      </p>

      {/*
        El corazón, con su contador y el de comentarios al lado. Aquí había dos
        cosas que se fueron con las mazorcas: un botón para **regalar** una de
        las cinco que la plataforma daba al día, y un "apoyar" que costaba una
        mazorca propia y era solo de las cuentas de cliente. Ahora es un
        corazón, gratis, y lo da cualquiera.
      */}
      <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
        <MeGusta
          clase="publicacion"
          id={id}
          inicial={apoyado}
          cuantos={tema.apoyos}
          comentarios={comentarios.filter((c) => !c.oculto).length}
          haySesion={Boolean(perfil)}
        />

        {/* Junto al corazón y a los comentarios: son las tres cosas que se
            hacen con una publicación cuando ya se leyó. */}
        <BotonCompartir url={`${origen}/comunidad/${id}`} titulo={nombre} />
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
            hace: haceCuanto(comentario.fecha),
            fechaExacta: CUANDO.format(new Date(comentario.fecha)),
            editado: comentario.fecha_edicion !== null,
            oculto: comentario.oculto,
            esMio: comentario.usuario_id === perfil?.id,
            autorId: comentario.usuario_id,
            respondeA: comentario.responde_a,
            apoyos: corazones.get(comentario.id)?.cuantos ?? 0,
            miApoyo: corazones.get(comentario.id)?.mio ?? false,
          }),
        )}
        participantes={participantes}
        puedeGustar
        haySesion={Boolean(perfil)}
        puedeComentar={Boolean(perfil && leQueda)}
        motivo={perfil && leQueda ? null : motivo}
        // Quien modera es quien publicó: es su conversación.
        puedeOcultar={Boolean(esMio)}
      />
    </article>
  );
}
