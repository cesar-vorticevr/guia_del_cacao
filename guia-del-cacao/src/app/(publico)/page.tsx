import Link from "next/link";
import { EscudoDeMarca } from "@/components/marca";
import { BannerRotativo } from "@/components/publico/banner-rotativo";
import { BuscadorPortada } from "@/components/publico/buscador-portada";
import { FondoDeCacao } from "@/components/publico/fondo-cacao";
import { TarjetaPublicacion } from "@/components/publico/tarjeta-publicacion";
import { TarjetaEntrada } from "@/components/publico/tarjeta-entrada";
import { TarjetaSucursal } from "@/components/publico/tarjeta-sucursal";
import {
  bannersDePortada,
  calificacionesDe,
  listarDirectorio,
  listarEventos,
} from "@/lib/datos/publico";
import { listarCategorias } from "@/lib/datos/categorias";
import { muroDeComunidad } from "@/lib/datos/comunidad";
import { FUNCIONES } from "@/lib/funciones";
import { misFavoritosEntre } from "@/lib/datos/favoritos";
import { catalogoPorMarca } from "@/lib/datos/busqueda-de-productos";
import { perfilActual } from "@/lib/auth/sesion";
import { tonoDeCategoria } from "@/lib/paleta";
import { urlImagen } from "@/lib/imagenes";

