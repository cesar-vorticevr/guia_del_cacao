import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { FormularioPedirPuntos } from "@/components/puntos/formularios";
import { micrositioPorSlug } from "@/lib/datos/publico";
import { productosDe } from "@/lib/datos/sucursales";
import { tienePendienteEn } from "@/lib/datos/puntos";
import { perfilActual } from "@/lib/auth/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { urlImagen } from "@/lib/imagenes";

export const metadata: Metadata = { title: "Pedir monedas · Guía del Cacao" };

/**
 * Destino del QR fijo de cada micrositio (spec §5.4).
 *
 * Reemplaza el pasaporte físico sellado de la feria, con una diferencia que
 * importa: funciona todo el año, no solo la semana de feria.
 */
export default async function PedirPuntos({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ enviado?: string }>;
}) {
  const { slug } = await params;
  const { enviado } = await searchParams;
  const sucursal = await micrositioPorSlug(slug);

  if (!sucursal) notFound();

  const supabase = await crearClienteServidor();

  // Si el plan no da puntos, más vale decirlo aquí que dejar que el trigger lo
  // rechace después de que la persona eligió todo lo que compró.
  const { data: tier } = await supabase
    .from("tiers")
    .select("puede_dar_puntos")
    .eq("id", sucursal.tier_id ?? 0)
    .maybeSingle();

  const [productos, perfil] = await Promise.all([
    productosDe(sucursal.id),
    perfilActual(),
  ]);

  const logo = urlImagen(sucursal.logo);
  const pendiente =
    perfil?.rol === "cliente" ? await tienePendienteEn(perfil.id, sucursal.id) : false;

  return (
    <div className="mx-auto max-w-md py-6">
      <div className="flex items-center gap-4">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logo}
            alt=""
            className="size-16 rounded-2xl border-2 border-selva/15 bg-white object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="grid size-16 place-items-center rounded-2xl bg-crema-2 font-display text-2xl text-selva/50"
          >
            {sucursal.nombre_sucursal.charAt(0)}
          </span>
        )}

        <div className="min-w-0">
          <h1 className="font-display text-2xl">{sucursal.marcas?.nombre_comercial}</h1>
          <p className="text-cacao">{sucursal.nombre_sucursal}</p>
        </div>
      </div>

      <div className="mt-6">
        {!tier?.puede_dar_puntos ? (
          <p className="rounded-3xl bg-crema-2 p-6 text-cacao">
            Este negocio todavía no participa en el pasaporte de monedas de
            chocolate.{" "}
            <Link href={`/marca/${slug}`} className="font-bold text-selva underline">
              Ver su micrositio
            </Link>
          </p>
        ) : !perfil ? (
          <div className="rounded-3xl bg-crema-2 p-6">
            <p className="text-cacao">
              Para juntar monedas de chocolate necesitas una cuenta de cliente.
              Es rápido y sirve todo el año, no solo en la feria.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href="/registro/cliente"
                className="min-h-12 rounded-full bg-selva px-5 py-3 font-bold text-crema"
              >
                Crear mi cuenta
              </Link>
              <Link
                href="/login"
                className="min-h-12 rounded-full border-2 border-selva/25 bg-white px-5 py-3 font-bold text-selva-2"
              >
                Ya tengo cuenta
              </Link>
            </div>
          </div>
        ) : perfil.rol !== "cliente" ? (
          <p className="rounded-3xl bg-crema-2 p-6 text-cacao">
            Estás con una cuenta de {perfil.rol}. Las monedas de chocolate son
            para las cuentas de cliente.
          </p>
        ) : enviado === "1" ? (
          <div
            role="status"
            className="rounded-3xl border-2 border-lima/50 bg-lima/15 p-6"
          >
            <p className="font-display text-xl font-semibold text-selva-2">
              Listo, ya quedó registrada
            </p>
            <p className="mt-2 text-cacao">
              El negocio va a revisar qué compraste y decidir cuántas monedas
              darte. Lo verás en tu cuenta.
            </p>
            <Link
              href="/cuenta"
              className="mt-4 inline-block min-h-12 rounded-full bg-selva px-5 py-3 font-bold text-crema"
            >
              Ver mi pasaporte
            </Link>
          </div>
        ) : pendiente ? (
          <p className="rounded-3xl bg-turquesa/15 p-6 text-cacao">
            Ya tienes una solicitud pendiente aquí. En cuanto el negocio la
            resuelva podrás pedir otra.
          </p>
        ) : productos.length === 0 ? (
          <p className="rounded-3xl bg-crema-2 p-6 text-cacao">
            Este negocio todavía no cargó su catálogo, así que no se puede
            registrar qué compraste. Pídeles que lo suban.
          </p>
        ) : (
          <FormularioPedirPuntos
            sucursalId={sucursal.id}
            slug={slug}
            productos={productos}
          />
        )}
      </div>

      <p className="mt-6 text-sm text-cacao/70">
        El negocio decide cuántas monedas darte, entre 1 y 3, según lo que
        compraste. Máximo 3 por día en el mismo negocio.
      </p>
    </div>
  );
}
