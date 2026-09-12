import { readdir } from "node:fs/promises";
import path from "node:path";
import { CapasDeCacao } from "@/components/publico/fondo-cacao-capas";

const CARPETA = path.join(process.cwd(), "public", "parallax");

/**
 * Qué ilustraciones existen ya en disco.
 *
 * Se mira la carpeta en vez de llevar una lista a mano para que basta con
 * dejar el PNG ahí y recargar: mientras un archivo no esté, su capa se pinta
 * con un marcador de color y el movimiento se puede ajustar igual. La carpeta
 * puede no existir todavía, y eso no es un error.
 */
async function ilustracionesEnDisco(): Promise<string[]> {
  try {
    const archivos = await readdir(CARPETA);
    return archivos.filter((nombre) => nombre.endsWith(".png"));
  } catch {
    return [];
  }
}

/**
 * Decoración de fondo. No lleva contenido ni enlaces.
 *
 * Dejó de acompañar a todo el sitio: ahora se pide donde hace falta, y hoy eso
 * es una sola franja de la portada. Detrás de cada página el movimiento competía
 * con lo que se venía a leer, y la portada rediseñada se apoya en el aire, no en
 * la textura. Quien lo use en `franja` debe ser `relative` y recortar el
 * desborde; el fondo se mide contra esa caja.
 */
export async function FondoDeCacao({
  variante = "pantalla",
  /**
   * Deja fuera la pieza que pasa por detrás del texto y conserva solo las que
   * se asoman por la orilla. Es lo que hace que el encabezado de la portada
   * pueda tener cacao sin leerse sobre una rama.
   */
  soloOrillas = false,
}: {
  variante?: "pantalla" | "franja";
  soloOrillas?: boolean;
}) {
  return (
    <CapasDeCacao
      disponibles={await ilustracionesEnDisco()}
      variante={variante}
      soloOrillas={soloOrillas}
    />
  );
}
