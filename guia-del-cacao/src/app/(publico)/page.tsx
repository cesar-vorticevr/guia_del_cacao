import Link from "next/link";
import { EscudoDeMarca } from "@/components/marca";
import { BannerRotativo } from "@/components/publico/banner-rotativo";
import { BuscadorPortada } from "@/components/publico/buscador-portada";
import { EscenarioDePortada } from "@/components/publico/escenario-portada";
import { Marcador } from "@/components/publico/marcador";
import { TarjetaPublicacion } from "@/components/publico/tarjeta-publicacion";
import { TarjetaEntrada } from "@/components/publico/tarjeta-entrada";
import { TarjetaSucursal } from "@/components/publico/tarjeta-sucursal";
import {
  bannersDePortada,
  calificacionesDe,
  listarDirectorio,
  listarEventos,
  nombrarNegocio,
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

  const entidades = new Set(sucursales.map((s) => s.entidad).filter(Boolean)).size;

  // La cinta lleva los negocios y, entre ellos, las categorías: así no se
  // queda corta cuando el directorio todavía tiene pocos.
  const cinta = [
    ...sucursales.slice(0, 12).map((s) => {
      const nombres = nombrarNegocio(s);
      return nombres.marca ?? s.nombre_sucursal;
    }),
    ...categorias.map((c) => c.nombre),
  ];

  return (
    <div className="pb-4">
      {/*
        La portada abre con el escenario: una banda oscura de orilla a orilla
        con el vórtice de destellos, los focos de marquesina y las mazorcas
        flotando (ver `escenario-portada.tsx`). Lo de dentro es lo de siempre
        —escudo, pregunta, buscador y categorías—, ahora encendido.
      */}
      <EscenarioDePortada>
        <EscudoDeMarca className="mx-auto size-28 animate-flota drop-shadow-[0_0_30px_rgba(255,183,3,0.55)] sm:size-36" />

        <h1 className="mx-auto mt-4 max-w-4xl text-balance font-display text-5xl font-medium leading-[1.05] tracking-tight text-crema sm:text-7xl">
          El <em className="texto-oro pr-1">cacao</em> de México, en un solo
          lugar
        </h1>

        <p className="mx-auto mt-4 max-w-2xl text-pretty text-lg text-crema/80">
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
          Las categorías van pegadas al buscador: son el atajo de quien todavía
          no sabe qué escribir. Aquí son fichas de casino, cada una con su
          color, y envuelven en varios renglones en vez de irse a un carril
          horizontal: en celular lo que no se ve, no existe.
        */}
        <nav aria-label="Categorías" className="mt-7">
          <ul className="flex flex-wrap justify-center gap-3">
            {categorias.map((categoria) => (
              <li key={categoria.id}>
                <Link
                  href={`/directorio?categoria=${categoria.id}`}
                  className={`ficha block rounded-full px-5 py-2.5 text-sm font-bold ${
                    tonoDeCategoria(categoria.id).solido
                  }`}
                >
                  {categoria.nombre}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/*
          El marcador: cuánto hay ya en la guía, corriendo desde cero al entrar
          en pantalla. Un número que se mueve invita a mirar qué hay, y además
          es verdad: sale de lo mismo que se pinta abajo. Los que están en cero
          no salen: un «0 eventos» en la entrada se lee como sitio vacío.
        */}
        <dl className="mx-auto mt-10 flex max-w-xl justify-center gap-3">
          {[
            {
              valor: sucursales.length,
              texto: sucursales.length === 1 ? "negocio" : "negocios",
            },
            {
              valor: eventos.proximos.length,
              texto: eventos.proximos.length === 1 ? "evento próximo" : "eventos próximos",
            },
            { valor: entidades, texto: entidades === 1 ? "estado" : "estados" },
          ]
            .filter((dato) => dato.valor > 0)
            .map((dato) => (
            <div
              key={dato.texto}
              className="flex flex-1 flex-col-reverse rounded-2xl border border-mango/30 bg-white/5 px-2 py-3 backdrop-blur-sm"
            >
              <dt className="text-xs font-bold uppercase tracking-wider text-crema/70">
                {dato.texto}
              </dt>
              <dd className="font-display text-3xl font-bold text-mango drop-shadow-[0_0_12px_rgba(255,183,3,0.6)] sm:text-4xl">
                <Marcador valor={dato.valor} />
              </dd>
            </div>
          ))}
        </dl>
      </EscenarioDePortada>

      {/*
        La cinta: negocios y categorías corriendo de lado, en itálica dorada
        sobre una franja de cristal. Va duplicada para que la vuelta no se note
        —la animación recorre la mitad y empieza otra vez—. Es decoración: los
        mismos nombres están en las tarjetas de abajo.
      */}
      <div
        aria-hidden
        className="relative left-1/2 w-[104vw] -translate-x-1/2 overflow-hidden border-y border-mango/20 bg-black/20 py-4 backdrop-blur-sm"
      >
        <div className="cinta flex w-max whitespace-nowrap font-display text-2xl italic text-crema/85">
          {[...cinta, ...cinta].map((texto, i) => (
            <span key={i} className="flex items-center gap-8 pr-8">
              {texto}
              <span className="not-italic text-mango drop-shadow-[0_0_8px_rgba(255,183,3,0.8)]">
                ✦
              </span>
            </span>
          ))}
        </div>
      </div>

      {/*
        Destacados, de orilla a orilla: la foto ocupa la pantalla entera y el
        texto va encima, sobre un velo oscuro. Es el escaparate de los planes
        altos, así que se le da el ancho completo, como a la portada de una
        película.
      */}
      {diapositivas.length > 0 && (
        <section className="pt-20">
          <Encabezado
            antetitulo="Destacados"
            titulo={
              <>
                Lugares que <em className="texto-oro">hay que</em> conocer
              </>
            }
          />
          <div className="relative left-1/2 mt-8 w-[104vw] -translate-x-1/2">
            <BannerRotativo diapositivas={diapositivas} />
          </div>
        </section>
      )}

      <section className="pt-24">
        <Encabezado
          antetitulo="El directorio"
          titulo={
            <>
              Negocios que te <em className="texto-oro">esperan</em>
            </>
          }
          texto="Fincas, chocolaterías, museos y talleres de todo México."
        />

        {sucursales.length === 0 ? (
          <p className="caja-vacia mx-auto mt-8 max-w-xl rounded-3xl p-6 text-center">
            Todavía no hay micrositios publicados. Si tienes un negocio de cacao,{" "}
            <Link href="/registro/negocio" className="font-bold underline">
              este es buen momento para ser el primero
            </Link>
            .
          </p>
        ) : (
          <>
            <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
              que se hace al terminar de mirar.
            */}
            <BotonDeOro href="/directorio">Ver todo el directorio</BotonDeOro>
          </>
        )}
      </section>

      {/*
        Los eventos van después del directorio porque responden a otra pregunta
        —qué hacer este fin de semana, no a quién visitar— y solo los próximos:
        lo que ya pasó vive en `/eventos`.
      */}
      <section className="pt-24">
        <Encabezado
          antetitulo="La agenda"
          titulo={
            <>
              Lo que <em className="texto-oro">viene</em>
            </>
          }
          texto="Catas, talleres y festivales para apartar en el calendario."
        />

        {eventos.proximos.length === 0 ? (
          <p className="caja-vacia mx-auto mt-8 max-w-xl rounded-3xl p-6 text-center">
            No hay eventos programados por ahora.{" "}
            <Link href="/eventos" className="font-bold underline">
              Mira los que ya pasaron
            </Link>
            .
          </p>
        ) : (
          <>
            <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {eventos.proximos.slice(0, 4).map((evento) => (
                <TarjetaPublicacion
                  key={evento.id}
                  publicacion={evento}
                  haySesion={Boolean(perfil)}
                  tipo="evento"
                />
              ))}
            </ul>

            <BotonDeOro href="/eventos">Ver todos los eventos</BotonDeOro>
          </>
        )}
      </section>

      {/*
        La comunidad cierra, y se pinta solo si hay algo publicado. Un título
        sobre una caja que dice «todavía no hay nada» es peor que no tener la
        sección: en la portada un hueco se lee como sitio abandonado.
      */}
      {FUNCIONES.comunidad && muro.entradas.length > 0 && (
        <section className="pt-24">
          <Encabezado
            antetitulo="La comunidad"
            titulo={
              <>
                Lo que se <em className="texto-oro">cuenta</em>
              </>
            }
            texto="Lo que cuentan los negocios y quienes los visitan."
          />

          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {muro.entradas.slice(0, 4).map((entrada) => (
              <TarjetaEntrada
                key={entrada.id}
                entrada={entrada}
                haySesion={Boolean(perfil)}
              />
            ))}
          </ul>

          <BotonDeOro href="/comunidad">Ver la comunidad</BotonDeOro>
        </section>
      )}
    </div>
  );
}

/**
 * El encabezado de cada sección de la portada: la etiqueta dorada encima, el
 * título en Fraunces con su palabra en itálica de oro, y una línea que invita.
 * Centrado, como el título de un capítulo.
 */
function Encabezado({
  antetitulo,
  titulo,
  texto,
}: {
  antetitulo: string;
  titulo: React.ReactNode;
  texto?: string;
}) {
  return (
    <header className="mx-auto max-w-2xl text-center">
      <p className="antetitulo">{antetitulo}</p>
      <h2 className="mt-3 text-balance font-display text-4xl font-medium leading-tight tracking-tight sm:text-5xl">
        {titulo}
      </h2>
      {texto && <p className="mt-3 text-pretty text-lg text-crema/70">{texto}</p>}
    </header>
  );
}

/** El botón que cierra cada sección, centrado y en oro. */
function BotonDeOro({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <div className="mt-10 text-center">
      <Link
        href={href}
        className="boton-oro brillo inline-flex min-h-12 items-center gap-2 rounded-full px-7 py-3 font-bold text-ink"
      >
        {children}
        <span aria-hidden>→</span>
      </Link>
    </div>
  );
}
