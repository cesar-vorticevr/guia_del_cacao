import Link from "next/link";
import { urlImagen } from "@/lib/imagenes";
import { Promedio } from "@/components/publico/estrellas";
import { tonoDeCategoria } from "@/lib/paleta";
import type { TarjetaDirectorio } from "@/lib/datos/publico";
import type { ProductoBuscable } from "@/lib/datos/busqueda-de-productos";
import { BotonFavorito } from "@/components/publico/boton-favorito";
import { FUNCIONES } from "@/lib/funciones";

/**
 * Tarjeta del directorio. El Tier 3 se distingue, porque parte de lo que paga
 * es salir arriba.
 *
 * **La foto manda.** Antes era horizontal: un logo de 64 px a la izquierda y el
 * texto a la derecha. Quien explora un directorio de chocolate decide con los
 * ojos, y un logo pequeño no vende nada — la portada del micrositio sí, que es
 * una foto del local, de las barras o de la finca. En vertical, la foto ocupa
 * el ancho entero y aun así caben cuatro tarjetas por fila en un monitor.
 *
 * El logo no desaparece: baja a una pastilla encima de la foto, que es donde se
 * reconoce la marca sin robarle sitio a la imagen.
 *
 * La sombra dura y el salto al pasar el dedo son a propósito: la tarjeta tiene
 * que sentirse un objeto que se puede empujar, no un rectángulo pintado.
 */
