import { redirect } from "next/navigation";
import { FUNCIONES } from "@/lib/funciones";

/**
 * Las noticias dejaron de ser una cosa aparte.
 *
 * Desde la migración 000029 son publicaciones de la comunidad firmadas por una
 * sucursal, así que su lista vive en el muro. Esto se queda como puerta para
 * los enlaces guardados.
 */
export default function Noticias() {
  redirect(FUNCIONES.comunidad ? "/comunidad" : "/directorio");
}
