import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { FormularioTema } from "@/components/publico/foro";
import { MuroComunidad } from "@/components/publico/muro-comunidad";
import { FondoDeCacao } from "@/components/publico/fondo-cacao";
import { MiPublicacion } from "@/components/publico/mi-publicacion";
import { perfilActual } from "@/lib/auth/sesion";
import { muroDeComunidad } from "@/lib/datos/comunidad";
import { misSucursales } from "@/lib/datos/sucursales";
import { FUNCIONES } from "@/lib/funciones";

export const metadata: Metadata = { title: "Comunidad · Guía del Cacao" };

/**
 * El muro de la comunidad.
 *
 * Tenía tres formatos —temas, eventos y noticias— con su filtro por clase y su
 * formulario cada uno. Desde fuera eran lo mismo: alguien cuenta algo y los
 * demás comentan. Lo único distinto de verdad era el evento, que tiene fecha y
 * caduca, y se quedó en su agenda. Aquí solo hay publicaciones.
 *
 * Arriba va la última de quien mira, porque lo primero que se viene a ver es si
 * le respondieron; debajo, todo lo demás.
 */
export default async function Comunidad() {
  if (!FUNCIONES.comunidad) redirect("/directorio");

  const perfil = await perfilActual();

  // Solo el primer tramo. Los siguientes los pide el muro al ir bajando.
  const primerTramo = await muroDeComunidad(perfil?.id);

  const puedeParticipar =
    perfil?.rol_confirmado &&
    (perfil.rol === "cliente" || perfil.rol === "negocio");
  const esNegocio = perfil?.rol === "negocio";

  /*
    Publicar ya no es del plan: lo puede hacer cualquier cuenta, una vez al día
    (migración 000044). Lo único que se sigue pidiendo a un negocio es tener una
    sucursal publicada, porque es con la que firma la publicación y no se puede
    firmar con un micrositio que nadie puede abrir.
  */
  const sucursales = esNegocio ? await misSucursales(perfil.id) : [];
  const publicadas = sucursales.filter((s) => s.estado === "publicado");

  const puedePublicar = esNegocio
    ? publicadas.length > 0
    : Boolean(puedeParticipar);

  // Su publicación de hoy, si ya publicó: es lo que explica por qué el
  // formulario no aparece.
  const hoy = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Mexico_City",
  });

  const deHoy = primerTramo.entradas.find(
    (entrada) =>
      entrada.mia &&
      new Date(entrada.fecha).toLocaleDateString("en-CA", {
        timeZone: "America/Mexico_City",
      }) === hoy,
  );

  return (
    <>
      {/*
        El fondo de cacao acompaña al muro entero, no a una franja.

        Va en `pantalla` —colgado del viewport, no de una caja— porque un muro
        no tiene largo conocido: crece con cada tirón del scroll infinito, y una
        franja de altura fija se habría quedado corta a la segunda página.
        Colgado del viewport se mueve con el scroll y acompaña hasta el final.

        Con `soloOrillas`, que deja fuera la pieza ancha que pasa por detrás del
        texto: aquí lo que se viene a hacer es leer.
      */}
      <FondoDeCacao variante="pantalla" soloOrillas />



      <h1 className="pt-8 font-display text-3xl">Comunidad</h1>
      <p className="mt-2 max-w-prose text-cacao">
        Lo que se está diciendo: publica lo tuyo y comenta lo de los demás.
      </p>

      <div className="pt-5">
        {!perfil ? (
          <p className="rounded-3xl bg-crema-2 p-5 text-cacao">
            <Link
              href="/login?volver=/comunidad"
              className="font-bold text-selva underline"
            >
              Inicia sesión
            </Link>{" "}
            para publicar y comentar.
          </p>
        ) : deHoy ? (
          /*
            Ya publicó hoy. Se le dice aquí y no al fallar el guardado: escribir
            un texto, elegir cuatro fotos y recibir entonces un "ya publicaste
            hoy" es hacerle perder el trabajo.
          */
          <p className="rounded-3xl border-2 border-mango/50 bg-mango/15 p-5 text-cacao">
            <strong className="block font-display text-lg text-selva-2">
              Ya publicaste hoy
            </strong>
            Es una publicación al día por cuenta, para que el muro no se llene.
            Mañana puedes volver a publicar.
          </p>
        ) : esNegocio && !puedePublicar ? (
          <p className="rounded-3xl border-2 border-mango/50 bg-mango/15 p-5 text-cacao">
            <strong className="block font-display text-lg text-selva-2">
              Publica tu micrositio primero
            </strong>
            Una publicación va firmada por una de tus sucursales, y todavía no
            tienes ninguna en el directorio.
          </p>
        ) : puedePublicar ? (
          <FormularioTema sucursales={publicadas} />
        ) : null}
      </div>

      {deHoy && (
        <section className="pt-8">
          <h2 className="font-display text-2xl">Tu publicación de hoy</h2>
          <MiPublicacion entrada={deHoy} />
        </section>
      )}

      <section className="pt-8">
        <MuroComunidad
          iniciales={primerTramo.entradas}
          cursorInicial={primerTramo.siguiente}
          haySesion={Boolean(perfil)}
        />
      </section>
    </>
  );
}
