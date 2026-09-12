import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import {
  BotonEliminarProducto,
  FormularioNuevoProducto,
} from "@/components/negocio/catalogo";
import { catalogoDeMarca, usoEnSucursales } from "@/lib/datos/catalogo";
import { perfilActual } from "@/lib/auth/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { urlImagen } from "@/lib/imagenes";
import { pesos } from "@/lib/tipos";

export const metadata: Metadata = { title: "Catálogo · Guía del Cacao" };

/**
 * El catálogo de la marca: una sola lista para todas sus sucursales.
 *
 * Antes los productos se cargaban sucursal por sucursal y abrir la segunda
 * significaba escribirlo todo otra vez. Aquí se escribe una vez y cada sucursal
 * elige qué maneja.
 */
export default async function Catalogo({
  searchParams,
}: {
  searchParams: Promise<{ guardado?: string }>;
}) {
  const { guardado } = await searchParams;
  const perfil = await perfilActual();

  if (!perfil) redirect("/login");
  if (perfil.rol !== "negocio") redirect("/cuenta");

  const supabase = await crearClienteServidor();
  const { data: marca } = await supabase
    .from("marcas")
    .select("id, nombre_comercial")
    .eq("perfil_id", perfil.id)
    .limit(1)
    .maybeSingle();

  if (!marca) redirect("/negocio/completar-marca");

  const [productos, uso] = await Promise.all([
    catalogoDeMarca(marca.id),
    usoEnSucursales(marca.id),
  ]);

  return (
    <div className="grid gap-8">
      <div>
        <h1 className="font-display text-3xl">Catálogo</h1>
        <p className="mt-2 max-w-prose text-cacao">
          Lo que vende {marca.nombre_comercial}, en un solo lugar. Cada sucursal
          elige de aquí lo que maneja, y lo que corrijas se actualiza en todas.
        </p>
      </div>

      {guardado === "1" && (
        <p
          role="status"
          className="rounded-2xl border-2 border-lima/50 bg-lima/15 px-4 py-3 font-bold text-selva-2"
        >
          Producto actualizado en el catálogo y en las sucursales que lo
          manejan.
        </p>
      )}

      <section className="grid gap-4">
        <h2 className="font-display text-xl">
          Tus productos{" "}
          <span className="font-body font-mono text-sm font-normal text-cacao/70">
            {productos.length}
          </span>
        </h2>

        {productos.length === 0 ? (
          <p className="rounded-3xl bg-crema-2 p-6 text-cacao">
            Todavía no tienes productos. Agrega el primero aquí abajo: hace
            falta al menos uno para poder crear una sucursal.
          </p>
        ) : (
          /*
            La misma retícula que el catálogo del micrositio: foto cuadrada
            arriba y el texto debajo. Era una lista de renglones con una
            miniatura de 64 px, y así el negocio corregía a ciegas la foto que su
            cliente ve en grande. Ahora ve lo mismo que se publica.
          */
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {productos.map((producto) => {
              const foto = urlImagen(producto.imagen);
              const enSucursales = uso.get(producto.id) ?? 0;
              const editar = `/negocio/panel/catalogo/${producto.id}`;

              return (
                <li
                  key={producto.id}
                  className="group flex flex-col overflow-hidden rounded-2xl border-2 border-ink/10 bg-white shadow-dura"
                >
                  {/*
                    La foto lleva a editar, no a un visor: aquí el trabajo es
                    corregirla, y tocarla es lo primero que se intenta cuando
                    salió cortada.

                    Va absoluta dentro de la caja cuadrada, no en el flujo: con
                    `h-full` en el flujo una foto alta estira su caja y las
                    tarjetas de la fila dejan de alinearse.
                  */}
                  <Link
                    href={editar}
                    aria-label={`Editar ${producto.nombre}`}
                    className="relative block aspect-square w-full shrink-0 overflow-hidden bg-crema-2"
                  >
                    {foto ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={foto}
                        alt=""
                        loading="lazy"
                        className="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <span
                        aria-hidden="true"
                        className="absolute inset-0 grid place-items-center font-display text-3xl text-selva/40"
                      >
                        {producto.nombre.charAt(0)}
                      </span>
                    )}

                    {/* Un producto que no maneja ninguna sucursal no lo ve
                        nadie. Va sobre la foto porque es lo que hay que notar
                        de un golpe al repasar el catálogo. */}
                    {enSucursales === 0 && (
                      <span className="absolute left-2 top-2 rounded-full bg-mango px-2.5 py-1 font-mono text-[0.65rem] font-bold text-ink">
                        En ninguna sucursal
                      </span>
                    )}
                  </Link>

                  <div className="flex flex-1 flex-col gap-0.5 p-3">
                    <p className="font-bold leading-tight text-selva-2">
                      {producto.nombre}
                    </p>

                    {producto.sku && (
                      <p className="font-mono text-xs text-cacao/70">
                        SKU {producto.sku}
                      </p>
                    )}

                    {producto.descripcion && (
                      <p className="line-clamp-2 text-sm text-cacao">
                        {producto.descripcion}
                      </p>
                    )}

                    {/* Saber dónde se usa evita el borrado a ciegas. El caso de
                        cero ya se avisó sobre la foto. */}
                    {enSucursales > 0 && (
                      <p className="font-mono text-xs text-cacao/70">
                        En {enSucursales}{" "}
                        {enSucursales === 1 ? "sucursal" : "sucursales"}
                      </p>
                    )}

                    {/*
                      El precio pegado al fondo con `mt-auto`: así queda a la
                      misma altura en toda la fila aunque unas descripciones
                      ocupen dos renglones y otras ninguno.
                    */}
                    {producto.precio !== null && (
                      <p className="mt-auto pt-1.5 font-mono font-bold text-selva">
                        {pesos(producto.precio)}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 border-t-2 border-ink/5 px-3 py-2.5">
                    <Link
                      href={editar}
                      className="min-h-10 rounded-full border-2 border-selva/25 bg-white px-4 py-2 text-sm font-bold text-selva-2"
                    >
                      Editar
                    </Link>

                    <BotonEliminarProducto
                      producto={producto}
                      enSucursales={enSucursales}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="grid max-w-2xl gap-4 rounded-3xl bg-crema-2 p-6">
        <h2 className="font-display text-xl">Agregar un producto</h2>
        <FormularioNuevoProducto />
      </section>
    </div>
  );
}
