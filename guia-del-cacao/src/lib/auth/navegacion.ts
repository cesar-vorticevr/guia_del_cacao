import type { Perfil } from "@/lib/auth/sesion";
import { destinoSegunRol } from "@/lib/auth/sesion";

/**
 * Cómo se llama y a dónde lleva la última pestaña de la barra de abajo.
 *
 * Un cliente tiene pasaporte —monedas y rango—; un negocio y un administrador
 * tienen panel. Llamarle "Pasaporte" al panel de un negocio le promete algo
 * que ahí no existe, y fue justo lo que se veía.
 *
 * Vive aparte de los layouts porque lo necesitan los tres: el público, el de
 * negocio y el de administración.
 */
export function pestanaDePerfil(perfil: Perfil | null) {
  if (!perfil) {
    return {
      destino: "/login",
      etiqueta: "Pasaporte",
      icono: "moneda" as const,
    };
  }

  const esCliente = perfil.rol === "cliente";

  return {
    destino: destinoSegunRol(perfil),
    etiqueta: esCliente ? "Pasaporte" : "Perfil",
    icono: esCliente ? ("moneda" as const) : ("persona" as const),
  };
}
