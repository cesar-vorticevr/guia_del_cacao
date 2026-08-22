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
import {
  FormularioGaleria,
  FormularioImagen,
  FormularioMicrositio,
  FormularioProducto,
} from "@/components/negocio/formularios";
import { eliminarProducto, quitarDeGaleria } from "@/lib/negocio/acciones";
import { perfilActual } from "@/lib/auth/sesion";
import { miSucursal, productosDe } from "@/lib/datos/sucursales";
import { urlImagen } from "@/lib/imagenes";
import { ESTADO, pesos } from "@/lib/tipos";

export const metadata: Metadata = { title: "Editar micrositio · Guía del Cacao" };

const CUANDO = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export default async function EditorMicrositio({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ publicado?: string }>;
}) {
  const perfil = await perfilActual();

  if (!perfil) redirect("/login");
  if (perfil.rol !== "negocio") redirect("/cuenta");

  const { id } = await params;
  const { publicado } = await searchParams;

  const sucursal = await miSucursal(perfil.id, id);
  if (!sucursal) redirect("/negocio/panel");

  const productos = await productosDe(sucursal.id);
  const calificacion = await calificacionDe(sucursal.id);

  // Todo lo que le han dicho, en su propia pantalla: antes tenia que ir a ver
  // su micrositio como si fuera un visitante para leer sus resenas.
  const [resenas, estrellas] = await Promise.all([
    resenasDe(sucursal.id),
    estrellasPorUsuario(sucursal.id),
  ]);
  const logo = urlImagen(sucursal.logo);
  const fondo = urlImagen(sucursal.imagen_fondo);

  const editable = sucursal.estado !== "pendiente_aprobacion";

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
            <InsigniaEstado estado={sucursal.estado} />
          </div>

          <p className="mt-1.5">
            {calificacion ? (
              <Promedio promedio={calificacion.promedio} total={calificacion.total} />
            ) : (
              <SinCalificar />
            )}
          </p>

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

        {editable && (
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

            <section className="grid gap-5">
              <h2 className="font-display text-xl">Datos del micrositio</h2>
              <FormularioMicrositio sucursal={sucursal} />
            </section>

            <section className="grid gap-5 rounded-3xl bg-crema-2 p-6">
              <div>
                <h2 className="font-display text-xl">Catálogo</h2>
                <p className="mt-1 text-cacao">
                  Es lo que tus clientes eligen al escanear el QR para pedir sus
                  monedas, así que conviene tenerlo completo.
                </p>
              </div>

              {productos.length > 0 && (
                <ul className="grid gap-3">
                  {productos.map((producto) => (
                    <li
                      key={producto.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4"
                    >
                      <div>
                        <p className="font-bold text-selva-2">{producto.nombre}</p>
                        {producto.descripcion && (
                          <p className="text-cacao">{producto.descripcion}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        {producto.precio !== null && (
                          <span className="font-mono font-bold text-selva">
                            {pesos(producto.precio)}
                          </span>
                        )}
                        <form action={eliminarProducto}>
                          <input type="hidden" name="sucursal_id" value={sucursal.id} />
                          <input type="hidden" name="producto_id" value={producto.id} />
                          <button
                            type="submit"
                            className="min-h-10 rounded-full border-2 border-guayaba/40 px-4 text-sm font-bold text-cacao"
                          >
                            Quitar
                          </button>
                        </form>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <FormularioProducto sucursalId={sucursal.id} />
            </section>

            {sucursal.estado !== "publicado" && (
              <Link
                href={`/negocio/panel/sucursal/${sucursal.id}/publicar`}
                className="min-h-14 rounded-full bg-mango px-6 py-3.5 text-center font-display text-lg font-semibold text-ink"
              >
                Publicar este micrositio
              </Link>
            )}
          </>
        )}
        <section className="grid gap-3">
          <h2 className="font-display text-2xl">Lo que dicen de ti</h2>

          {resenas.length === 0 ? (
            <p className="rounded-3xl bg-crema-2 p-6 text-cacao">
              Todavia nadie ha dejado resena en esta sucursal.
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

      </main>
    </>
  );
}
