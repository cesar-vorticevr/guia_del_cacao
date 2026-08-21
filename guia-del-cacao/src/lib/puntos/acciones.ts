"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { perfilActual } from "@/lib/auth/sesion";
import { miSucursal } from "@/lib/datos/sucursales";

export type EstadoPuntos = { error?: string; ok?: string };

/**
 * Traduce lo que gritan los triggers y los índices de la base.
 *
 * Vale la pena hacerlo con cuidado: estos mensajes los va a leer alguien de pie
 * en un stand de la feria, con el celular en una mano y una bolsa en la otra.
 */
function traducir(mensaje: string, quienLee: "cliente" | "negocio" = "cliente") {
  if (mensaje.includes("solicitud_pendiente_unica")) {
    return "Ya tienes una solicitud pendiente en este negocio. Espera a que la resuelvan.";
  }
  // El mismo error lo pueden ver los dos lados del mostrador, y a cada uno le
  // sirve una frase distinta: al cliente "vuelve mañana", al negocio cuánto le
  // queda por dar.
  if (mensaje.includes("Tope alcanzado")) {
    return quienLee === "negocio"
      ? "Esta persona ya recibió sus 3 puntos de hoy en tu negocio. Puedes dárselos mañana."
      : "Ya juntaste los 3 puntos que este negocio puede darte hoy. Vuelve mañana.";
  }
  if (mensaje.includes("no otorga puntos")) {
    return "Este negocio todavía no participa en el pasaporte de puntos.";
  }
  if (mensaje.includes("no esta publicada")) {
    return "Este micrositio no está disponible.";
  }
  return "No se pudo completar. Inténtalo de nuevo.";
}

/**
 * El cliente escanea el QR, elige qué compró y pide sus puntos.
 *
 * No decide cuántos: eso lo hace la marca al revisar (spec §5.4.5). Aquí solo
 * se deja constancia de la compra.
 */
export async function pedirPuntos(
  _previo: EstadoPuntos,
  datos: FormData,
): Promise<EstadoPuntos> {
  const perfil = await perfilActual();
  const slug = datos.get("slug")?.toString() ?? "";

  if (!perfil) redirect(`/login?volver=/puntos/${slug}`);
  if (perfil.rol !== "cliente") {
    return { error: "Solo las cuentas de cliente juntan puntos." };
  }

  const sucursalId = datos.get("sucursal_id")?.toString() ?? "";
  const productos = datos.getAll("producto").map((p) => p.toString());

  if (productos.length === 0) {
    return { error: "Elige al menos una cosa de las que compraste." };
  }

  const supabase = await crearClienteServidor();

  const { data: solicitud, error } = await supabase
    .from("solicitudes_puntos")
    .insert({ usuario_id: perfil.id, sucursal_id: sucursalId })
    .select("id")
    .maybeSingle();

  if (error || !solicitud) {
    return { error: traducir(error?.message ?? "") };
  }

  const { error: errorProductos } = await supabase
    .from("solicitud_productos")
    .insert(productos.map((producto_id) => ({ solicitud_id: solicitud.id, producto_id })));

  if (errorProductos) {
    // La solicitud ya existe y sin productos no le sirve a la marca para
    // decidir, así que se deshace en vez de dejarla coja.
    await supabase.from("solicitudes_puntos").delete().eq("id", solicitud.id);
    return { error: "No se pudo registrar lo que compraste. Inténtalo de nuevo." };
  }

  revalidatePath(`/puntos/${slug}`);
  revalidatePath("/cuenta");

  // Se redirige en vez de devolver un mensaje: al revalidar, la página vuelve
  // a renderizarse mostrando "ya tienes una solicitud pendiente" y el
  // formulario —con su mensaje de éxito— desaparece. Justo en el momento del
  // acierto, esa frase se lee como un rechazo.
  redirect(`/puntos/${slug}?enviado=1`);
}

/**
 * La marca resuelve: otorga de 1 a 3 puntos, o rechaza.
 *
 * El tope diario por marca lo vigila el trigger acreditar_puntos, y el rango
 * del cliente se recalcula solo al aprobar.
 */
export async function resolverSolicitud(
  _previo: EstadoPuntos,
  datos: FormData,
): Promise<EstadoPuntos> {
  const perfil = await perfilActual();

  if (!perfil) redirect("/login");
  if (perfil.rol !== "negocio") redirect("/cuenta");

  const solicitudId = datos.get("solicitud_id")?.toString() ?? "";
  const sucursalId = datos.get("sucursal_id")?.toString() ?? "";
  const decision = datos.get("decision")?.toString() ?? "";

  // Que la sucursal sea suya se comprueba aquí y además en RLS.
  const sucursal = await miSucursal(perfil.id, sucursalId);
  if (!sucursal) redirect("/negocio/panel");

  const supabase = await crearClienteServidor();

  if (decision === "rechazar") {
    const { error } = await supabase
      .from("solicitudes_puntos")
      .update({ estado: "rechazada", fecha_resolucion: new Date().toISOString() })
      .eq("id", solicitudId)
      .eq("sucursal_id", sucursalId);

    if (error) return { error: traducir(error.message, "negocio") };

    revalidatePath("/negocio/panel/puntos");
    return { ok: "Solicitud rechazada." };
  }

  const puntos = Number(decision);
  if (!Number.isInteger(puntos) || puntos < 1 || puntos > 3) {
    return { error: "Se otorgan entre 1 y 3 puntos." };
  }

  const { error } = await supabase
    .from("solicitudes_puntos")
    .update({
      estado: "aprobada",
      puntos_otorgados: puntos,
      fecha_resolucion: new Date().toISOString(),
    })
    .eq("id", solicitudId)
    .eq("sucursal_id", sucursalId);

  if (error) return { error: traducir(error.message, "negocio") };

  revalidatePath("/negocio/panel/puntos");
  return { ok: `Listo: ${puntos} ${puntos === 1 ? "punto otorgado" : "puntos otorgados"}.` };
}
