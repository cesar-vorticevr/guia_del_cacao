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
          <ul className="grid gap-3">
            {productos.map((producto) => {
              const foto = urlImagen(producto.imagen);
              const enSucursales = uso.get(producto.id) ?? 0;

              return (
                <li
                  key={producto.id}
                  className="flex flex-wrap items-center gap-4 rounded-3xl border-2 border-ink/10 bg-white p-4"
                >
                  {foto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={foto}
                      alt=""
                      className="size-16 shrink-0 rounded-2xl border-2 border-selva/10 object-cover"
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="grid size-16 shrink-0 place-items-center rounded-2xl bg-crema-2 font-display text-xl text-selva-2"
                    >
                      {producto.nombre.charAt(0)}
                    </span>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-selva-2">{producto.nombre}</p>

                    {producto.sku && (
                      <p className="font-mono text-xs text-cacao/70">
                        SKU {producto.sku}
                      </p>
                    )}

                    {producto.descripcion && (
                      <p className="line-clamp-1 text-cacao">
                        {producto.descripcion}
                      </p>
                    )}

                    {/* Saber dónde se usa evita el borrado a ciegas, y de paso
                        señala los productos que no llegaron a ninguna sucursal. */}
                    <p className="mt-0.5 font-mono text-xs text-cacao/70">
                      {enSucursales === 0
                        ? "En ninguna sucursal todavía"
                        : `En ${enSucursales} ${enSucursales === 1 ? "sucursal" : "sucursales"}`}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    {producto.precio !== null && (
                      <span className="font-mono font-bold text-selva">
                        {pesos(producto.precio)}
                      </span>
                    )}

                    <Link
                      href={`/negocio/panel/catalogo/${producto.id}`}
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
