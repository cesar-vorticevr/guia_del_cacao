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

/** Decoración de fondo del sitio público. No lleva contenido ni enlaces. */
export async function FondoDeCacao() {
  return <CapasDeCacao disponibles={await ilustracionesEnDisco()} />;
}
