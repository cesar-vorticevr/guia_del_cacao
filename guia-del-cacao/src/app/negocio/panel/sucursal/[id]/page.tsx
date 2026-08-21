import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { BarraSesion } from "@/components/barra-sesion";
import { InsigniaEstado } from "@/components/insignia-estado";
import {
  FormularioImagen,
  FormularioMicrositio,
  FormularioProducto,
} from "@/components/negocio/formularios";
import { eliminarProducto } from "@/lib/negocio/acciones";
import { perfilActual } from "@/lib/auth/sesion";
import { miSucursal, productosDe, urlPublica } from "@/lib/datos/sucursales";
import { ESTADO, pesos } from "@/lib/tipos";

export const metadata: Metadata = { title: "Editar micrositio · Guía del Cacao" };

export default async function EditorMicrositio({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ enviado?: string }>;
}) {
  const perfil = await perfilActual();

  if (!perfil) redirect("/login");
  if (perfil.rol !== "negocio") redirect("/cuenta");

  const { id } = await params;
  const { enviado } = await searchParams;

  const sucursal = await miSucursal(perfil.id, id);
  if (!sucursal) redirect("/negocio/panel");

  const [productos, logo, fondo] = await Promise.all([
    productosDe(sucursal.id),
    urlPublica(sucursal.logo),
    urlPublica(sucursal.imagen_fondo),
  ]);

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

          <p className="mt-2 text-cacao">{ESTADO[sucursal.estado].explicacion}</p>

          {enviado === "1" && (
            <p
              role="status"
              className="mt-4 rounded-2xl border-2 border-lima/50 bg-lima/15 px-4 py-3 font-bold text-selva-2"
            >
              Listo: tu micrositio quedó en revisión. Te avisamos cuando lo
              aprueben.
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
                    ayuda="Cuadrado. Se usa en el directorio y el buscador."
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
                    ayuda="Horizontal. Encabeza tu micrositio."
                  />
                </div>
              </div>
            </section>

            <section className="grid gap-5">
              <h2 className="font-display text-xl">Datos del micrositio</h2>
              <FormularioMicrositio sucursal={sucursal} />
            </section>

            <section className="grid gap-5 rounded-3xl bg-crema-2 p-6">
              <div>
                <h2 className="font-display text-xl">Catálogo</h2>
                <p className="mt-1 text-cacao">
                  Es lo que tus clientes eligen al escanear el QR para pedir
                  puntos, así que conviene tenerlo completo.
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
      </main>
    </>
  );
}
