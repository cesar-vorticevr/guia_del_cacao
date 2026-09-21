import { redirect } from "next/navigation";
import { perfilActual } from "@/lib/auth/sesion";
import { construirFormato } from "@/lib/negocio/formato-catalogo";

/**
 * El formato de catálogo en blanco, listo para llenarse en Excel.
 *
 * Se arma en el servidor y no en el navegador, al revés que el cartel del
 * mostrador y el catálogo en PDF. Aquellos cargan las fotos que el negocio
 * subió —hasta 5 MB cada una— y por eso se hacen donde están; este no lleva ni
 * una imagen: son cuatro encabezados y un texto, pesa unos kilobytes, y
 * mandarle al navegador una librería de Excel entera para escribirlos sería
 * cargar el panel con casi un mega que la mayoría no va a usar.
 *
 * El contenido lo pone `construirFormato`. Aquí solo queda quién puede pedirlo
 * y cómo se entrega.
 */
export async function GET() {
  const perfil = await perfilActual();

  // El formato no lleva datos de nadie, pero tampoco tiene por qué servirse a
  // quien no está dando de alta un catálogo.
  if (!perfil) redirect("/login");
  if (perfil.rol !== "negocio") redirect("/cuenta");

  return new Response(await construirFormato(), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        'attachment; filename="formato-catalogo-guia-del-cacao.xlsx"',
      // No se cachea: las columnas cambian con la plataforma, y un formato
      // viejo guardado en el navegador se sube y ya no se puede leer.
      "Cache-Control": "no-store",
    },
  });
}
