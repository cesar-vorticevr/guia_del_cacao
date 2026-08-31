import { anotarMonedasVistas } from "@/lib/datos/notificaciones";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import QRCode from "qrcode";
import { CartelQr } from "@/components/negocio/cartel-qr";
import { AvisosDeMonedas } from "@/components/negocio/avisos-de-monedas";
import {
  FiltroDeSucursales,
  Paginas,
  POR_PAGINA,
  TarjetaSolicitud,
} from "@/components/negocio/solicitudes";
import { perfilActual, origenDelSitio } from "@/lib/auth/sesion";
import { misSucursales } from "@/lib/datos/sucursales";
import { dadasHoyPorPersona, solicitudesPorResolver } from "@/lib/datos/puntos";
import { crearClienteServidor } from "@/lib/supabase/server";
import { urlImagen } from "@/lib/imagenes";

export const metadata: Metadata = {
  title: "Solicitudes de mazorcas · Guía del Cacao",
};

export default async function PanelPuntos({
  searchParams,
}: {
  searchParams: Promise<{ sucursal?: string; pagina?: string }>;
}) {
  const { sucursal: filtro, pagina: paginaPedida } = await searchParams;
  const perfil = await perfilActual();

  if (!perfil) redirect("/login");
  if (perfil.rol !== "negocio") redirect("/cuenta");

  // Entrar aquí es haber visto lo que llegó: apaga el destello de "nueva" en el
  // panel. Lo que sigue sin resolver conserva su icono, porque sigue pendiente.
  await anotarMonedasVistas(perfil.id);

  const sucursales = await misSucursales(perfil.id);

  // Solo las publicadas y con plan que otorgue puntos tienen QR que valga.
  const conPuntos = sucursales.filter(
    (s) => s.estado === "publicado" && (s.tier_id ?? 0) >= 2,
  );
  const pendientes = await solicitudesPorResolver(conPuntos.map((s) => s.id));

  // Cuántas tiene cada sucursal, para el filtro. Se cuenta sobre todas y no
  // sobre las filtradas: si no, al elegir una las demás saldrían en cero.
  const porSucursal = conPuntos
    .map((s) => ({
      id: s.id,
      nombre: s.nombre_sucursal,
      cuantas: pendientes.filter((p) => p.sucursal_id === s.id).length,
    }))
    .filter((s) => s.cuantas > 0);

  const sucursalFiltrada =
    filtro && porSucursal.some((s) => s.id === filtro) ? filtro : null;

  const filtradas = sucursalFiltrada
    ? pendientes.filter((p) => p.sucursal_id === sucursalFiltrada)
    : pendientes;

  const paginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));

  // Una página fuera de rango —por un enlace viejo o por resolver la última
  // de la lista— cae en la más cercana en vez de enseñar una página vacía.
  const pagina = Math.min(paginas, Math.max(1, Number(paginaPedida) || 1));

  const enPantalla = filtradas.slice(
    (pagina - 1) * POR_PAGINA,
    pagina * POR_PAGINA,
  );

  // El bucket de comprobantes es privado —un ticket puede traer datos de la
  // persona—, asi que se firma una URL corta en vez de exponer el archivo.
  const supabase = await crearClienteServidor();

  const comprobantes = new Map<string, string>();

  for (const solicitud of enPantalla) {
    if (!solicitud.comprobante) continue;

    const { data } = await supabase.storage
      .from("comprobantes")
      .createSignedUrl(solicitud.comprobante, 60 * 10);

    if (data?.signedUrl) comprobantes.set(solicitud.id, data.signedUrl);
  }

  const origen = await origenDelSitio();

  // El nombre de la marca encabeza el cartel: es lo que la gente reconoce, y la
  // sucursal va debajo y en chico, igual que en todo el sitio.
  const { data: marca } = await supabase
    .from("marcas")
    .select("id, nombre_comercial")
    .eq("perfil_id", perfil.id)
    .limit(1)
    .maybeSingle();

  /*
    Cuántas lleva hoy cada solicitante en esta marca. El tope de 3 por persona y
    día ya lo imponía el trigger, pero solo saltaba al pulsar: con esto la
    tarjeta lo dice antes y no ofrece botones que van a fallar.
  */
  const dadasHoy = marca
    ? await dadasHoyPorPersona(
        marca.id,
        enPantalla.map((s) => s.usuario_id),
      )
    : new Map<string, number>();

  const codigos = await Promise.all(
    conPuntos.map(async (sucursal) => ({
      id: sucursal.id,
      nombre: sucursal.nombre_sucursal,
      logo: urlImagen(sucursal.logo),
      destino: `${origen}/monedas/${sucursal.slug}`,
      qr: await QRCode.toString(`${origen}/monedas/${sucursal.slug}`, {
        type: "svg",
        margin: 1,
        color: { dark: "#106b46", light: "#ffffff" },
      }),
    })),
  );

  return (
    <div className="grid gap-8">
      <AvisosDeMonedas />

      <div>
        <h1 className="font-display text-3xl">Solicitudes de mazorcas</h1>
      </div>

      {/*
        El aviso de abajo no nombra el plan: los nombres viven en la tabla
        `tiers` y aquí se quedaba uno viejo escrito a mano, prometiendo un plan
        que ya no existe con ese nombre.
      */}
      {conPuntos.length === 0 ? (
        <p className="rounded-3xl bg-crema-2 p-6 text-cacao">
          Dar mazorcas de cacao viene a partir del segundo plan, y el micrositio
          tiene que estar publicado. Ninguno de los tuyos cumple todavía.
        </p>
      ) : (
        <>
          <section className="grid gap-4">
            <div>
              <h2 className="font-display text-2xl">Por resolver</h2>
              <p className="mt-1 max-w-prose text-cacao">
                Tú decides cuántas mazorcas dar, de 1 a 3, según lo que
                compraron. Máximo 3 por persona al día.
              </p>
            </div>

            {pendientes.length === 0 ? (
              <p className="rounded-3xl bg-crema-2 p-6 text-cacao">
                Nada pendiente por ahora.
              </p>
            ) : (
              <>
                <FiltroDeSucursales
                  sucursales={porSucursal}
                  actual={sucursalFiltrada}
                  total={pendientes.length}
                />

                {/*
                  De dos en dos, y a lo ancho las que traen reseña. En una sola
                  columna, veinte solicitudes eran ocho pantallas de scroll.
                */}
                <ul className="grid items-start gap-5 sm:grid-cols-2">
                  {enPantalla.map((solicitud) => (
                    <TarjetaSolicitud
                      key={solicitud.id}
                      solicitud={solicitud}
                      comprobante={comprobantes.get(solicitud.id)}
                      dadasHoy={dadasHoy.get(solicitud.usuario_id) ?? 0}
                    />
                  ))}
                </ul>

                <Paginas
                  pagina={pagina}
                  paginas={paginas}
                  sucursal={sucursalFiltrada}
                />
              </>
            )}
          </section>

          <section className="grid gap-4">
            <div>
              <h2 className="font-display text-2xl">Tu código QR</h2>
              <p className="mt-1 max-w-prose text-cacao">
                Baja el cartel de cada sucursal —trae tu logo, el código y los
                tres pasos explicados— e imprímelo para el mostrador. Es fijo:
                no cambia, así que lo imprimes una vez y sirve todo el año.
              </p>
            </div>

            <ul className="grid gap-5 sm:grid-cols-2">
              {codigos.map((codigo) => (
                <li
                  key={codigo.id}
                  className="grid gap-3 rounded-3xl bg-white p-6 text-center"
                >
                  <p className="font-display text-lg font-semibold text-selva-2">
                    {codigo.nombre}
                  </p>
                  <div
                    className="mx-auto w-44"
                    // El SVG lo genera la librería de QR en el servidor a
                    // partir de nuestra propia URL, no de nada que venga de
                    // fuera.
                    dangerouslySetInnerHTML={{ __html: codigo.qr }}
                  />
                  <p className="font-mono text-xs break-all text-cacao/70">
                    {codigo.destino}
                  </p>

                  <CartelQr
                    svgQr={codigo.qr}
                    logo={codigo.logo}
                    marca={marca?.nombre_comercial ?? ""}
                    sucursal={codigo.nombre}
                    destino={codigo.destino}
                  />
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
