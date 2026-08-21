"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { perfilActual } from "@/lib/auth/sesion";
import { miSucursal } from "@/lib/datos/sucursales";
import { generarSlug } from "@/lib/tipos";
import { procesarPago, proximoCobro } from "@/lib/pagos";
import { revisarImagen } from "@/lib/imagenes";

export type EstadoAccion = { error?: string; ok?: string };

function texto(datos: FormData, campo: string) {
  const valor = (datos.get(campo)?.toString() ?? "").trim();
  return valor.length > 0 ? valor : null;
}

/** Quien manda la petición, o fuera. */
async function exigirNegocio() {
  const perfil = await perfilActual();

  if (!perfil) redirect("/login");
  if (perfil.rol !== "negocio") redirect("/cuenta");

  return perfil;
}

/** La sucursal debe ser suya. Si no, no existe para efectos prácticos. */
async function exigirSucursalPropia(perfilId: string, sucursalId: string) {
  const sucursal = await miSucursal(perfilId, sucursalId);
  if (!sucursal) redirect("/negocio/panel");
  return sucursal;
}

// ---------------------------------------------------------------------------
// Alta de sucursal
// ---------------------------------------------------------------------------

export async function crearSucursal(
  _previo: EstadoAccion,
  datos: FormData,
): Promise<EstadoAccion> {
  const perfil = await exigirNegocio();
  const nombre = texto(datos, "nombre_sucursal");

  if (!nombre) return { error: "Escribe el nombre de la sucursal." };

  const supabase = await crearClienteServidor();

  const { data: marca } = await supabase
    .from("marcas")
    .select("id, nombre_comercial")
    .eq("perfil_id", perfil.id)
    .limit(1)
    .maybeSingle();

  if (!marca) redirect("/negocio/completar-marca");

  const base = generarSlug(`${marca.nombre_comercial} ${nombre}`) || "micrositio";
  let creada: string | null = null;

  // El slug es único en toda la plataforma, pero RLS no deja ver los borradores
  // ajenos: no se puede consultar si está libre, así que se intenta y se
  // reintenta con sufijo cuando choca.
  for (let intento = 0; intento < 5 && !creada; intento++) {
    const slug = intento === 0 ? base : `${base}-${intento + 1}`;

    const { data, error } = await supabase
      .from("sucursales")
      .insert({ marca_id: marca.id, nombre_sucursal: nombre, slug })
      .select("id")
      .maybeSingle();

    if (data) creada = data.id;
    else if (error?.code !== "23505") {
      return { error: "No se pudo crear la sucursal. Inténtalo de nuevo." };
    }
  }

  if (!creada) {
    return { error: "Ese nombre ya está ocupado. Prueba con otro." };
  }

  revalidatePath("/negocio/panel");
  redirect(`/negocio/panel/sucursal/${creada}`);
}

// ---------------------------------------------------------------------------
// Editor del micrositio
// ---------------------------------------------------------------------------

export async function guardarMicrositio(
  _previo: EstadoAccion,
  datos: FormData,
): Promise<EstadoAccion> {
  const perfil = await exigirNegocio();
  const id = datos.get("sucursal_id")?.toString() ?? "";
  await exigirSucursalPropia(perfil.id, id);

  const nombre = texto(datos, "nombre_sucursal");
  if (!nombre) return { error: "La sucursal necesita un nombre." };

  const supabase = await crearClienteServidor();

  const { error } = await supabase
    .from("sucursales")
    .update({
      nombre_sucursal: nombre,
      acerca_de: texto(datos, "acerca_de"),
      ubicacion_maps_url: texto(datos, "ubicacion_maps_url"),
      whatsapp: texto(datos, "whatsapp"),
      facebook: texto(datos, "facebook"),
      instagram: texto(datos, "instagram"),
      youtube: texto(datos, "youtube"),
      tiktok: texto(datos, "tiktok"),
      correo_contacto: texto(datos, "correo_contacto"),
      telefono: texto(datos, "telefono"),
    })
    .eq("id", id);

  if (error) return { error: "No se pudo guardar. Inténtalo de nuevo." };

  revalidatePath(`/negocio/panel/sucursal/${id}`);
  return { ok: "Cambios guardados." };
}

export async function subirImagen(
  _previo: EstadoAccion,
  datos: FormData,
): Promise<EstadoAccion> {
  const perfil = await exigirNegocio();
  const id = datos.get("sucursal_id")?.toString() ?? "";
  await exigirSucursalPropia(perfil.id, id);

  const campo = datos.get("campo")?.toString();
  if (campo !== "logo" && campo !== "imagen_fondo") {
    return { error: "Imagen no reconocida." };
  }

  const archivo = datos.get("archivo");
  const problemaImagen = revisarImagen(archivo);
  if (problemaImagen) return { error: problemaImagen };

  const imagen = archivo as File;
  const extension = imagen.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const ruta = `${id}/${campo}-${Date.now()}.${extension}`;

  const supabase = await crearClienteServidor();

  // La política de storage exige que la primera carpeta sea una sucursal suya.
  const { error: errorSubida } = await supabase.storage
    .from("micrositios")
    .upload(ruta, imagen, { upsert: true });

  if (errorSubida) {
    return { error: "No se pudo subir la imagen. Inténtalo de nuevo." };
  }

  const { error } = await supabase
    .from("sucursales")
    .update({ [campo]: ruta })
    .eq("id", id);

  if (error) return { error: "La imagen subió pero no se pudo asociar." };

  revalidatePath(`/negocio/panel/sucursal/${id}`);
  return { ok: "Imagen actualizada." };
}

