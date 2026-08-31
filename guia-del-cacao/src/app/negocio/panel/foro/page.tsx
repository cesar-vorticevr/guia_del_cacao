import { redirect } from "next/navigation";

/**
 * El foro y las noticias ya no viven en el panel: se publican en la comunidad,
 * que es donde se leen. Esto se queda como puerta para los enlaces guardados.
 */
export default function ForoDelPanel() {
  redirect("/comunidad");
}
