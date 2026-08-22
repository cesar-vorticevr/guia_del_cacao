"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { perfilActual } from "@/lib/auth/sesion";
import { miSucursal } from "@/lib/datos/sucursales";
import { miCalificacion, miResena } from "@/lib/datos/publico";
import { revisarMedio } from "@/lib/imagenes";

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
      ? "Esta persona ya recibió sus 3 monedas de hoy en tu negocio. Puedes dárselas mañana."
      : "Ya juntaste las 3 monedas que este negocio puede darte hoy. Vuelve mañana.";
  }
  if (mensaje.includes("no otorga puntos")) {
    return "Este negocio todavía no participa en el pasaporte de monedas de chocolate.";
  }
  if (mensaje.includes("no esta publicada")) {
    return "Este micrositio no está disponible.";
  }
  return "No se pudo completar. Inténtalo de nuevo.";
}

/**
 * El cliente escanea el QR, dice qué compró y pide sus monedas.
 *
 * No decide cuántas: eso lo hace la marca al revisar (spec §5.4.5). Lo que sí
 * hace es armar el expediente con el que la marca decide — qué compró, el
 * ticket si lo mandó, y la reseña si la dejó, que es la que vale la segunda
 * moneda.
 */
export async function pedirPuntos(
  _previo: EstadoPuntos,
  datos: FormData,
): Promise<EstadoPuntos> {
  const perfil = await perfilActual();
  const slug = datos.get("slug")?.toString() ?? "";

  if (!perfil) redirect(`/login?volver=/monedas/${slug}`);
  if (perfil.rol !== "cliente") {
    return { error: "Solo las cuentas de cliente juntan monedas de chocolate." };
  }

  const sucursalId = datos.get("sucursal_id")?.toString() ?? "";
  const productos = datos.getAll("producto").map((p) => p.toString());

  if (productos.length === 0) {
    return { error: "Elige al menos una cosa de las que compraste." };
  }

  const supabase = await crearClienteServidor();

  // El comprobante llega por uno de dos campos: el que abre la cámara y el que
  // elige un archivo. Es el mismo dato con dos maneras de darlo, y es opcional:
  // ayuda a que le crean, no es requisito para pedir.
  const archivo = [datos.get("comprobante"), datos.get("comprobante_archivo")].find(
    (valor): valor is File => valor instanceof File && valor.size > 0,
  );

  let comprobante: string | null = null;

  if (archivo) {
    const problema = revisarMedio(archivo);
    if (problema) return { error: problema };

    const extension = archivo.name.split(".").pop()?.toLowerCase() ?? "jpg";
    // La política del bucket exige que las dos primeras carpetas sean quien
    // sube y a quién se lo manda: una por cada lado del mostrador.
    const ruta = `${perfil.id}/${sucursalId}/${Date.now()}.${extension}`;

    const { error } = await supabase.storage.from("comprobantes").upload(ruta, archivo);

    if (error) return { error: "No se pudo subir el comprobante." };

    comprobante = ruta;
  }

  // La reseña es opcional y vale la segunda moneda. Si topa con el tope de un
  // cambio al día, la solicitud sigue adelante valiendo una: sería absurdo
  // tirar toda la compra por un comentario de más.
  //
  // Desde la migración 000017 la reseña y la calificación son una sola por
  // negocio y se actualizan, así que aquí no siempre se inserta: si ya tenía,
  // se corrige lo que tenía.
  const textoResena = (datos.get("resena")?.toString() ?? "").trim();
  const estrellas = Number(datos.get("estrellas"));
  let resenaId: string | null = null;

  if (Number.isInteger(estrellas) && estrellas >= 1 && estrellas <= 5) {
    const nota = await miCalificacion(perfil.id, sucursalId);

    if (nota === null) {
      await supabase
        .from("calificaciones")
        .insert({ usuario_id: perfil.id, sucursal_id: sucursalId, estrellas });
    } else if (nota !== estrellas) {
      await supabase
        .from("calificaciones")
        .update({ estrellas })
        .eq("usuario_id", perfil.id)
        .eq("sucursal_id", sucursalId);
    }
  }

  if (textoResena.length >= 10) {
    const yaTengo = await miResena(perfil.id, sucursalId);

    if (!yaTengo) {
      const { data: resena } = await supabase
        .from("resenas")
        .insert({ usuario_id: perfil.id, sucursal_id: sucursalId, texto: textoResena })
        .select("id")
        .maybeSingle();

      resenaId = resena?.id ?? null;
    } else if (yaTengo.puedeCambiarla) {
      const { error } = await supabase
        .from("resenas")
        .update({ texto: textoResena })
        .eq("id", yaTengo.id)
        .eq("usuario_id", perfil.id);

      // Si el cambio pasó, la reseña cuenta para la segunda moneda igual que
      // una nueva: el negocio recibe una opinión fresca de esta visita.
      if (!error) resenaId = yaTengo.id;
    }
  }

  const { data: solicitud, error } = await supabase
    .from("solicitudes_puntos")
    .insert({
      usuario_id: perfil.id,
      sucursal_id: sucursalId,
      comprobante,
      resena_id: resenaId,
    })
    .select("id")
    .maybeSingle();

  if (error || !solicitud) {
    if (comprobante) await supabase.storage.from("comprobantes").remove([comprobante]);
    return { error: traducir(error?.message ?? "") };
  }

  // Cada producto trae su cantidad en un campo aparte, `cantidad-<id>`. Se
  // acota aquí además del CHECK de la base: si llega basura, más vale registrar
  // una pieza que reventar la solicitud entera después de la compra.
  const lineas = productos.map((producto_id) => {
    const cruda = Number(datos.get(`cantidad-${producto_id}`));
    const cantidad = Number.isFinite(cruda) ? Math.min(99, Math.max(1, Math.trunc(cruda))) : 1;

    return { solicitud_id: solicitud.id, producto_id, cantidad };
  });

  const { error: errorProductos } = await supabase
    .from("solicitud_productos")
    .insert(lineas);

  if (errorProductos) {
    // La solicitud ya existe y sin productos no le sirve a la marca para
    // decidir, así que se deshace en vez de dejarla coja.
    await supabase.from("solicitudes_puntos").delete().eq("id", solicitud.id);
    if (comprobante) await supabase.storage.from("comprobantes").remove([comprobante]);
    return { error: "No se pudo registrar lo que compraste. Inténtalo de nuevo." };
  }

  revalidatePath(`/monedas/${slug}`);
  revalidatePath(`/marca/${slug}`);
  revalidatePath("/cuenta");

  // Se redirige en vez de devolver un mensaje: al revalidar, la página vuelve
  // a renderizarse mostrando "ya tienes una solicitud pendiente" y el
  // formulario —con su mensaje de éxito— desaparece. Justo en el momento del
  // acierto, esa frase se lee como un rechazo.
  redirect(`/monedas/${slug}?enviado=1`);
}

/**
 * La marca resuelve: otorga de 1 a 3 monedas, o rechaza.
 *
 * Cuántas le tocan sale de la solicitud —una por la compra, dos si además dejó
 * reseña— y la tercera es decisión del negocio. El tope diario por marca lo
 * vigila el trigger acreditar_puntos, y el rango del cliente se recalcula solo
 * al aprobar.
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

    revalidatePath("/negocio/panel/monedas");
    return { ok: "Solicitud rechazada." };
  }

  const puntos = Number(decision);
  if (!Number.isInteger(puntos) || puntos < 1 || puntos > 3) {
    return { error: "Se otorgan entre 1 y 3 monedas." };
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

  revalidatePath("/negocio/panel/monedas");
  return { ok: `Listo: ${puntos} ${puntos === 1 ? "moneda otorgada" : "monedas otorgadas"}.` };
}
