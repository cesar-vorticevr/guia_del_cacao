import Link from "next/link";
import { urlImagen } from "@/lib/imagenes";
import { Promedio } from "@/components/publico/estrellas";
import { tonoDeCategoria } from "@/lib/paleta";
import type { TarjetaDirectorio } from "@/lib/datos/publico";
import { BotonFavorito } from "@/components/publico/boton-favorito";
import { FUNCIONES } from "@/lib/funciones";

/**
 * Tarjeta del directorio. El Tier 3 se distingue, porque parte de lo que paga
 * es salir arriba.
 *
 * Y los que dan mazorcas llevan la suya al lado del nombre: al explorar, lo
 * primero que se busca es dónde vale la pena entrar con el pasaporte a medias.
 * Sin la marca había que abrir uno por uno para averiguarlo.
 *
 * La sombra dura y el salto al pasar el dedo son a propósito: la tarjeta tiene
 * que sentirse un objeto que se puede empujar, no un rectángulo pintado.
 */
export function TarjetaSucursal({
  sucursal,
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
  favorito?: boolean;
  puedeGuardar?: boolean;
  haySesion?: boolean;
  conCorazon?: boolean;
}) {
  const logo = urlImagen(sucursal.logo);
  const destacada = sucursal.tier_id === 3;
  const daMazorcas =
    FUNCIONES.mazorcas && (sucursal.tiers?.puede_dar_puntos ?? false);
  const tono = tonoDeCategoria(sucursal.marcas?.categoria_id);

  return (
    /*
      `relative` porque el corazón flota sobre la esquina de la tarjeta. Va
      fuera del `Link` —hermano, no hijo— porque un botón dentro de un enlace
      es HTML inválido y los lectores de pantalla lo anuncian mal.
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
        /*
          `pr-14` cuando hay corazón: flota sobre la esquina, y sin ese hueco
          el nombre del negocio se le mete debajo. Se le quita el padding
          derecho normal para no sumar los dos.
        */
        className={`flex h-full gap-4 rounded-3xl border-2 bg-white p-5 shadow-dura transition-all hover:-translate-y-0.5 hover:shadow-dura-alta ${
          conCorazon ? "pr-14" : ""
        } ${
          destacada ? "border-mango" : "border-ink/10"
        }`}
      >
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logo}
            alt=""
            className="size-16 shrink-0 rounded-2xl border-2 border-selva/10 object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className={`grid size-16 shrink-0 place-items-center rounded-2xl font-display text-2xl ${tono.suave}`}
          >
            {sucursal.nombre_sucursal.charAt(0)}
          </span>
        )}

        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-display text-lg font-semibold text-selva-2">
              {sucursal.marcas?.nombre_comercial}
            </span>

            {daMazorcas && (
              /*
                La mazorca ilustrada y no un icono de trazo: es la misma que se
                junta y la misma del logotipo, así que se reconoce sin leyenda.
                El `title` y el texto oculto la explican a quien la ve por
                primera vez y a quien usa lector de pantalla.
              */
              <span
                title="Aquí puedes pedir mazorcas de cacao"
                className="inline-flex items-center gap-1 rounded-full bg-mango/25 px-2 py-0.5"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/marca/mazorca.png" alt="" className="size-4" />
                <span className="font-mono text-[0.65rem] font-bold text-cacao">
                  Da mazorcas
                </span>
              </span>
            )}
          </span>

          <span className="flex items-center gap-1.5 text-sm text-cacao/80">
            <span
              aria-hidden="true"
              className={`size-2 shrink-0 rounded-full ${tono.punto}`}
            />
            {sucursal.nombre_sucursal}
          </span>

          {/*
            Dónde está, debajo del nombre. En una guía de un solo estado era
            obvio y sobraba; en una nacional es la primera pregunta de quien
            mira la lista, y sin ella cada tarjeta obliga a entrar para saber
            si queda cerca.
          */}
          <span className="block text-sm text-cacao/70">
            {sucursal.ciudad ? `${sucursal.ciudad}, ` : ""}
            {sucursal.entidad}
          </span>

          {sucursal.calificacion && (
            <span className="mt-1 block">
              <Promedio
                promedio={sucursal.calificacion.promedio}
                total={sucursal.calificacion.total}
              />
            </span>
          )}

          {sucursal.acerca_de && (
            <span className="mt-1.5 line-clamp-2 block text-cacao">
              {sucursal.acerca_de}
            </span>
          )}

          {destacada && (
            <span className="mt-2 inline-block rounded-full bg-mango px-3 py-1 font-mono text-xs font-bold text-ink">
              Destacado
            </span>
          )}
        </span>
      </Link>
    </li>
  );
}
