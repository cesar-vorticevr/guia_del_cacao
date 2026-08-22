/**
 * Un color por categoría de negocio.
 *
 * El sitio venía casi todo en verde selva sobre crema, con mango, guayaba y
 * turquesa guardados para algún acento suelto. Darle su color a cada categoría
 * es lo que vuelve tropical al directorio sin inventar tonos nuevos: la fila de
 * filtros pasa a ser una fila de colores, y de paso se distingue de un vistazo
 * qué tipo de negocio es cada tarjeta.
 *
 * El orden sigue al del catálogo (migración `catalogos`): finca, comercializadora,
 * chocolatería, museo, artesanías, otros. La chocolatería es cacao a propósito.
 *
 * Se indexa por id y da la vuelta cuando se acaban los tonos, así que una
 * categoría nueva no rompe nada: repite color, no se queda gris.
 *
 * Las clases van escritas completas —nada de `bg-${x}`— porque Tailwind lee el
 * archivo como texto y no genera lo que no encuentra tal cual.
 */

export type Tono = {
  /** Color pleno, para el estado activo y los acentos que deben gritar. */
  solido: string;
  /** El mismo color en voz baja, para reposo y fondos grandes. */
  suave: string;
  /** Solo el color, sin texto: para puntos, barritas y bordes. */
  punto: string;
};

const TONOS: Tono[] = [
  { solido: "bg-lima text-ink", suave: "bg-lima/25 text-selva-2", punto: "bg-lima" },
  {
    solido: "bg-turquesa text-ink",
    suave: "bg-turquesa/20 text-selva-2",
    punto: "bg-turquesa",
  },
  { solido: "bg-cacao text-crema", suave: "bg-cacao/15 text-cacao", punto: "bg-cacao" },
  { solido: "bg-mango text-ink", suave: "bg-mango/25 text-cacao", punto: "bg-mango" },
  {
    solido: "bg-guayaba text-ink",
    suave: "bg-guayaba/20 text-cacao",
    punto: "bg-guayaba",
  },
  { solido: "bg-selva text-crema", suave: "bg-selva/15 text-selva-2", punto: "bg-selva" },
];

/** El tono de una categoría. Sin categoría (o con una desconocida), verde selva. */
export function tonoDeCategoria(categoriaId: number | null | undefined): Tono {
  if (!categoriaId || categoriaId < 1) return TONOS[TONOS.length - 1];
  return TONOS[(categoriaId - 1) % TONOS.length];
}
