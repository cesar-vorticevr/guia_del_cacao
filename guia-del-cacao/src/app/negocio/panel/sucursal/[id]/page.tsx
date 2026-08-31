import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { BarraSesion } from "@/components/barra-sesion";
import { InsigniaEstado } from "@/components/insignia-estado";
import { Promedio, SinCalificar } from "@/components/publico/estrellas";
import { calificacionDe } from "@/lib/datos/publico";
import { estrellasPorUsuario, resenasDe } from "@/lib/datos/publico";
import { ListaResenas } from "@/components/publico/lista-resenas";
import { BUCKET_RESENAS } from "@/lib/imagenes";
import { BarraDePasos } from "@/components/negocio/barra-de-pasos";
import {
  FormularioGaleria,
  FormularioImagen,
  FormularioMicrositio,
} from "@/components/negocio/formularios";
import { SeleccionDeProductos } from "@/components/negocio/catalogo";
import { mostrarSucursal, ocultarSucursal, quitarDeGaleria } from "@/lib/negocio/acciones";
import {
  NOMBRE_DEL_PASO,
  esPasoDelAlta,
  vecinos,
  type PasoDelAlta,
} from "@/lib/negocio/pasos";
import { perfilActual } from "@/lib/auth/sesion";
import { miSucursal } from "@/lib/datos/sucursales";
import { catalogoDeMarca, idsDeSucursal } from "@/lib/datos/catalogo";
import { urlImagen } from "@/lib/imagenes";
import { ESTADO } from "@/lib/tipos";

export const metadata: Metadata = { title: "Editar micrositio · Guía del Cacao" };

const CUANDO = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** Clases del botón que lleva al paso siguiente. */
const SIGUIENTE =
  "inline-flex min-h-12 items-center rounded-full bg-selva px-6 py-3 font-bold text-crema shadow-dura-sm transition-transform active:translate-y-0.5";

/** Y las del que regresa: gris, porque volver no es la acción esperada. */
const REGRESAR =
  "inline-flex min-h-12 items-center rounded-full border-2 border-selva/25 bg-white px-6 py-3 font-bold text-selva-2 transition-transform active:translate-y-0.5";

