import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { FormularioTema } from "@/components/publico/foro";
import { MuroComunidad } from "@/components/publico/muro-comunidad";
import { MiPublicacion } from "@/components/publico/mi-publicacion";
import { origenDelSitio, perfilActual } from "@/lib/auth/sesion";
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

  const [perfil, origen] = await Promise.all([perfilActual(), origenDelSitio()]);

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
        Aquí no va el fondo de cacao, y es el único sitio del que se quitó.

        Lo tuvo, colgado del viewport y con `soloOrillas`. En escritorio se
        asomaba por los márgenes y estaba bien; en celular no hay márgenes —la
        columna se come la pantalla— y las tres piezas que salen a esa anchura
        quedaban justo detrás del texto. Se leía "Publica lo tuyo" sobre una
        rama.

        La decoración sigue en la portada, que es donde se entra y donde una
        textura invita. Un muro se viene a leer, y detrás de un texto que se lee
        no va nada. Para devolverlo basta con una línea:
        `<FondoDeCacao variante="pantalla" soloOrillas />`.
      */}

      {/*
        Todo el muro vive en una columna angosta y centrada, no a los 1180 px
        del contenedor. Un renglón de texto a lo ancho de una pantalla de
        escritorio se pierde al saltar de línea, y una publicación estirada a
        1180 px deja de parecer una publicación. 40rem es la medida de una
        columna de lectura cómoda, y es la misma que usa cualquier muro.
      */}
      <div className="mx-auto w-full max-w-[40rem]">
        <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 pt-7 pb-4">
          <h1 className="font-display text-2xl">Comunidad</h1>
          <p className="text-sm text-cacao/80">
            Publica lo tuyo y comenta lo de los demás.
          </p>
        </header>

        {!perfil ? (
          <p className="rounded-2xl border-2 border-ink/10 bg-white p-4 text-sm text-cacao shadow-dura-sm">
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
          <p className="rounded-2xl border-2 border-mango/50 bg-mango/15 p-4 text-sm text-cacao">
            <strong className="block font-display text-base text-selva-2">
              Ya publicaste hoy
            </strong>
            Es una publicación al día por cuenta, para que el muro no se llene.
            Mañana puedes volver a publicar.
          </p>
        ) : esNegocio && !puedePublicar ? (
          <p className="rounded-2xl border-2 border-mango/50 bg-mango/15 p-4 text-sm text-cacao">
            <strong className="block font-display text-base text-selva-2">
              Publica tu micrositio primero
            </strong>
            Una publicación va firmada por una de tus sucursales, y todavía no
            tienes ninguna en el directorio.
          </p>
        ) : puedePublicar ? (
          <FormularioTema
            sucursales={publicadas}
            inicial={(perfil.nombre ?? "?").charAt(0).toUpperCase()}
          />
        ) : null}

        {deHoy && (
          <section className="pt-6">
            <h2 className="pb-2 font-display text-lg">Tu publicación de hoy</h2>
            <MiPublicacion entrada={deHoy} />
          </section>
        )}

        <section className="pt-5">
          <MuroComunidad
            iniciales={primerTramo.entradas}
            cursorInicial={primerTramo.siguiente}
            haySesion={Boolean(perfil)}
            origen={origen}
          />
        </section>
      </div>
    </>
  );
}
