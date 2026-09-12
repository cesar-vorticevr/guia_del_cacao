import type { Perfil } from "@/lib/auth/sesion";
import { destinoSegunRol } from "@/lib/auth/sesion";

/**
 * Cómo se llama y a dónde lleva la última pestaña de la barra de abajo.
 *
 * Un negocio y un administrador tienen panel; un visitante tiene su cuenta, y
 * quien no ha entrado tiene la puerta. Cada uno se llama por lo que hay
 * detrás: prometer otra cosa fue justo lo que se veía antes.
 *
 * Vive aparte de los layouts porque lo necesitan los tres: el público, el de
 * negocio y el de administración.
 */
export function pestanaDePerfil(perfil: Perfil | null) {
  /*
    A quien no ha entrado, la pestaña le dice "Entrar", que es lo que hace.
    Decía "Mi cacao" —el nombre que tenía la cuenta del cliente cuando juntaba
    mazorcas—, así que en celular, sin sesión, la barra ofrecía un cacao que no
    era de nadie y que además ya no existe.
  */
  if (!perfil) {
    return {
      destino: "/login",
      etiqueta: "Entrar",
      icono: "persona" as const,
    };
  }

  /*
    Y la del cliente pasa a "Mi cuenta". Sin mazorcas ni rangos, "Mi cacao" no
    nombraba nada de lo que hay dentro: sus datos, su contraseña y su sesión.
  */
  return {
    destino: destinoSegunRol(perfil),
    etiqueta: perfil.rol === "cliente" ? "Mi cuenta" : "Perfil",
    icono: "persona" as const,
  };
}
