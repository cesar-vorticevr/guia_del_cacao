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

  // La foto es opcional: un campo de archivo vacío llega como un File de 0
  // bytes, no como null, así que se mira el tamaño y no la existencia.
  const archivo = datos.get("imagen");
  let imagen: string | null = null;

  if (archivo instanceof File && archivo.size > 0) {
    const problema = revisarImagen(archivo);
    if (problema) return { error: problema };

    const extension = archivo.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const ruta = `${id}/producto-${Date.now()}.${extension}`;

    const { error: errorSubida } = await supabase.storage
      .from("micrositios")
      .upload(ruta, archivo);

    if (errorSubida) {
      return { error: "No se pudo subir la foto del producto. Inténtalo de nuevo." };
    }

    imagen = ruta;
  }

  const { error } = await supabase.from("productos_servicios").insert({
    sucursal_id: id,
    nombre,
    descripcion: texto(datos, "descripcion"),
    precio,
    imagen,
  });

  if (error) {
    // Sin esto quedaría una foto huérfana en el bucket cada vez que falla.
    if (imagen) await supabase.storage.from("micrositios").remove([imagen]);
    return { error: "No se pudo agregar el producto." };
  }

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

  // Con la suscripción activa el micrositio se publica solo: desde la
  // migración 000012 la puerta del directorio la abre el pago y no una
  // revisión. El trigger de la base vuelve a exigir esa suscripción, así que
  // esto no es la única barrera.
  const { error } = await supabase
    .from("sucursales")
    .update({ estado: "publicado", motivo_rechazo: null })
    .eq("id", id);

  if (error) return { error: "El pago pasó pero no se pudo publicar. Avísanos." };

  revalidatePath("/negocio/panel");
  redirect(`/negocio/panel/sucursal/${id}?publicado=1`);
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

  const lugares = TOPE_GALERIA - sucursal.galeria.length;

  if (lugares <= 0) {
    return { error: `El carrusel admite hasta ${TOPE_GALERIA} fotos.` };
  }

  // Se eligen varias de un jalón: subir ocho fotos de una en una es de las
  // cosas que hacen que un negocio deje el micrositio a medias.
  const archivos = datos
    .getAll("archivo")
    .filter((valor): valor is File => valor instanceof File && valor.size > 0);

  if (archivos.length === 0) return { error: "Elige al menos una imagen." };

  if (archivos.length > lugares) {
    return {
      error:
        lugares === 1
          ? `Solo te queda lugar para 1 foto más y elegiste ${archivos.length}.`
          : `Solo te quedan ${lugares} lugares y elegiste ${archivos.length}.`,
    };
  }

  // Se revisan todas antes de subir ninguna: si la sexta pesa de más, más vale
  // decirlo antes que dejar cinco arriba y la mitad del trabajo hecho.
  for (const imagen of archivos) {
    const problema = revisarImagen(imagen);
    if (problema) return { error: `${imagen.name}: ${problema}` };
  }

  const supabase = await crearClienteServidor();
  const subidas: string[] = [];

  for (const [indice, imagen] of archivos.entries()) {
    const extension = imagen.name.split(".").pop()?.toLowerCase() ?? "jpg";
    // El índice va en el nombre porque varias subidas del mismo lote comparten
    // el milisegundo y se pisarían entre ellas.
    const ruta = `${id}/galeria-${Date.now()}-${indice}.${extension}`;

    const { error } = await supabase.storage
      .from("micrositios")
      .upload(ruta, imagen, { upsert: true });

    if (error) {
      // Lo que ya subió de este lote se retira: media galería a medias es peor
      // que ninguna, porque nadie sabe cuáles entraron.
      if (subidas.length > 0) {
        await supabase.storage.from("micrositios").remove(subidas);
      }
      return { error: `No se pudo subir ${imagen.name}. Inténtalo de nuevo.` };
    }

    subidas.push(ruta);
  }

  const { error } = await supabase
    .from("sucursales")
    .update({ galeria: [...sucursal.galeria, ...subidas] })
    .eq("id", id);

  if (error) {
    await supabase.storage.from("micrositios").remove(subidas);
    return { error: "Las fotos subieron pero no se pudieron agregar al carrusel." };
  }

  revalidatePath(`/negocio/panel/sucursal/${id}`);

  return {
    ok: subidas.length === 1 ? "Foto agregada." : `${subidas.length} fotos agregadas.`,
  };
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

