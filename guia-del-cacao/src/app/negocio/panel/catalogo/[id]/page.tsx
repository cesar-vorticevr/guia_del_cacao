import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { FormularioEditarProducto } from "@/components/negocio/catalogo";
import { perfilActual } from "@/lib/auth/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { urlImagen } from "@/lib/imagenes";
import type { Producto } from "@/lib/tipos";

export const metadata: Metadata = { title: "Editar producto · Guía del Cacao" };

export default async function EditarProducto({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const perfil = await perfilActual();

  if (!perfil) redirect("/login");
  if (perfil.rol !== "negocio") redirect("/cuenta");

  const supabase = await crearClienteServidor();

  /*
    El acotado por marca es explícito aunque RLS ya lo cubra: la política de
    lectura de productos es tan ancha como su lector legítimo más amplio —el
    público de un micrositio publicado—, así que sin este filtro se podría abrir
    el editor de un producto ajeno con solo saber su id.
  */
  const { data: producto } = await supabase
    .from("productos_servicios")
    .select(
      "id, nombre, sku, descripcion, precio, imagen, marcas!inner(perfil_id)",
    )
    .eq("id", id)
    .eq("marcas.perfil_id", perfil.id)
    .maybeSingle();

  if (!producto) redirect("/negocio/panel/catalogo");

  const foto = urlImagen(producto.imagen);

  return (
    <div className="mx-auto grid max-w-xl gap-6">
      <div>
        <Link
          href="/negocio/panel/catalogo"
          className="font-bold text-selva underline"
        >
          ← Catálogo
        </Link>

        <h1 className="mt-3 font-display text-3xl">{producto.nombre}</h1>
        <p className="mt-2 text-cacao">
          Lo que cambies aquí se ve en todas las sucursales que manejan este
          producto.
        </p>
      </div>

      {foto && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={foto}
          alt={`Foto actual de ${producto.nombre}`}
          className="size-32 rounded-3xl border-2 border-selva/15 bg-white object-cover"
        />
      )}

      <FormularioEditarProducto producto={producto as unknown as Producto} />
    </div>
  );
}
