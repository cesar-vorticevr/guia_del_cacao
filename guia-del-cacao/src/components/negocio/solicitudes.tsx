import Link from "next/link";
import { BotonesResolver } from "@/components/puntos/formularios";
import type { SolicitudPendiente } from "@/lib/datos/puntos";
import { pesos } from "@/lib/tipos";

const CUANDO = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * Cuántas caben en una página.
 *
 * Veinte solicitudes seguidas eran ocho pantallas de scroll y la de abajo no la
 * veía nadie. Seis por página caben en una sin bajar, y quien atiende resuelve
 * de arriba abajo sin perder el sitio.
 */
export const POR_PAGINA = 6;

/** Lo que compraron, sumado. */
function cuenta(solicitud: SolicitudPendiente) {
  let total = 0;
  let faltaAlgunPrecio = false;

  for (const linea of solicitud.solicitud_productos) {
    const precio = linea.productos_servicios?.precio;

    if (precio === null || precio === undefined) faltaAlgunPrecio = true;
    else total += precio * linea.cantidad;
  }

  return { total, faltaAlgunPrecio };
}

/**
 * Una solicitud: quién es, qué compró, cuánto suma y los botones para resolver.
 *
 * El precio ya no va línea por línea. Al resolver no se cobra nada —eso pasó en
 * la caja—, así que la columna de precios era ruido en cada renglón; lo que sí
 * ayuda a decidir cuántas mazorcas dar es lo que gastó en total, y eso va una
 * vez, al final, que es donde se lee una cuenta.
 */
export function TarjetaSolicitud({
  solicitud,
  comprobante,
  dadasHoy,
}: {
  solicitud: SolicitudPendiente;
  comprobante: string | undefined;
  /** Cuántas lleva hoy esa persona en esta marca: el tope son 3. */
  dadasHoy: number;
}) {
  const { total, faltaAlgunPrecio } = cuenta(solicitud);
  const conResena = Boolean(solicitud.resenas);

  return (
    <li
      /*
        Las que traen reseña ocupan la fila entera y el resto va de dos en dos:
        una reseña es un párrafo que en media columna sale en ocho renglones, y
        además es la que hay que leer con calma antes de decidir.
      */
      className={`grid content-start gap-4 rounded-3xl bg-crema-2 p-6 ${
        conResena ? "sm:col-span-2" : ""
      }`}
    >
      <div>
        <p className="font-mono text-xs tracking-wide text-cacao/70 uppercase">
          {CUANDO.format(new Date(solicitud.fecha_solicitud))}
          {solicitud.sucursales?.nombre_sucursal &&
            ` · ${solicitud.sucursales.nombre_sucursal}`}
        </p>
        <p className="mt-1 font-display text-xl text-selva-2">
          {solicitud.perfiles_publicos?.nombre ?? "Cliente"}
        </p>
      </div>

      <div className="rounded-2xl bg-white px-4 py-3">
        <ul className="grid gap-1.5">
          {solicitud.solicitud_productos.map((linea, i) => (
            <li key={i} className="text-cacao">
              {/* La cantidad va delante y en mono: es el dato que cambia
                  cuántas mazorcas merece la compra. */}
              <span className="font-mono font-bold text-selva-2">
                {linea.cantidad}×
              </span>{" "}
              {linea.productos_servicios?.nombre}
            </li>
          ))}
        </ul>

        <p className="mt-3 flex items-baseline justify-between gap-4 border-t-2 border-selva/10 pt-3">
          <span className="font-bold text-selva-2">Total</span>
          <span className="font-mono text-lg font-bold text-selva">
            {pesos(total)}
          </span>
        </p>

        {faltaAlgunPrecio && (
          <p className="mt-1 text-right text-xs text-cacao/70">
            Sin contar lo que no lleva precio en tu catálogo
          </p>
        )}
      </div>

      {solicitud.resenas && (
        <div className="rounded-2xl border-2 border-lima/50 bg-lima/15 p-4">
          <p className="font-bold text-selva-2">
            Dejó reseña · vale una mazorca extra
          </p>
          <p className="mt-1 max-w-prose text-cacao">
            {solicitud.resenas.texto}
          </p>
        </div>
      )}

      {comprobante && (
        <a
          href={comprobante}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-2xl bg-white p-3 font-bold text-selva-2"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={comprobante}
            alt=""
            className="size-16 shrink-0 rounded-xl border-2 border-selva/10 object-cover"
          />
          Ver el ticket que mandó
        </a>
      )}

      <BotonesResolver
        solicitudId={solicitud.id}
        sucursalId={solicitud.sucursal_id}
        sugeridas={solicitud.resenas ? 2 : 1}
        cliente={solicitud.perfiles_publicos?.nombre ?? "tu cliente"}
        dadasHoy={dadasHoy}
      />
    </li>
  );
}

/**
 * Filtrar por sucursal.
 *
 * Con un solo local no se pinta: sería una fila de un botón que no filtra nada.
 * Van como enlaces y no como estado del cliente para que el filtro sobreviva a
 * resolver una solicitud —que recarga la página— y se pueda compartir.
 */
export function FiltroDeSucursales({
  sucursales,
  actual,
  total,
}: {
  sucursales: { id: string; nombre: string; cuantas: number }[];
  actual: string | null;
  total: number;
}) {
  if (sucursales.length < 2) return null;

  const opciones = [
    { id: null, nombre: "Todas", cuantas: total },
    ...sucursales.map((s) => ({ ...s, id: s.id as string | null })),
  ];

  return (
    <ul className="flex flex-wrap gap-2">
      {opciones.map((opcion) => {
        const activa = opcion.id === actual;

        return (
          <li key={opcion.id ?? "todas"}>
            <Link
              href={opcion.id ? `?sucursal=${opcion.id}` : "?"}
              aria-current={activa ? "true" : undefined}
              className={`inline-flex min-h-11 items-center gap-2 rounded-full px-4 font-bold transition-colors ${
                activa
                  ? "bg-selva text-crema"
                  : "border-2 border-selva/25 bg-white text-selva-2 hover:border-selva"
              }`}
            >
              {opcion.nombre}
              <span
                className={`rounded-full px-2 py-0.5 font-mono text-xs ${
                  activa ? "bg-crema/25" : "bg-ink/5 text-cacao/70"
                }`}
              >
                {opcion.cuantas}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Las páginas, cuando hay más de una.
 *
 * Es paginación y no "ver más" acumulativo a propósito: lo que se pedía era
 * dejar de bajar, y cargar más debajo de lo que ya hay alarga justo lo que
 * molesta. Aquí cada página empieza arriba.
 */
export function Paginas({
  pagina,
  paginas,
  sucursal,
}: {
  pagina: number;
  paginas: number;
  sucursal: string | null;
}) {
  if (paginas < 2) return null;

  const enlace = (n: number) =>
    `?${sucursal ? `sucursal=${sucursal}&` : ""}pagina=${n}`;

  return (
    <nav
      aria-label="Páginas de solicitudes"
      className="flex flex-wrap items-center gap-2"
    >
      {Array.from({ length: paginas }, (_, i) => i + 1).map((n) => (
        <Link
          key={n}
          href={enlace(n)}
          aria-current={n === pagina ? "page" : undefined}
          className={`grid size-11 place-items-center rounded-full font-mono font-bold transition-colors ${
            n === pagina
              ? "bg-selva text-crema"
              : "border-2 border-selva/25 bg-white text-selva-2 hover:border-selva"
          }`}
        >
          {n}
        </Link>
      ))}
    </nav>
  );
}