export default async function EditorMicrositio({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ publicado?: string; paso?: string }>;
}) {
  const perfil = await perfilActual();

  if (!perfil) redirect("/login");
  if (perfil.rol !== "negocio") redirect("/cuenta");

  const { id } = await params;
  const { publicado, paso } = await searchParams;

  const sucursal = await miSucursal(perfil.id, id);
  if (!sucursal) redirect("/negocio/panel");

  // El catálogo es de la marca; lo de esta sucursal es qué eligió de él.
  const [catalogo, elegidos, calificacion] = await Promise.all([
    catalogoDeMarca(sucursal.marca_id),
    idsDeSucursal(sucursal.id),
    calificacionDe(sucursal.id),
  ]);

  const logo = urlImagen(sucursal.logo);
  const fondo = urlImagen(sucursal.imagen_fondo);

  const editable = sucursal.estado !== "pendiente_aprobacion";

  /*
    Un micrositio que todavía no sale en el directorio se arma por pasos; uno ya
    publicado se edita de corrido, que es como se corrige algo puntual. El estado
    es la señal: en borrador se está dando de alta, publicado ya está dado.
  */
  const guiado = editable && sucursal.estado !== "publicado";
  const actual: PasoDelAlta = esPasoDelAlta(paso) ? paso : "imagenes";
  const { anterior, siguiente } = vecinos(actual);
  const ruta = (destino: string) => `/negocio/panel/sucursal/${sucursal.id}?paso=${destino}`;

  const ver = (seccion: PasoDelAlta) => !guiado || actual === seccion;

  /*
    Las reseñas no se piden cuando no puede haberlas. Un micrositio en borrador
    nunca estuvo a la vista de nadie, así que la sección solo enseñaba "todavía
    nadie ha dejado reseña" a quien apenas está dando de alta su negocio: ruido
    en el momento de menos paciencia. Y de paso se ahorran dos consultas.
  */
  const [resenas, estrellas] = guiado
    ? [[], new Map<string, number>()]
    : await Promise.all([resenasDe(sucursal.id), estrellasPorUsuario(sucursal.id)]);

  return (
    <>
      <BarraSesion nombre={perfil.nombre} />

      <main className="mx-auto grid w-[92vw] max-w-2xl gap-8 py-8">
        <div>
          <Link href="/negocio/panel" className="font-bold text-selva underline">
            ← Panel
          </Link>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <h1 className="font-display text-3xl">{sucursal.nombre_sucursal}</h1>
            <div className="flex flex-wrap items-center gap-3">
              <InsigniaEstado estado={sucursal.estado} />

              {/*
                Publicado u oculto, con un toque. Ocultar es la alternativa suave
                a eliminar: el local cierra por temporada o la ficha se está
                rehaciendo, y nada de eso justifica perder fotos, catálogo y
                reseñas. Eliminar sigue existiendo, pero en el panel y con sus
                dos cerrojos.
              */}
              {sucursal.estado === "publicado" && (
                <form action={ocultarSucursal}>
                  <input type="hidden" name="sucursal_id" value={sucursal.id} />
                  <button type="submit" className={REGRESAR}>
                    Ocultar del directorio
                  </button>
                </form>
              )}

              {sucursal.estado === "pausado" && !sucursal.pausado_por_admin && (
                <form action={mostrarSucursal}>
                  <input type="hidden" name="sucursal_id" value={sucursal.id} />
                  <button type="submit" className={SIGUIENTE}>
                    Volver a publicar
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* El promedio no aplica a un borrador: nadie ha podido calificarlo. */}
          {!guiado && (
            <p className="mt-1.5">
              {calificacion ? (
                <Promedio promedio={calificacion.promedio} total={calificacion.total} />
              ) : (
                <SinCalificar />
              )}
            </p>
          )}

          <p className="mt-2 text-cacao">{ESTADO[sucursal.estado].explicacion}</p>

          {publicado === "1" && (
            <p
              role="status"
              className="mt-4 rounded-2xl border-2 border-lima/50 bg-lima/15 px-4 py-3 font-bold text-selva-2"
            >
              Listo: tu micrositio ya está en el directorio. No hace falta que
              nadie lo apruebe.
            </p>
          )}

          {sucursal.motivo_rechazo && (
            <p className="mt-4 rounded-2xl bg-guayaba/15 px-4 py-3 text-cacao">
              <strong>Motivo del rechazo:</strong> {sucursal.motivo_rechazo}
            </p>
          )}
        </div>

        {!editable && (
          <p className="rounded-3xl bg-turquesa/15 p-5 text-cacao">
            Mientras esté en revisión no se puede editar, para que el
            administrador vea exactamente lo que enviaste.
          </p>
        )}

        {guiado && (
          <div className="grid gap-3">
            <BarraDePasos sucursalId={sucursal.id} actual={actual} />
            <p className="text-cacao">{NOMBRE_DEL_PASO[actual].detalle}</p>
          </div>
        )}

        {editable && (
          <>
            {ver("imagenes") && (
              <>
                <section className="grid gap-5 rounded-3xl bg-crema-2 p-6">
                  <h2 className="font-display text-xl">Imágenes</h2>

                  <div className="grid gap-6 sm:grid-cols-2">
                    <div className="grid gap-3">
                      {logo && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={logo}
                          alt="Logo actual"
                          className="size-24 rounded-2xl border-2 border-selva/15 bg-white object-cover"
                        />
                      )}
                      <FormularioImagen
                        sucursalId={sucursal.id}
                        campo="logo"
                        etiqueta="Logo"
                        uso="Se usa en el directorio y el buscador."
                      />
                    </div>

                    <div className="grid gap-3">
                      {fondo && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={fondo}
                          alt="Imagen de fondo actual"
                          className="h-24 w-full rounded-2xl border-2 border-selva/15 bg-white object-cover"
                        />
                      )}
                      <FormularioImagen
                        sucursalId={sucursal.id}
                        campo="imagen_fondo"
                        etiqueta="Imagen de fondo"
                        uso="Encabeza tu micrositio."
                      />
                    </div>
                  </div>
                </section>

                <section className="grid gap-5">
                  <div>
                    <h2 className="font-display text-xl">Carrusel de fotos</h2>
                    <p className="mt-1 text-cacao">
                      Se muestran en tu micrositio, en el orden en que las subes.
                    </p>
                  </div>

                  {sucursal.galeria.length > 0 && (
                    <ul className="flex gap-3 overflow-x-auto pb-2">
                      {sucursal.galeria.map((ruta) => (
                        <li key={ruta} className="relative shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={urlImagen(ruta) ?? ""}
                            alt=""
                            className="h-28 w-40 rounded-2xl object-cover"
                          />
                          <form action={quitarDeGaleria} className="absolute top-2 right-2">
                            <input type="hidden" name="sucursal_id" value={sucursal.id} />
                            <input type="hidden" name="ruta" value={ruta} />
                            <button
                              type="submit"
                              aria-label="Quitar foto"
                              className="grid size-8 place-items-center rounded-full bg-ink/70 font-bold text-crema"
                            >
                              ×
                            </button>
                          </form>
                        </li>
                      ))}
                    </ul>
                  )}

                  <FormularioGaleria sucursalId={sucursal.id} />
                </section>
              </>
            )}

            {ver("datos") && (
              <section className="grid gap-5">
                <h2 className="font-display text-xl">Datos del micrositio</h2>
                {/*
                  En el alta, guardar es también avanzar: el botón se lleva los
                  cambios y el paso siguiente de un solo toque.
                */}
                <FormularioMicrositio
                  sucursal={sucursal}
                  continuarA={guiado ? (siguiente ?? undefined) : undefined}
                />
              </section>
            )}

            {ver("catalogo") && (
              <section className="grid gap-5 rounded-3xl bg-crema-2 p-6">
                <div>
                  <h2 className="font-display text-xl">Catálogo de esta sucursal</h2>
                  <p className="mt-1 text-cacao">
                    Elige del catálogo de tu marca lo que se vende aquí. Es lo que
                    ven tus clientes al escanear el QR para pedir sus monedas.{" "}
                    <Link
                      href="/negocio/panel/catalogo"
                      className="font-bold text-selva underline"
                    >
                      Editar el catálogo
                    </Link>
                    .
                  </p>
                </div>

                {catalogo.length === 0 ? (
                  <p className="rounded-2xl bg-white p-5 text-cacao">
                    Tu catálogo está vacío.{" "}
                    <Link
                      href="/negocio/panel/catalogo"
                      className="font-bold text-selva underline"
                    >
                      Agrega tu primer producto
                    </Link>
                    .
                  </p>
                ) : (
                  /*
                    La `key` vuelve a montar la lista cuando cambia lo guardado.
                    Sin ella, al guardar la selección las casillas se quedaban
                    como estaban antes —el estado del cliente sobrevive al
                    re-render— y parecía que el cambio no había entrado, aunque
                    en la base sí estaba.
                  */
                  <SeleccionDeProductos
                    key={elegidos.join(",")}
                    sucursalId={sucursal.id}
                    catalogo={catalogo}
                    elegidos={elegidos}
                  />
                )}
              </section>
            )}

            {/*
              La navegación del alta. En el paso de datos no se repite el
              "Siguiente": ahí lo hace el propio botón de guardar, y dos caminos
              al mismo sitio —uno que guarda y otro que no— es justo la trampa que
              se quiso quitar.
            */}
            {guiado ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                {anterior ? (
                  <Link href={ruta(anterior)} className={REGRESAR}>
                    ← {NOMBRE_DEL_PASO[anterior].titulo}
                  </Link>
                ) : (
                  <span />
                )}

                {siguiente && actual !== "datos" && (
                  <Link href={ruta(siguiente)} className={SIGUIENTE}>
                    Siguiente: {NOMBRE_DEL_PASO[siguiente].titulo} →
                  </Link>
                )}

                {!siguiente && (
                  <Link
                    href={`/negocio/panel/sucursal/${sucursal.id}/publicar`}
                    className="inline-flex min-h-14 items-center rounded-full bg-mango px-6 py-3.5 text-center font-display text-lg font-semibold text-ink shadow-dura-sm transition-transform active:translate-y-0.5"
                  >
                    Publicar este micrositio
                  </Link>
                )}
              </div>
            ) : (
              sucursal.estado !== "publicado" && (
                <Link
                  href={`/negocio/panel/sucursal/${sucursal.id}/publicar`}
                  className="min-h-14 rounded-full bg-mango px-6 py-3.5 text-center font-display text-lg font-semibold text-ink"
                >
                  Publicar este micrositio
                </Link>
              )
            )}
          </>
        )}


        {!guiado && (
          <section className="grid gap-3">
            <h2 className="font-display text-2xl">Lo que dicen de ti</h2>

            {resenas.length === 0 ? (
              <p className="rounded-3xl bg-crema-2 p-6 text-cacao">
                Todavía nadie ha dejado reseña en esta sucursal.
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
                esDuenio
                slug={sucursal.slug}
              />
            )}
          </section>
        )}
      </main>
    </>
  );
}