/**
 * Sube la foto de portada de un evento o una noticia, si viene alguna.
 *
 * Devuelve el arreglo que espera la columna `imagenes`: vacío cuando no hay
 * foto. Es un arreglo y no una columna suelta porque el esquema ya preveía
 * varias; hoy la interfaz solo pide una y usa la primera como portada.
 */
async function subirPortada(
  supabase: Awaited<ReturnType<typeof crearClienteServidor>>,
  sucursalId: string,
  archivo: FormDataEntryValue | null,
  clase: "evento" | "noticia",
): Promise<{ error: string } | { imagenes: string[] }> {
  if (!(archivo instanceof File) || archivo.size === 0) return { imagenes: [] };

  const problema = revisarImagen(archivo);
  if (problema) return { error: problema };

  const extension = archivo.name.split(".").pop()?.toLowerCase() ?? "jpg";
  // La política de storage exige que la primera carpeta sea una sucursal suya.
  const ruta = `${sucursalId}/${clase}-${Date.now()}.${extension}`;

  const { error } = await supabase.storage.from("micrositios").upload(ruta, archivo);

  if (error) return { error: "No se pudo subir la foto. Inténtalo de nuevo." };

  return { imagenes: [ruta] };
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

  const portada = await subirPortada(supabase, id, datos.get("imagen"), "evento");
  if ("error" in portada) return portada;

  const { error } = await supabase.from("eventos").insert({
    sucursal_id: id,
    titulo: texto(datos, "titulo"),
    subtitulo: texto(datos, "subtitulo"),
    contenido: texto(datos, "contenido"),
    imagenes: portada.imagenes,
    fecha_evento: new Date(fecha).toISOString(),
    rango_exclusivo: rango ? Number(rango) : null,
  });

  if (error) {
    // Sin esto quedaría una foto huérfana en el bucket cada vez que el trigger
    // del Tier rechaza la publicación.
    if (portada.imagenes.length > 0) {
      await supabase.storage.from("micrositios").remove(portada.imagenes);
    }
    return { error: traducirErrorContenido(error.message) };
  }

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

  const portada = await subirPortada(supabase, id, datos.get("imagen"), "noticia");
  if ("error" in portada) return portada;

  const { error } = await supabase.from("noticias").insert({
    sucursal_id: id,
    titulo: texto(datos, "titulo"),
    subtitulo: texto(datos, "subtitulo"),
    contenido: texto(datos, "contenido"),
    imagenes: portada.imagenes,
  });

  if (error) {
    if (portada.imagenes.length > 0) {
      await supabase.storage.from("micrositios").remove(portada.imagenes);
    }
    return { error: traducirErrorContenido(error.message) };
  }

  revalidatePath("/negocio/panel/contenido");
  revalidatePath("/noticias");
  return { ok: "Noticia publicada." };
}

// ---------------------------------------------------------------------------
// Mantenimiento de lo ya publicado
// ---------------------------------------------------------------------------

/** Las dos tablas que comparten forma; se distinguen por el nombre. */
type Clase = "evento" | "noticia";

const TABLA: Record<Clase, "eventos" | "noticias"> = {
  evento: "eventos",
  noticia: "noticias",
};

function claseDe(datos: FormData): Clase | null {
  const valor = datos.get("clase")?.toString();
  return valor === "evento" || valor === "noticia" ? valor : null;
}

