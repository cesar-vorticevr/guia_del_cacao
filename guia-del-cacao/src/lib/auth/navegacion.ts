import type { Perfil } from "@/lib/auth/sesion";
import { destinoSegunRol } from "@/lib/auth/sesion";

/**
 * Cómo se llama y a dónde lleva la última pestaña de la barra de abajo.
 *
 * Un cliente junta mazorcas y sube de rango; un negocio y un administrador
 * tienen panel. Llamarle "Mi cacao" al panel de un negocio le promete algo
 * que ahí no existe, y fue justo lo que se veía.
 *
 * Vive aparte de los layouts porque lo necesitan los tres: el público, el de
 * negocio y el de administración.
 */
export function pestanaDePerfil(perfil: Perfil | null) {
  if (!perfil) {
    return {
      destino: "/login",
      etiqueta: "Mi cacao",
      icono: "mazorca" as const,
    };
  }

  const esCliente = perfil.rol === "cliente";

  return {
    destino: destinoSegunRol(perfil),
    etiqueta: esCliente ? "Mi cacao" : "Perfil",
    icono: esCliente ? ("mazorca" as const) : ("persona" as const),
  };
}