// ---------------------------------------------------------------------------
// Catálogo
// ---------------------------------------------------------------------------

export async function agregarProducto(
  _previo: EstadoAccion,
  datos: FormData,
): Promise<EstadoAccion> {
  const perfil = await exigirNegocio();
  const id = datos.get("sucursal_id")?.toString() ?? "";
  await exigirSucursalPropia(perfil.id, id);

  const nombre = texto(datos, "nombre");
  if (!nombre) return { error: "El producto necesita un nombre." };

  const precioTexto = texto(datos, "precio");
  const precio = precioTexto ? Number(precioTexto) : null;

  if (precio !== null && (Number.isNaN(precio) || precio < 0)) {
    return { error: "El precio no es un número válido." };
  }

  const supabase = await crearClienteServidor();

  const { error } = await supabase.from("productos_servicios").insert({
    sucursal_id: id,
    nombre,
    descripcion: texto(datos, "descripcion"),
    precio,
  });

  if (error) return { error: "No se pudo agregar el producto." };

  revalidatePath(`/negocio/panel/sucursal/${id}`);
  return { ok: "Producto agregado." };
}

export async function eliminarProducto(datos: FormData) {
  const perfil = await exigirNegocio();
  const id = datos.get("sucursal_id")?.toString() ?? "";
  const producto = datos.get("producto_id")?.toString() ?? "";

  await exigirSucursalPropia(perfil.id, id);

  const supabase = await crearClienteServidor();

  await supabase
    .from("productos_servicios")
    .delete()
    .eq("id", producto)
    .eq("sucursal_id", id);

  revalidatePath(`/negocio/panel/sucursal/${id}`);
}

// ---------------------------------------------------------------------------
// Publicar: elegir plan, pagar y entrar a revisión
// ---------------------------------------------------------------------------

export async function publicarSucursal(
  _previo: EstadoAccion,
  datos: FormData,
): Promise<EstadoAccion> {
  const perfil = await exigirNegocio();
  const id = datos.get("sucursal_id")?.toString() ?? "";
  const sucursal = await exigirSucursalPropia(perfil.id, id);

  if (sucursal.estado === "publicado" || sucursal.estado === "pendiente_aprobacion") {
    return { error: "Este micrositio ya está publicado o en revisión." };
  }

  const tierId = Number(datos.get("tier_id")?.toString() ?? "");
  if (!tierId) return { error: "Elige un plan." };

  const supabase = await crearClienteServidor();

  const { data: tier } = await supabase
    .from("tiers")
    .select("id, precio_mensual")
    .eq("id", tierId)
    .maybeSingle();

  if (!tier) return { error: "Ese plan no existe." };

  // Queda en "falta el pago" antes de cobrar: si el cobro se cae a medias, el
  // estado cuenta lo que de verdad pasó y no se pierde el intento.
  await supabase
    .from("sucursales")
    .update({ estado: "pendiente_pago", tier_id: tier.id })
    .eq("id", id);

  const cobro = await procesarPago({
    sucursalId: id,
    tierId: tier.id,
    montoMensual: tier.precio_mensual,
  });

  if (!cobro.ok) {
    revalidatePath(`/negocio/panel/sucursal/${id}`);
    return { error: `No se pudo completar el pago: ${cobro.motivo}` };
  }

  const { error: errorSuscripcion } = await supabase.from("suscripciones").insert({
    sucursal_id: id,
    tier_id: tier.id,
    monto_mensual: tier.precio_mensual,
    fecha_proximo_cobro: proximoCobro().toISOString(),
    metodo_pago_stub: cobro.referencia,
  });

  if (errorSuscripcion) {
    return { error: "El pago pasó pero no se registró la suscripción. Avísanos." };
  }

  // A 'publicado' solo lo mueve un administrador: el trigger de la base lo
  // impide desde aquí aunque se intentara.
  const { error } = await supabase
    .from("sucursales")
    .update({ estado: "pendiente_aprobacion", motivo_rechazo: null })
    .eq("id", id);

  if (error) return { error: "No se pudo enviar a revisión." };

  revalidatePath("/negocio/panel");
  redirect(`/negocio/panel/sucursal/${id}?enviado=1`);
}

// ---------------------------------------------------------------------------
// Galeria del micrositio
// ---------------------------------------------------------------------------

const TOPE_GALERIA = 8;