/**
 * Comprueba que la publicación sea de una sucursal del negocio.
 *
 * RLS ya lo impide, pero sin este paso el error llegaría como un "no se pudo"
 * genérico y sin decir por qué. Además devuelve la sucursal, que hace falta
 * para armar la ruta de la foto.
 */
async function exigirPublicacionPropia(perfilId: string, clase: Clase, id: string) {
  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from(TABLA[clase])
    .select("id, sucursal_id, imagenes")
    .eq("id", id)
    .maybeSingle();

  if (!data) redirect("/negocio/panel/contenido");

  await exigirSucursalPropia(perfilId, data.sucursal_id);

  return data as { id: string; sucursal_id: string; imagenes: string[] };
}

/**
 * Cambia (o pone por primera vez) la foto de un evento o una noticia.
 *
 * La anterior se borra del bucket: si solo se reemplazara la ruta en la fila,
 * cada cambio de portada dejaría un archivo pagando espacio para siempre.
 */
export async function cambiarFotoPublicacion(
  _previo: EstadoAccion,
  datos: FormData,
): Promise<EstadoAccion> {
  const perfil = await exigirNegocio();

  const clase = claseDe(datos);
  if (!clase) return { error: "Publicación no reconocida." };

  const id = datos.get("publicacion_id")?.toString() ?? "";
  const publicacion = await exigirPublicacionPropia(perfil.id, clase, id);

  const supabase = await crearClienteServidor();

  const portada = await subirPortada(
    supabase,
    publicacion.sucursal_id,
    datos.get("imagen"),
    clase,
  );

  if ("error" in portada) return portada;
  if (portada.imagenes.length === 0) return { error: "Elige una imagen." };

  const { error } = await supabase
    .from(TABLA[clase])
    .update({ imagenes: portada.imagenes })
    .eq("id", id);

  if (error) {
    await supabase.storage.from("micrositios").remove(portada.imagenes);
    return { error: "La foto subió pero no se pudo asociar." };
  }

  const anteriores = publicacion.imagenes ?? [];
  if (anteriores.length > 0) {
    await supabase.storage.from("micrositios").remove(anteriores);
  }

  revalidatePath("/negocio/panel/contenido");
  revalidatePath(clase === "evento" ? "/eventos" : "/noticias");
  return { ok: "Foto actualizada." };
}

export async function eliminarPublicacion(datos: FormData) {
  const perfil = await exigirNegocio();

  const clase = claseDe(datos);
  if (!clase) redirect("/negocio/panel/contenido");

  const id = datos.get("publicacion_id")?.toString() ?? "";
  const publicacion = await exigirPublicacionPropia(perfil.id, clase, id);

  const supabase = await crearClienteServidor();

  await supabase.from(TABLA[clase]).delete().eq("id", id);

  // La foto se va con la publicación; nadie más la referencia.
  if (publicacion.imagenes?.length > 0) {
    await supabase.storage.from("micrositios").remove(publicacion.imagenes);
  }

  revalidatePath("/negocio/panel/contenido");
  revalidatePath(clase === "evento" ? "/eventos" : "/noticias");
}

// ---------------------------------------------------------------------------
// Avisos
// ---------------------------------------------------------------------------

/**
 * Marca los avisos como leídos.
 *
 * Sin `id` los marca todos. El trigger `proteger_notificacion` impide que por
 * esta vía se cambie cualquier otra cosa del aviso, y RLS ya limita a los
 * propios, así que no hace falta acotar por perfil aquí.
 */
export async function marcarAvisosLeidos(datos: FormData) {
  await exigirNegocio();

  const id = datos.get("aviso_id")?.toString();
  const supabase = await crearClienteServidor();

  const consulta = supabase.from("notificaciones").update({ leida: true });

  await (id ? consulta.eq("id", id) : consulta.eq("leida", false));

  revalidatePath("/negocio/panel");
}
