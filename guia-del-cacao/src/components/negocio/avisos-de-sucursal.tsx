import { abrirResenas } from "@/lib/negocio/acciones";
import { IconoCampana } from "@/components/iconos";

/**
 * Los dos avisos de una sucursal: reseñas nuevas y solicitudes de mazorcas.
 *
 * **Solo aparecen cuando hay algo.** Un icono permanente deja de mirarse: si la
 * campana está siempre ahí, su presencia no dice nada y hay que leer el número
 * para saber si pasa algo. Apareciendo solo cuando hay, el icono *es* la
 * noticia.
 *
 * Los dos se distinguen a propósito:
 *
 * - La campana **se apaga al abrirla**: leer una reseña es atenderla.
 * - La mazorca **se queda mientras la solicitud siga sin resolver**, aunque ya se
 *   haya visto; lo que se apaga al entrar es el destello de "nueva". Una
 *   solicitud vista pero sin contestar sigue siendo trabajo pendiente, y
 *   apagarle el aviso la haría desaparecer de la vista.
 */
export function AvisosDeSucursal({
  slug,
  resenasNuevas,
  solicitudesPendientes,
  solicitudesNuevas,
}: {
  slug: string;
  resenasNuevas: number;
  solicitudesPendientes: number;
  solicitudesNuevas: number;
}) {
  if (resenasNuevas === 0 && solicitudesPendientes === 0) return null;

  return (
    <div className="flex items-center gap-2">
      {resenasNuevas > 0 && (
        <form action={abrirResenas}>
          <input type="hidden" name="slug" value={slug} />
          <button
            type="submit"
            aria-label={`Ver ${resenasNuevas} ${resenasNuevas === 1 ? "reseña nueva" : "reseñas nuevas"}`}
            className="relative grid size-11 place-items-center rounded-full border-2 border-mango bg-mango/15 text-selva-2 transition-colors hover:bg-mango/30"
          >
            <IconoCampana className="size-5" />
            <span
              aria-hidden="true"
              className="absolute -top-1.5 -right-1.5 grid size-6 place-items-center rounded-full bg-guayaba font-mono text-xs font-bold text-ink"
            >
              {resenasNuevas}
            </span>
          </button>
        </form>
      )}

      {solicitudesPendientes > 0 && (
        <a
          /*
            A la pantalla de monedas, no a `?ver=mazorcas`: esa sección no existe
            dentro del panel —Mazorcas es una página propia— y el enlace dejaba a
            la persona donde ya estaba, con el aviso encendido y sin entender por
            qué no pasaba nada.
          */
          href="/negocio/panel/monedas"
          aria-label={`${solicitudesPendientes} ${solicitudesPendientes === 1 ? "solicitud de mazorcas" : "solicitudes de mazorcas"} sin resolver${solicitudesNuevas > 0 ? `, ${solicitudesNuevas} sin ver` : ""}`}
          className="relative grid size-11 place-items-center rounded-full border-2 border-selva/25 bg-white transition-colors hover:border-selva"
        >
          {/* La mazorca ilustrada y no el icono de trazo: dibujada a una línea
              se leía como un círculo cualquiera, y aquí lo que tiene que
              reconocerse de reojo es que hay una mazorca esperando. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/marca/mazorca.png"
            alt=""
            className="size-6"
          />

          {/*
            El destello solo cuando hay alguna que no se ha visto. Si latiera
            siempre que hay pendientes, el movimiento dejaría de significar
            "llegó algo" y pasaría a ser el estado normal de la pantalla.
          */}
          <span
            aria-hidden="true"
            className={`absolute -top-1.5 -right-1.5 grid size-6 place-items-center rounded-full font-mono text-xs font-bold ${
              solicitudesNuevas > 0
                ? "animate-pulse bg-guayaba text-ink motion-reduce:animate-none"
                : "bg-cacao/70 text-crema"
            }`}
          >
            {solicitudesPendientes}
          </span>
        </a>
      )}
    </div>
  );
}