export async function agregarAGaleria(
  _previo: EstadoAccion,
  datos: FormData,
): Promise<EstadoAccion> {
  const perfil = await exigirNegocio();
  const id = datos.get("sucursal_id")?.toString() ?? "";
  const sucursal = await exigirSucursalPropia(perfil.id, id);

  if (sucursal.galeria.length >= TOPE_GALERIA) {
    return { error: `El carrusel admite hasta ${TOPE_GALERIA} fotos.` };
  }

  const archivo = datos.get("archivo");
  const problemaImagen = revisarImagen(archivo);
  if (problemaImagen) return { error: problemaImagen };

  const imagen = archivo as File;
  const extension = imagen.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const ruta = `${id}/galeria-${Date.now()}.${extension}`;

  const supabase = await crearClienteServidor();

  const { error: errorSubida } = await supabase.storage
    .from("micrositios")
    .upload(ruta, imagen, { upsert: true });

  if (errorSubida) {
    return { error: "No se pudo subir la foto. Inténtalo de nuevo." };
  }

  const { error } = await supabase
    .from("sucursales")
    .update({ galeria: [...sucursal.galeria, ruta] })
    .eq("id", id);

  if (error) return { error: "La foto subió pero no se pudo agregar al carrusel." };

  revalidatePath(`/negocio/panel/sucursal/${id}`);
  return { ok: "Foto agregada." };
}

export async function quitarDeGaleria(datos: FormData) {
  const perfil = await exigirNegocio();
  const id = datos.get("sucursal_id")?.toString() ?? "";
  const ruta = datos.get("ruta")?.toString() ?? "";
  const sucursal = await exigirSucursalPropia(perfil.id, id);

  const supabase = await crearClienteServidor();

  await supabase
    .from("sucursales")
    .update({ galeria: sucursal.galeria.filter((r) => r !== ruta) })
    .eq("id", id);

  // Se borra tambien del bucket: dejarla ahi seria pagar almacenamiento por una
  // imagen que ya nadie va a ver.
  await supabase.storage.from("micrositios").remove([ruta]);

  revalidatePath(`/negocio/panel/sucursal/${id}`);
}

// ---------------------------------------------------------------------------
// Eventos y noticias (solo Tier 3)
// ---------------------------------------------------------------------------

// PENDIENTE (§10): el limite exacto de caracteres esta sin definir. Este es un
// tope de trabajo para que las tarjetas del feed no se desbalanceen.
const TOPE_CONTENIDO = 1500;

function validarPublicacion(datos: FormData) {
  const titulo = texto(datos, "titulo");
  const contenido = texto(datos, "contenido");

  if (!titulo) return { error: "Escribe un título." };
  if (!contenido) return { error: "Escribe el contenido." };
  if (contenido.length > TOPE_CONTENIDO) {
    return { error: `El contenido no puede pasar de ${TOPE_CONTENIDO} caracteres.` };
  }

  return null;
}

/** Traduce a espaniol lo que grita el trigger cuando el tier no alcanza. */
function traducirErrorContenido(mensaje: string) {
  if (mensaje.includes("Tier 3")) {
    return "Publicar eventos y noticias requiere el plan Tier 3.";
  }
  if (mensaje.includes("maximo 1 por semana")) {
    return "Ya tienes un evento esa semana. Solo se permite uno por semana.";
  }
  return "No se pudo publicar. Inténtalo de nuevo.";
}

export async function crearEvento(
  _previo: EstadoAccion,
  datos: FormData,
): Promise<EstadoAccion> {
  const perfil = await exigirNegocio();
  const id = datos.get("sucursal_id")?.toString() ?? "";
  await exigirSucursalPropia(perfil.id, id);

  const problema = validarPublicacion(datos);
  if (problema) return problema;

  const fecha = texto(datos, "fecha_evento");
  if (!fecha) return { error: "Elige la fecha del evento." };

  const rango = texto(datos, "rango_exclusivo");

  const supabase = await crearClienteServidor();

  const { error } = await supabase.from("eventos").insert({
    sucursal_id: id,
    titulo: texto(datos, "titulo"),
    subtitulo: texto(datos, "subtitulo"),
    contenido: texto(datos, "contenido"),
    fecha_evento: new Date(fecha).toISOString(),
    rango_exclusivo: rango ? Number(rango) : null,
  });

  if (error) return { error: traducirErrorContenido(error.message) };

  revalidatePath("/negocio/panel/contenido");
  revalidatePath("/eventos");
  return { ok: "Evento publicado." };
}

export async function crearNoticia(
  _previo: EstadoAccion,
  datos: FormData,
): Promise<EstadoAccion> {
  const perfil = await exigirNegocio();
  const id = datos.get("sucursal_id")?.toString() ?? "";
  await exigirSucursalPropia(perfil.id, id);

  const problema = validarPublicacion(datos);
  if (problema) return problema;

  const supabase = await crearClienteServidor();

  const { error } = await supabase.from("noticias").insert({
    sucursal_id: id,
    titulo: texto(datos, "titulo"),
    subtitulo: texto(datos, "subtitulo"),
    contenido: texto(datos, "contenido"),
  });

  if (error) return { error: traducirErrorContenido(error.message) };

  revalidatePath("/negocio/panel/contenido");
  revalidatePath("/noticias");
  return { ok: "Noticia publicada." };
}