export function TarjetaSucursal({
  sucursal,
  /**
   * El producto por el que salió en una búsqueda, si fue un producto lo que la
   * trajo. Buscar "molinillo" y recibir seis negocios sin decir cuál lo tiene
   * obliga a entrar en los seis para averiguarlo.
   */
  producto = null,
  /** Si quien mira ya lo tiene guardado. Sin sesión de cliente, siempre false. */
  favorito = false,
  /** Si esta cuenta puede guardar: hay sesión y es de visitante. */
  puedeGuardar = false,
  /** Para distinguir "entra a tu cuenta" de "tu cuenta no guarda favoritos". */
  haySesion = false,
  /** El corazón sobra donde toda la lista ya son favoritos. */
  conCorazon = true,
}: {
  sucursal: TarjetaDirectorio;
  producto?: ProductoBuscable | null;
  favorito?: boolean;
  puedeGuardar?: boolean;
  haySesion?: boolean;
  conCorazon?: boolean;
}) {
  const logo = urlImagen(sucursal.logo);
  const portada = urlImagen(sucursal.imagen_fondo);
  const destacada = sucursal.tier_id === 3;
  const daMazorcas =
    FUNCIONES.mazorcas && (sucursal.tiers?.puede_dar_puntos ?? false);
  const tono = tonoDeCategoria(sucursal.marcas?.categoria_id);

  /*
    A qué se dedica, que puede ser a varias cosas. La principal va primera
    porque es la que da el color de la tarjeta; las demás la acompañan.
  */
  const oficios = sucursal.marcas?.categorias ?? [];

  return (
    /*
      `relative` porque el corazón flota sobre la esquina de la foto. Va fuera
      del `Link` —hermano, no hijo— porque un botón dentro de un enlace es HTML
      inválido y los lectores de pantalla lo anuncian mal.
    */
    <li className="relative">
      {conCorazon && (
        <BotonFavorito
          sucursalId={sucursal.id}
          nombre={sucursal.marcas?.nombre_comercial ?? sucursal.nombre_sucursal}
          inicial={favorito}
          puedeGuardar={puedeGuardar}
          haySesion={haySesion}
          flotante
        />
      )}

      <Link
        href={`/marca/${sucursal.slug}`}
        className={`flex h-full flex-col overflow-hidden rounded-3xl border-2 bg-white shadow-dura transition-all hover:-translate-y-0.5 hover:shadow-dura-alta ${
          destacada ? "border-mango" : "border-ink/10"
        }`}
      >
        {/*
          4:3 y no cuadrada: las portadas se suben apaisadas —son fotos de un
          local o de una finca— y recortarlas a cuadro les corta los lados, que
          es justo donde está el sitio.
        */}
        <span className="relative block aspect-[4/3] w-full shrink-0 bg-crema-2">
          {portada ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={portada}
              alt=""
              loading="lazy"
              className="size-full object-cover"
            />
          ) : (
            /*
              Sin portada, el hueco lleva el color de su categoría y la inicial,
              no un icono de "imagen rota": la tarjeta sigue siendo reconocible
              y no parece averiada.
            */
            <span
              aria-hidden="true"
              className={`grid size-full place-items-center font-display text-5xl ${tono.suave}`}
            >
              {sucursal.nombre_sucursal.charAt(0)}
            </span>
          )}

          {logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logo}
              alt=""
              loading="lazy"
              className="absolute bottom-2 left-2 size-11 rounded-2xl border-2 border-white bg-white object-cover shadow-dura-sm"
            />
          )}

          {destacada && (
            <span className="absolute left-2 top-2 rounded-full bg-mango px-2.5 py-1 font-mono text-[0.65rem] font-bold text-ink">
              Destacado
            </span>
          )}
        </span>

        <span className="flex min-w-0 flex-1 flex-col gap-1 p-4">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="font-display text-base leading-tight font-semibold text-selva-2">
              {sucursal.marcas?.nombre_comercial}
            </span>

            {daMazorcas && (
              /*
                La mazorca ilustrada y no un icono de trazo: es la misma que se
                junta y la misma del logotipo, así que se reconoce sin leyenda.
              */
              <span
                title="Aquí puedes pedir mazorcas de cacao"
                className="inline-flex items-center rounded-full bg-mango/25 px-1.5 py-0.5"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/marca/mazorca.png" alt="" className="size-3.5" />
              </span>
            )}
          </span>

          <span className="text-sm text-cacao/80">{sucursal.nombre_sucursal}</span>

          {/*
            Dónde está. En una guía de un solo estado era obvio; en una nacional
            es la primera pregunta de quien mira la lista.
          */}
          <span className="text-sm text-cacao/60">
            {sucursal.ciudad ? `${sucursal.ciudad}, ` : ""}
            {sucursal.entidad}
          </span>

          {/*
            A qué se dedica, en pastillas pequeñas. Un negocio puede ser finca,
            museo y taller a la vez, y enseñar solo una lo vendía por menos de
            lo que es. Se cortan en tres: la cuarta ya no cabe en el ancho de
            una tarjeta de cuatro por fila, y el resto se cuenta.
          */}
          {oficios.length > 0 && (
            <span className="mt-0.5 flex flex-wrap gap-1">
              {oficios.slice(0, 3).map((oficio) => (
                <span
                  key={oficio.id}
                  className={`rounded-full px-2 py-0.5 text-[0.7rem] font-bold ${
                    tonoDeCategoria(oficio.id).suave
                  }`}
                >
                  {oficio.nombre}
                </span>
              ))}
              {oficios.length > 3 && (
                <span className="px-1 py-0.5 text-[0.7rem] font-bold text-cacao/60">
                  +{oficios.length - 3}
                </span>
              )}
            </span>
          )}

          {sucursal.calificacion && (
            <span className="mt-0.5 block">
              <Promedio
                promedio={sucursal.calificacion.promedio}
                total={sucursal.calificacion.total}
              />
            </span>
          )}

          {/*
            El producto encontrado sustituye al "acerca de", no se suma: quien
            buscó "molinillo" quiere saber que aquí lo hay, no leer la historia
            de la finca.

            **Sin precio, a propósito.** Cinco negocios venden el mismo
            molinillo, y con el precio al lado la lista se vuelve un comparador
            donde gana el más barato — que es el dolor que dos de cada cinco
            encuestados pusieron entre sus dos mayores dificultades. El precio
            está en el micrositio, con la foto y quién lo hizo.
          */}
          {producto ? (
            <span className="mt-auto pt-1.5 text-sm text-cacao">
              Tiene{" "}
              <span className="font-bold text-selva-2">{producto.nombre}</span>
            </span>
          ) : (
            sucursal.acerca_de && (
              <span className="mt-auto line-clamp-2 pt-1.5 text-sm text-cacao">
                {sucursal.acerca_de}
              </span>
            )
          )}
        </span>
      </Link>
    </li>
  );
}