export default async function Home() {
  // El perfil va primero porque lo necesitan los eventos —para saber a cuáles
  // ya les dio corazón quien mira— y los favoritos del directorio.
  const perfil = await perfilActual();

  const [banners, sucursales, categorias, eventos, muro] = await Promise.all([
    bannersDePortada(),
    listarDirectorio(),
    listarCategorias(),
    listarEventos(perfil?.id),
    /*
      El primer tramo del muro, que ya viene de diez en diez con su cursor.
      Se piden los de siempre y se ensenan cuatro: no hay consulta aparte para
      la portada, y asi lo que se ve aqui es exactamente lo que se vera al
      entrar a la comunidad.

      Si la comunidad estuviera apagada no se consulta nada: la seccion no se
      pinta, y pedir el muro para tirarlo seria trabajo para la nada.
    */
    FUNCIONES.comunidad
      ? muroDeComunidad(perfil?.id)
      : Promise.resolve({ entradas: [], siguiente: null }),
  ]);

  // Solo un cliente guarda favoritos. A un negocio o a un administrador el
  // corazón les prometería algo que su cuenta no hace.
  const esCliente = perfil?.rol === "cliente" && perfil.rol_confirmado;
  const [favoritos, catalogo] = await Promise.all([
    misFavoritosEntre(esCliente ? perfil.id : undefined, sucursales.map((s) => s.id)),
    // El catálogo viaja a la página para que el buscador sugiera por producto
    // sin ir al servidor por cada letra.
    catalogoPorMarca(sucursales.map((s) => s.marca_id)),
  ]);

  // Los promedios de todo el banner en una sola consulta, no una por foto.
  const promedios = await calificacionesDe(banners.map((b) => b.id));

  const diapositivas = banners.map((b) => ({
    slug: b.slug,
    nombre: b.nombre,
    sucursal: b.sucursal,
    imagen: urlImagen(b.imagen),
    texto: b.texto,
    calificacion: promedios.get(b.id) ?? null,
  }));

  const nombresDeCategoria = Object.fromEntries(
    categorias.map((c) => [c.id, c.nombre]),
  );

  return (
    <>
      {/*
        El encabezado va sobre el crema, sin caja de color. Enmarcarlo en un
        rectángulo de mango lo convertía en un cartel, y un cartel se salta con
        la vista; suelto sobre el fondo, lo primero que se ve es la pregunta y
        el sitio se lee más limpio. El color de la marca no se pierde: lo ponen
        las píldoras de categoría, que además son navegación y no adorno.
      */}
      <section className="relative px-2 pb-4 pt-8 text-center sm:pt-14">
        {/*
          Las ilustraciones de cacao vivían solo en la franja del directorio, al
          final de la página. Arriba —lo único que ve quien llega— no había ni
          una mazorca: en un directorio de chocolate, la primera pantalla era
          texto sobre crema. Aquí no hacen falta archivos nuevos, son las
          mismas ocho de `public/parallax`.

          La sección lleva `relative` pero **no** `overflow-hidden`: la capa se
          recorta sola, y recortar aquí se comería el desplegable de
          sugerencias del buscador, que cuelga por debajo de su caja.
        */}
        <FondoDeCacao variante="franja" soloOrillas />

        <div className="relative z-10">
          {/*
            El escudo abre la portada. Sin él, la primera pantalla era texto
            verde sobre crema y la marca solo aparecía en 28 px arriba, dentro
            de la barra: aquí es lo que dice de qué va esto antes de leer nada.
          */}
          <EscudoDeMarca className="mx-auto size-28 sm:size-36" />

          <h1 className="mx-auto mt-3 max-w-3xl text-balance font-display text-4xl leading-tight text-selva-2 sm:text-6xl">
            El cacao de México, en un solo lugar
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-pretty text-lg text-cacao">
            Productoras, chocolaterías, museos y talleres. Encuentra a quién
            visitar y qué está pasando cerca de ti.
          </p>

          {/*
          El buscador sugiere sobre este mismo directorio, el que ya se trajo
          para las tarjetas de abajo. Por eso las sugerencias no cuestan una
          consulta por letra: los datos ya estaban en la página.
        */}
          <BuscadorPortada
            sucursales={sucursales}
            categorias={nombresDeCategoria}
            catalogo={catalogo}
          />

          {/*
          Las categorías van pegadas al buscador, como el "Try asking" de las
          guías de viaje: son el atajo de quien todavía no sabe qué escribir.
          Envuelven en varios renglones en vez de irse a un carril horizontal —
          en celular lo que no se ve, no existe.
        */}
          <nav aria-label="Categorías" className="mt-6">
            <ul className="flex flex-wrap justify-center gap-2.5">
              {categorias.map((categoria) => (
                <li key={categoria.id}>
                  <Link
                    href={`/directorio?categoria=${categoria.id}`}
                    className={`block rounded-full border-2 border-ink/10 px-4 py-2 text-sm font-bold shadow-dura-sm transition-transform active:translate-y-0.5 ${
                      tonoDeCategoria(categoria.id).solido
                    }`}
                  >
                    {categoria.nombre}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </section>

      {/*
        Antes esto empezaba a los 713 px con la pantalla en 698: el primer
        negocio caía justo por debajo del pliegue, así que la primera pantalla
        entera era encabezado y filtros, sin un solo negocio a la vista. Con el
        aire de arriba recortado, asoma el borde de la primera tarjeta, que es
        lo que le dice a alguien que hay algo más abajo.
      */}
      <section className="pt-8">
        <h2 className="mb-4 font-display text-2xl">Destacados</h2>
        <BannerRotativo diapositivas={diapositivas} />
      </section>

      {/*
        La franja del directorio, de orilla a orilla.

        Era una caja redondeada dentro de la columna de contenido, y su
        `overflow-hidden` —que hace falta para recortar el fondo— volvía a
        encerrar las piezas en 1180 px: el fondo se paraba donde acababa la
        caja, no donde acaba la pantalla.

        Ahora la sección misma se sale de la columna con sangrado completo
        —`left-1/2`, `w-screen`, `-translate-x-1/2`— y el recorte pasa a ser en
        el borde de la pantalla, que es donde tiene que estar. Las esquinas
        redondeadas se van con eso: una banda que toca las dos orillas no tiene
        esquinas que redondear.

        El contenido sigue en la columna, con su propia caja centrada dentro.

        El ancho es `104vw` y no `100vw` a proposito: `100vw` cuenta la barra de
        scroll vertical y el area de contenido no, asi que una banda centrada de
        exactamente `100vw` se queda unos pixeles corta de un lado y deja una
        rendija de crema distinto en la orilla. Con holgura tapa de sobra, y el
        `overflow-x: clip` del armazon recorta lo que sale sin abrir barra
        horizontal.
      */}
      <section className="relative left-1/2 mt-14 w-[104vw] -translate-x-1/2 overflow-hidden bg-crema-2/60 py-10">
        <FondoDeCacao variante="franja" />

        <div className="relative z-10 mx-auto w-[92vw] max-w-[1180px]">
          <h2 className="font-display text-2xl">En el directorio</h2>

          {sucursales.length === 0 ? (
            <p className="mt-4 rounded-3xl bg-crema p-6 text-cacao">
              Todavía no hay micrositios publicados. Si tienes un negocio de
              cacao,{" "}
              <Link
                href="/registro/negocio"
                className="font-bold text-selva underline"
              >
                este es buen momento para ser el primero
              </Link>
              .
            </p>
          ) : (
            <>
              <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {sucursales.slice(0, 6).map((sucursal) => (
                  <TarjetaSucursal
                    key={sucursal.id}
                    sucursal={sucursal}
                    favorito={favoritos.has(sucursal.id)}
                    puedeGuardar={esCliente}
                    haySesion={Boolean(perfil)}
                  />
                ))}
              </ul>

              {/*
                "Ver todo" va después de las tarjetas, no junto al título: es lo
                que se hace al terminar de mirar, y arriba competía con el
                encabezado de la sección antes de que hubiera nada que ampliar.
              */}
              <Link
                href="/directorio"
                className="mt-6 inline-flex min-h-12 items-center rounded-full bg-selva px-6 py-3 font-bold text-crema shadow-dura-sm transition-transform active:translate-y-0.5"
              >
                Ver todo el directorio
              </Link>
            </>
          )}
        </div>
      </section>

      {/*
        Los eventos cierran la portada. Van después del directorio porque
        responden a otra pregunta —qué hacer este fin de semana, no a quién
        visitar— y solo los próximos: lo que ya pasó vive en `/eventos`.
      */}
      <section className="pt-14">
        <h2 className="font-display text-2xl">Próximos eventos</h2>

        {eventos.proximos.length === 0 ? (
          <p className="mt-4 rounded-3xl bg-crema-2 p-6 text-cacao">
            No hay eventos programados por ahora.{" "}
            <Link href="/eventos" className="font-bold text-selva underline">
              Mira los que ya pasaron
            </Link>
            .
          </p>
        ) : (
          <>
            <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {eventos.proximos.slice(0, 4).map((evento) => (
                <TarjetaPublicacion
                  key={evento.id}
                  publicacion={evento}
                  haySesion={Boolean(perfil)}
                  tipo="evento"
                />
              ))}
            </ul>

            <Link
              href="/eventos"
              className="mt-6 inline-flex min-h-12 items-center rounded-full bg-selva px-6 py-3 font-bold text-crema shadow-dura-sm transition-transform active:translate-y-0.5"
            >
              Ver todos los eventos
            </Link>
          </>
        )}
      </section>

      {/*
        Y la comunidad cierra, en su propia franja de orilla a orilla con el
        fondo de cacao detras — la segunda de la portada, igual que la del
        directorio. Las dos bandas reparten la pagina en tres tramos y dejan los
        eventos respirando en medio, sobre el crema limpio.

        El `104vw` y el `overflow-hidden` no son de adorno: `100vw` cuenta la
        barra de scroll y el area de contenido no, asi que una banda de
        exactamente `100vw` deja una rendija de crema distinto en la orilla.

        Se pinta solo si hay algo publicado. Un titulo sobre una caja que dice
        'todavia no hay nada' es peor que no tener la seccion: la portada es lo
        primero que ve alguien, y ahi un hueco se lee como sitio abandonado.
      */}
      {FUNCIONES.comunidad && muro.entradas.length > 0 && (
        <section className="relative left-1/2 mt-14 w-[104vw] -translate-x-1/2 overflow-hidden bg-crema-2/60 py-10">
          <FondoDeCacao variante="franja" />

          <div className="relative z-10 mx-auto w-[92vw] max-w-[1180px]">
            <h2 className="font-display text-2xl">En la comunidad</h2>
            <p className="mt-1 text-cacao">
              Lo que cuentan los negocios y quienes los visitan.
            </p>

            <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {muro.entradas.slice(0, 4).map((entrada) => (
                <TarjetaEntrada
                  key={entrada.id}
                  entrada={entrada}
                  haySesion={Boolean(perfil)}
                />
              ))}
            </ul>

            <Link
              href="/comunidad"
              className="mt-6 inline-flex min-h-12 items-center rounded-full bg-selva px-6 py-3 font-bold text-crema shadow-dura-sm transition-transform active:translate-y-0.5"
            >
              Ver la comunidad
            </Link>
          </div>
        </section>
      )}
    </>
  );
}
