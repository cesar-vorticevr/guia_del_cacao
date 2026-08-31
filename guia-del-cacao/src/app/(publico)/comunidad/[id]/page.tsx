import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Comentarios } from "@/components/publico/comentarios";
import { BotonApoyar, BotonBorrarTema } from "@/components/publico/foro";
import { perfilActual } from "@/lib/auth/sesion";
import { temaPorId, yaApoye } from "@/lib/datos/foro";
import { anotarVisita, bolsaDeRegalos } from "@/lib/datos/comunidad";
import { GaleriaPublicacion } from "@/components/publico/galeria-publicacion";
import { RegalarMazorca } from "@/components/publico/regalar-mazorca";
import { AvisosDeMonedas } from "@/components/negocio/avisos-de-monedas";
import { CelebrarPublicacion } from "@/components/publico/celebrar-publicacion";
import { urlDePublicacion } from "@/lib/imagenes";
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

  // La bolsa se pregunta una vez para toda la pantalla: con quince comentarios
  // serían quince consultas para saber quince veces lo mismo.
  const bolsa = await bolsaDeRegalos(perfil?.id);

  const esCliente = perfil?.rol === "cliente" && perfil.rol_confirmado;
  const esMio = perfil?.id === tema.autor_id;

  // Apoyar y comentar dependen de cosas que solo se pueden preguntar sabiendo
  // quién mira: cuántas mazorcas le quedan y si ya apoyó.
  let monedas = 0;
  let apoyado = false;

  if (esCliente) {
    [monedas, apoyado] = await Promise.all([
      pasaporteDe(perfil.id).then((p) => p.puntos),
      yaApoye(perfil.id, id),
    ]);
  }

  const mios = cuantosSon(comentarios, perfil?.id);
  const leQueda = mios < TOPE_COMENTARIOS.publicacion;

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
  ) : !esCliente ? (
    "Comentar es de las cuentas de cliente."
  ) : (
    `Ya dejaste tus ${TOPE_COMENTARIOS.publicacion} comentarios aquí.`
  );

  return (
    <article className="mx-auto max-w-2xl py-6">
      <AvisosDeMonedas />
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
        Regalar va antes que apoyar: es lo que cualquiera puede hacer hoy con la
        bolsa que le dio la plataforma, mientras que apoyar cuesta una mazorca
        propia y es de las cuentas de cliente.
      */}
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <RegalarMazorca
          aPerfil={tema.autor_id}
          aNombre={tema.perfiles_publicos?.nombre ?? "quien publicó"}
          publicacionId={id}
          yaLeDi={bolsa.yaLesDi.has(tema.autor_id)}
          quedan={bolsa.quedan}
          esMia={Boolean(esMio)}
          haySesion={Boolean(perfil)}
        />

        <span className="font-mono text-xs text-cacao/70">
          {perfil && !esMio
            ? `Te quedan ${bolsa.quedan} de las 5 de hoy`
            : null}
        </span>
      </div>

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
            yaLeDi: bolsa.yaLesDi.has(comentario.usuario_id),
          }),
        )}
        bolsa={bolsa.quedan}
        haySesion={Boolean(perfil)}
        yoSoy={perfil?.id ?? null}
        puedeComentar={Boolean(esCliente && leQueda)}
        motivo={esCliente && leQueda ? null : motivo}
        // Quien modera es quien publicó: es su conversación.
        puedeOcultar={Boolean(esMio)}
      />
    </article>
  );
}
