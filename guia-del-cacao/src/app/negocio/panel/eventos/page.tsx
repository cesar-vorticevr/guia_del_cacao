import { redirect } from "next/navigation";

/**
 * Los eventos ya no viven en el panel.
 *
 * Se manejan en la agenda, que es donde se leen: editarlos en un cuarto aparte
 * obligaba a salir del sitio público para escribir sobre él. Esto se queda como
 * puerta para los enlaces que alguien haya guardado.
 */
export default function EventosDelPanel() {
  redirect("/eventos");
}
