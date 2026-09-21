import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { FormularioResena } from "@/components/publico/resenas";
import { ListaResenas } from "@/components/publico/lista-resenas";
import { Estrellas, Promedio } from "@/components/publico/estrellas";
import { Galeria } from "@/components/publico/galeria";
import {
  agendaDe,
  calificacionDe,
  miResena,
  estrellasPorUsuario,
  miCalificacion,
  micrositioPorSlug,
  resenasDe,
} from "@/lib/datos/publico";
import { TarjetaPublicacion } from "@/components/publico/tarjeta-publicacion";
import { PortadaAmpliable } from "@/components/publico/portada-ampliable";
import { CatalogoPublico } from "@/components/publico/catalogo-publico";
import { DescargarCatalogo } from "@/components/publico/descargar-catalogo";
import { BotonFavorito } from "@/components/publico/boton-favorito";
import { BotonCompartir } from "@/components/publico/boton-compartir";
import { esFavorito } from "@/lib/datos/favoritos";
import { productosDe } from "@/lib/datos/sucursales";
import { tienePendienteEn } from "@/lib/datos/puntos";
import { origenDelSitio, perfilActual } from "@/lib/auth/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { BUCKET_RESENAS, urlImagen } from "@/lib/imagenes";
import { listaDeContacto } from "@/lib/redes";
import { tarjetaSocial } from "@/lib/compartir";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const sucursal = await micrositioPorSlug(slug);

  if (!sucursal) return { title: "No encontrado · Guía del Cacao" };

  const marca = sucursal.marcas?.nombre_comercial ?? sucursal.nombre_sucursal;

  /*
    La portada antes que el logotipo: es una foto de la finca o del mostrador, y
    es lo que hace que alguien abra el enlace. El logotipo llena mejor un
    recuadro pequeño, pero en una tarjeta de 1200×630 se ve como un sello.
  */
  return tarjetaSocial({
    titulo: marca,
    descripcion:
      sucursal.acerca_de ??
      `${sucursal.nombre_sucursal}, en ${[sucursal.ciudad, sucursal.entidad].filter(Boolean).join(", ")}.`,
    imagen: urlImagen(sucursal.imagen_fondo) ?? urlImagen(sucursal.logo),
    ruta: `/marca/${slug}`,
  });
}

