import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { FormularioResena, FormularioRespuesta } from "@/components/publico/resenas";
import { micrositioPorSlug, resenasDe } from "@/lib/datos/publico";
import { productosDe } from "@/lib/datos/sucursales";
import { perfilActual } from "@/lib/auth/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { urlImagen } from "@/lib/imagenes";
import { pesos } from "@/lib/tipos";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const sucursal = await micrositioPorSlug(slug);

  if (!sucursal) return { title: "No encontrado · Guía del Cacao" };

  return {
    title: `${sucursal.marcas?.nombre_comercial} · Guía del Cacao`,
    description: sucursal.acerca_de ?? undefined,
  };
}

const REDES = [
  { campo: "whatsapp", texto: "WhatsApp" },
  { campo: "facebook", texto: "Facebook" },
  { campo: "instagram", texto: "Instagram" },
  { campo: "youtube", texto: "YouTube" },
  { campo: "tiktok", texto: "TikTok" },
] as const;

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

  const [productos, resenas, perfil] = await Promise.all([
    productosDe(sucursal.id),
    resenasDe(sucursal.id),
    perfilActual(),
  ]);

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

  const hayContacto = Boolean(
    sucursal.ubicacion_maps_url ||
      sucursal.telefono ||
      sucursal.correo_contacto ||
      REDES.some(({ campo }) => sucursal[campo]),
  );

  return (
    <>
      <header className="pt-4">
        <div
          className="h-40 rounded-3xl bg-cacao bg-cover bg-center sm:h-56"
          style={fondo ? { backgroundImage: `url(${fondo})` } : undefined}
          role="presentation"
        />

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
          <h1 className="font-display text-3xl">{sucursal.marcas?.nombre_comercial}</h1>
          <p className="mt-1 text-cacao">{sucursal.nombre_sucursal}</p>
        </div>
      </header>

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
          <ul className="mt-3 flex gap-3 overflow-x-auto px-4 pb-2">
            {sucursal.galeria.map((ruta) => (
              <li key={ruta} className="shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={urlImagen(ruta) ?? ""}
                  alt=""
                  className="h-44 w-64 rounded-2xl object-cover"
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {productos.length > 0 && (
        <section className="px-4 pt-6">
          <h2 className="font-display text-xl">Catálogo</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {productos.map((producto) => (
              <li
                key={producto.id}
                className="flex items-baseline justify-between gap-4 rounded-2xl bg-white p-4"
              >
                <span>
                  <span className="block font-bold text-selva-2">{producto.nombre}</span>
                  {producto.descripcion && (
                    <span className="block text-cacao">{producto.descripcion}</span>
                  )}
                </span>
                {producto.precio !== null && (
                  <span className="shrink-0 font-mono font-bold text-selva">
                    {pesos(producto.precio)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Sin ningún dato de contacto, el encabezado solo, sobre el vacío, se ve
          como un error. Mejor no dibujar la sección. */}
      {hayContacto && (
      <section className="px-4 pt-6">
        <h2 className="font-display text-xl">Contacto</h2>
        <ul className="mt-3 flex flex-wrap gap-2.5">
          {sucursal.ubicacion_maps_url && (
            <li>
              <a
                href={sucursal.ubicacion_maps_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-full bg-selva px-4 py-2.5 font-bold text-crema"
              >
                Cómo llegar
              </a>
            </li>
          )}

          {sucursal.telefono && (
            <li>
              <a
                href={`tel:${sucursal.telefono}`}
                className="block rounded-full border-2 border-selva/20 bg-white px-4 py-2.5 font-bold text-selva-2"
              >
                {sucursal.telefono}
              </a>
            </li>
          )}

          {sucursal.correo_contacto && (
            <li>
              <a
                href={`mailto:${sucursal.correo_contacto}`}
                className="block rounded-full border-2 border-selva/20 bg-white px-4 py-2.5 font-bold text-selva-2"
              >
                Correo
              </a>
            </li>
          )}

          {REDES.map(({ campo, texto }) => {
            const valor = sucursal[campo];
            if (!valor) return null;

            const href =
              campo === "whatsapp"
                ? `https://wa.me/${valor.replace(/\D/g, "")}`
                : valor;

            return (
              <li key={campo}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-full border-2 border-selva/20 bg-white px-4 py-2.5 font-bold text-selva-2"
                >
                  {texto}
                </a>
              </li>
            );
          })}
        </ul>
      </section>
      )}

      <section className="px-4 pt-8">
        <h2 className="font-display text-xl">Reseñas</h2>

        {resenas.length === 0 ? (
          <p className="mt-3 text-cacao">Todavía nadie ha dejado una reseña.</p>
        ) : (
          <ul className="mt-4 grid gap-4">
            {resenas.map((resena) => (
              <li key={resena.id} className="rounded-3xl bg-white p-5">
                <p className="font-bold text-selva-2">
                  {resena.perfiles_publicos?.nombre ?? "Visitante"}
                </p>
                <p className="mt-1.5 whitespace-pre-line text-cacao">{resena.texto}</p>

                {resena.respuesta_marca ? (
                  <p className="mt-3 rounded-2xl bg-crema-2 p-4 text-cacao">
                    <span className="block font-bold text-selva-2">
                      Respuesta del negocio
                    </span>
                    {resena.respuesta_marca}
                  </p>
                ) : (
                  esDuenio && <FormularioRespuesta resenaId={resena.id} slug={slug} />
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6">
          {!perfil && (
            <p className="rounded-3xl bg-crema-2 p-5 text-cacao">
              <Link href="/login" className="font-bold text-selva underline">
                Inicia sesión
              </Link>{" "}
              para dejar tu reseña.
            </p>
          )}

          {perfil?.rol === "cliente" && (
            <FormularioResena sucursalId={sucursal.id} slug={slug} />
          )}
        </div>
      </section>
    </>
  );
}
