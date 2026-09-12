"use server";

import { perfilActual } from "@/lib/auth/sesion";
import { muroDeComunidad, type Filtro, type Pagina } from "@/lib/datos/comunidad";

/**
 * El siguiente tramo del muro, para el scroll infinito.
 *
 * Va por acción de servidor y no por una ruta de API porque no hace falta un
 * endpoint público: esto solo lo llama el muro, y así la sesión se lee del mismo
 * sitio que en el resto del sitio en vez de reconstruirla a mano.
 *
 * El filtro se valida aquí aunque lo mande el propio muro: es una entrada del
 * cliente, y una entrada del cliente se comprueba siempre.
 */
export async function masDelMuro(
  filtro: string,
  cursor: string | null,
): Promise<Pagina> {
  const valido: Filtro =
    filtro === "mias" || filtro === "nuevos" ? filtro : "todo";

  const perfil = await perfilActual();

  // Sin sesión no hay "mías" ni "comentarios nuevos" que mostrar, así que se
  // cae a "todo" en vez de devolver una lista vacía sin explicación.
  const conSesion = perfil ? valido : "todo";

  return muroDeComunidad(perfil?.id, conSesion, cursor ?? undefined);
}