const CUANDO = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export default async function Micrositio({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const sucursal = await micrositioPorSlug(slug);

  // Un micrositio en borrador o en revisión no existe para el público, igual
  // que uno inventado: la misma respuesta para no delatar cuáles hay.
  if (!sucursal) notFound();

  // Sale de la bandera del plan y no de comparar `tier_id >= 2`: cuál es el
  // primer plan que trae reseñas es un dato de la tabla `tiers`.
  const aceptaResenas = sucursal.tiers?.permite_resenas ?? false;

  const [productos, resenas, perfil, calificacion, agenda, origen] =
    await Promise.all([
      productosDe(sucursal.id),
      resenasDe(sucursal.id),
      perfilActual(),
      calificacionDe(sucursal.id),
      agendaDe(sucursal.id),
      // Para el pie del PDF: una hoja impresa tiene que saber decir de dónde
      // salió y adónde volver.
      origenDelSitio(),
    ]);

  // El voto y el comentario viven en tablas distintas; esto es lo que los une
  // para poder enseñar las estrellas al lado de cada reseña y filtrar por ellas.
  const estrellas = await estrellasPorUsuario(sucursal.id);

  // Qué le toca ver a un cliente —reseñas y mazorcas— depende de cosas que solo
  // se pueden preguntar una vez que se sabe quién es.
  let misEstrellas: number | null = null;
  let resenaPropia: Awaited<ReturnType<typeof miResena>> = null;
  let tienePendiente = false;
  let guardado = false;

  if (perfil?.rol === "cliente" && perfil.rol_confirmado) {
    [misEstrellas, resenaPropia, tienePendiente, guardado] = await Promise.all([
      miCalificacion(perfil.id, sucursal.id),
      miResena(perfil.id, sucursal.id),
      tienePendienteEn(perfil.id, sucursal.id),
      esFavorito(perfil.id, sucursal.id),
    ]);
  }

  // Un Tier 1 no reparte monedas, así que enseñarle el botón al cliente sería
  // mandarlo a una pantalla que solo puede decirle que no.
  const supabaseTier = await crearClienteServidor();
  const { data: tier } = await supabaseTier
    .from("tiers")
    .select("puede_dar_puntos")
    .eq("id", sucursal.tier_id ?? 0)
    .maybeSingle();

  // Un Tier 1 no reparte monedas, y una cuenta de negocio o de administrador
  // no las junta: enseñarles el botón sería mandarlos a una pantalla que solo
  // puede decirles que no. A quien no ha entrado sí se le enseña, porque para
  // esa persona el botón es la invitación a registrarse.
  const daMazorcas =
    Boolean(tier?.puede_dar_puntos) && (!perfil || perfil.rol === "cliente");

  // Para decidir si se muestra el cuadro de respuesta hay que preguntar si la
  // marca de esta sucursal es suya. RLS no sirve de filtro aquí: el micrositio
  // es público y cualquiera lo puede leer.
  let esDuenio = false;

  if (perfil?.rol === "negocio") {
    const supabase = await crearClienteServidor();

    const { data } = await supabase
      .from("marcas")
      .select("id")
      .eq("id", sucursal.marca_id)
      .eq("perfil_id", perfil.id)
      .maybeSingle();

    esDuenio = data !== null;
  }

  const fondo = urlImagen(sucursal.imagen_fondo);
  const logo = urlImagen(sucursal.logo);

  /*
    Los datos de contacto, ya resueltos a enlaces. Los usan dos cosas: la
    sección de abajo, para saber si tiene algo que enseñar, y el PDF del
    catálogo, que se los lleva impresos.

    Se pregunta por el enlace y no por el campo: un campo con "@" a secas no da
    ningún botón, y la sección saldría con el título sobre el vacío.
  */
  const contacto = listaDeContacto(sucursal);
  const hayContacto = contacto.length > 0;

  // El mapa se aparta del resto: es un botón, no un dato que se lea.
  const comoLlegar = contacto.find((dato) => dato.clave === "maps");
  const datosDeContacto = contacto.filter((dato) => dato.clave !== "maps");

  return (
    <>
      <header className="pt-4">
        {/*
          La portada se abre al tocarla. Recortada a la altura de la cabecera
          se ve una franja de la finca o del mostrador, y esa foto es justo lo
          que alguien mira antes de decidir si va hasta allá.
        */}
        {fondo ? (
          <PortadaAmpliable
            foto={fondo}
            negocio={sucursal.marcas?.nombre_comercial ?? sucursal.nombre_sucursal}
          />
        ) : (
          <div className="h-40 rounded-3xl bg-cacao sm:h-56" role="presentation" />
        )}

        <div className="-mt-10 flex items-end gap-4 px-4">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logo}
              alt=""
              className="size-24 rounded-3xl border-4 border-crema bg-white object-cover"
            />
          ) : (
            <span
              aria-hidden="true"
              className="grid size-24 place-items-center rounded-3xl border-4 border-crema bg-crema-2 font-display text-4xl text-selva/50"
            >
              {sucursal.nombre_sucursal.charAt(0)}
            </span>
          )}
        </div>

        <div className="px-4 pt-3">
          {/*
            El corazón va junto al nombre y no flotando sobre la portada: aquí
            ya se entró al negocio, así que guardarlo es una decisión, no un
            gesto de paso, y merece estar donde se lee quién es.
          */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="font-display text-3xl">
                {sucursal.marcas?.nombre_comercial}
              </h1>
              <p className="mt-1 text-cacao">{sucursal.nombre_sucursal}</p>
            </div>

            <BotonFavorito
              sucursalId={sucursal.id}
              nombre={sucursal.marcas?.nombre_comercial ?? sucursal.nombre_sucursal}
              inicial={guardado}
              puedeGuardar={perfil?.rol === "cliente" && perfil.rol_confirmado}
              haySesion={Boolean(perfil)}
            />
          </div>

          {/* Las estrellas son decorativas; lo que lee un lector de pantalla
              es el número que va al lado, que dice lo mismo con palabras. */}
          {calificacion && (
            <p className="mt-2 flex flex-wrap items-center gap-2">
              <Estrellas valor={calificacion.promedio} />
              <span className="font-mono text-lg font-bold text-cacao">
                {calificacion.promedio.toFixed(1)}
              </span>
              <span className="text-sm text-cacao/70">
                de 5 · {calificacion.total}{" "}
                {calificacion.total === 1 ? "calificación" : "calificaciones"}
              </span>
            </p>
          )}

          {/*
            Compartir va en su propio renglón y no junto al corazón: en
            escritorio son cuatro botones —WhatsApp, Facebook, X y copiar— y
            apretados contra el nombre del negocio no caben.
          */}
          <div className="mt-3">
            <BotonCompartir
              url={`${origen}/marca/${slug}`}
              titulo={
                sucursal.marcas?.nombre_comercial ?? sucursal.nombre_sucursal
              }
            />
          </div>
        </div>
      </header>

      {/*
        El botón de las mazorcas va aquí arriba, antes de acerca de y del
        catálogo: es lo que la persona viene a hacer cuando ya está parada en el
        mostrador, y buscarlo hasta el final del micrositio no tiene sentido.
        Va en mango sobre el fondo crema para que se despegue de todo lo demás.
      */}
      {daMazorcas && (
        <section className="px-4 pt-6">
          {tienePendiente ? (
            <p
              role="status"
              className="rounded-3xl border-2 border-turquesa/40 bg-turquesa/15 p-5 text-cacao"
            >
              <strong className="block font-display text-lg text-selva-2">
                Tus mazorcas están pendientes aquí
              </strong>
              El negocio todavía no resuelve tu solicitud. En cuanto lo haga lo
              verás en{" "}
              <Link href="/cuenta" className="font-bold text-selva underline">
                tu cuenta
              </Link>
              .
            </p>
          ) : (
            <Link
              href={`/monedas/${slug}`}
              className="flex min-h-16 items-center justify-between gap-4 rounded-3xl border-2 border-ink/10 bg-mango px-6 py-4 shadow-dura transition-transform active:translate-y-0.5"
            >
              <span>
                <span className="block font-display text-xl font-semibold text-ink">
                  Pedir mis mazorcas de cacao
                </span>
                <span className="block text-sm text-cacao">
                  Dinos qué compraste y el negocio te las abona.
                </span>
              </span>
              <span
                aria-hidden="true"
                className="shrink-0 font-display text-2xl text-ink"
              >
                →
              </span>
            </Link>
          )}
        </section>
      )}

      {sucursal.acerca_de && (
        <section className="px-4 pt-6">
          <h2 className="font-display text-xl">Acerca de</h2>
          <p className="mt-2 max-w-prose whitespace-pre-line text-cacao">
            {sucursal.acerca_de}
          </p>
        </section>
      )}

      {sucursal.galeria.length > 0 && (
        <section className="pt-6">
          <h2 className="px-4 font-display text-xl">Fotos</h2>
          <Galeria
            fotos={sucursal.galeria.map((ruta) => urlImagen(ruta) ?? "")}
          />
        </section>
      )}

      {productos.length > 0 && (
        <section className="px-4 pt-6">
          {/*
            El botón del PDF va junto al encabezado y no al final de la
            cuadrícula: quien quiere la lista de precios para llevársela lo
            decide al ver que hay catálogo, no después de bajar por los
            cuarenta productos.

            Y sale solo si el negocio lo dejó encendido (migración 000048). La
            decisión se respeta aquí, en el servidor, y no escondiendo el botón
            con CSS: apagado, el componente no se dibuja y su código no viaja.
          */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-xl">Catálogo</h2>

            {sucursal.catalogo_descargable && (
              <DescargarCatalogo
                datos={{
                  marca:
                    sucursal.marcas?.nombre_comercial ?? sucursal.nombre_sucursal,
                  sucursal: sucursal.nombre_sucursal,
                  lugar: [sucursal.ciudad, sucursal.entidad]
                    .filter(Boolean)
                    .join(", ") || null,
                  logo,
                  url: `${origen.replace(/^https?:\/\//, "")}/marca/${slug}`,
                  contacto,
                  productos: productos.map((producto) => ({
                    id: producto.id,
                    nombre: producto.nombre,
                    descripcion: producto.descripcion,
                    precio: producto.precio,
                    foto: urlImagen(producto.imagen) ?? null,
                  })),
                }}
              />
            )}
          </div>

          {/*
            Las URLs se arman aquí, en el servidor: el catálogo es de cliente
            —abre el visor— y un componente de cliente que importara
            `urlImagen` se traería con él el cliente de Supabase de servidor.
          */}
          <CatalogoPublico
            productos={productos.map((producto) => ({
              id: producto.id,
              nombre: producto.nombre,
              descripcion: producto.descripcion,
              precio: producto.precio,
              foto: urlImagen(producto.imagen) ?? null,
            }))}
          />
        </section>
      )}

      {/*
        Lo que el negocio anuncia hoy: **sus eventos, y nada más**. Un evento
        que ya pasó se cae solo, porque el micrositio no es un archivo.

        Aquí había también "Noticias recientes". Se fue: lo que un negocio
        escribe vive en la comunidad, junto a lo que escribe todo el mundo, y
        repetirlo en su ficha hacía que la misma publicación se leyera dos
        veces. No se borra nada — sigue en /comunidad y en su propia página.
      */}
      {agenda.eventos.length > 0 && (
        <section className="px-4 pt-6">
          <h2 className="font-display text-xl">Próximos eventos</h2>
          <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {agenda.eventos.map((evento) => (
              <TarjetaPublicacion
                key={evento.id}
                publicacion={evento}
                tipo="evento"
              />
            ))}
          </ul>
        </section>
      )}

      {/* Sin ningún dato de contacto, el encabezado solo, sobre el vacío, se ve
          como un error. Mejor no dibujar la sección. */}
      {hayContacto && (
        <section className="px-4 pt-6">
          <h2 className="font-display text-xl">Contacto</h2>

          {/*
            "Cómo llegar" sigue siendo un botón y no una tarjeta con su dato:
            un enlace de Maps no tiene nada legible que enseñar —nadie teclea
            `maps.app.goo.gl/x7Yk2`— y además es la acción que más se pulsa,
            así que se queda arriba y en verde pleno.
          */}
          {comoLlegar && (
            <a
              href={comoLlegar.enlace}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 flex min-h-12 w-full items-center justify-between gap-3 rounded-full bg-selva px-5 py-2.5 font-bold text-crema shadow-dura sm:w-auto sm:min-w-64"
            >
              Cómo llegar
              <span aria-hidden="true" className="font-display text-lg">
                →
              </span>
            </a>
          )}

          {/*
            Lo demás se enseña **con el dato a la vista**. Eran pastillas con la
            etiqueta sola —"Correo", "WhatsApp"— y el dato solo estaba en el
            `href`: quien mira esto en la computadora para copiar la dirección y
            escribir desde su correo de siempre, o quien lo apunta en un papel,
            se quedaba sin nada. Un `mailto:` no se puede leer.

            La etiqueta va arriba y el dato debajo, no en el mismo renglón: un
            correo largo en dos columnas no cabe al lado de su etiqueta, y
            partido a la mitad deja de poder copiarse de un vistazo.
          */}
          {datosDeContacto.length > 0 && (
            <ul className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {datosDeContacto.map((dato) => {
                // `tel:` y `mailto:` los abre la propia máquina; una pestaña
                // nueva para ellos deja un hueco en blanco que nadie cierra.
                const fuera = dato.enlace.startsWith("http");

                return (
                  <li key={dato.clave}>
                    <a
                      href={dato.enlace}
                      {...(fuera && {
                        target: "_blank",
                        rel: "noopener noreferrer",
                      })}
                      className="block min-h-14 rounded-2xl border-2 border-ink/10 bg-white px-4 py-2.5 shadow-dura-sm transition-transform active:translate-y-0.5"
                    >
                      <span className="block text-sm font-bold text-selva-2">
                        {dato.etiqueta}
                      </span>
                      {/*
                        `break-all` y no `truncate`: un correo cortado con
                        puntos suspensivos es un correo que ya no sirve.
                      */}
                      <span className="block break-all font-mono text-sm text-cacao">
                        {dato.texto}
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {/*
        Las reseñas son la función del plan Plus. En un Básico la sección no
        existe: ni el listado ni el formulario ni el promedio (spec v2 §5.4).
        No es solo esconder el formulario —la base también rechaza el insert—,
        pero enseñar "Todavía nadie ha dejado una reseña" en un micrositio donde
        nadie puede dejarla sería mentir sobre por qué está vacío.

        Si el negocio baja de plan, lo que ya se escribió no se borra: deja de
        verse y vuelve solo cuando recupera el plan.
      */}
      {aceptaResenas && (
        <section className="px-4 pt-8">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-display text-xl">Reseñas</h2>

            {calificacion && (
              <p>
                <Promedio
                  promedio={calificacion.promedio}
                  total={calificacion.total}
                />
              </p>
            )}
          </div>

          {resenas.length === 0 ? (
            <p className="mt-3 text-cacao">
              Todavía nadie ha dejado una reseña.
            </p>
          ) : (
            <ListaResenas
              resenas={resenas.map((resena) => ({
                id: resena.id,
                nombre: resena.perfiles_publicos?.nombre ?? "Visitante",
                texto: resena.texto,
                fechaTexto: CUANDO.format(new Date(resena.fecha)),
                medioUrl: urlImagen(resena.foto, BUCKET_RESENAS),
                editada: resena.fecha_edicion !== null,
                estrellas: estrellas.get(resena.usuario_id) ?? null,
                respuesta: resena.respuesta_marca,
              }))}
              esDuenio={esDuenio}
              slug={slug}
            />
          )}

          <div className="mt-6 grid gap-4">
            {!perfil && (
              <p className="rounded-3xl bg-crema-2 p-5 text-cacao">
                <Link
                  href={`/login?volver=/marca/${slug}`}
                  className="font-bold text-selva underline"
                >
                  Inicia sesión
                </Link>{" "}
                para calificar y dejar tu reseña.
              </p>
            )}

            {perfil?.rol === "cliente" && (
              <FormularioResena
                sucursalId={sucursal.id}
                slug={slug}
                misEstrellas={misEstrellas}
                miResena={
                  resenaPropia && {
                    texto: resenaPropia.texto,
                    medioUrl: urlImagen(resenaPropia.foto, BUCKET_RESENAS),
                    puedeCambiarla: resenaPropia.puedeCambiarla,
                  }
                }
              />
            )}
          </div>
        </section>
      )}
    </>
  );
}
