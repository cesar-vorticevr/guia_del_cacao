"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { perfilActual } from "@/lib/auth/sesion";
import { miSucursal, misSucursales } from "@/lib/datos/sucursales";
import { generarSlug } from "@/lib/tipos";
import { esPasoDelAlta } from "@/lib/negocio/pasos";
import { revisarImagen } from "@/lib/imagenes";
import { LIMITES, revisarLargo } from "@/lib/limites";

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
      /*
        Los triggers de la base —correo sin confirmar, tope del plan— rechazan
        con `P0001` y un mensaje ya escrito para leerse. Traducirlo a "no se
        pudo crear, inténtalo de nuevo" mandaba a reintentar algo que iba a
        fallar igual las veces que hiciera falta.
      */
      return {
        error:
          error?.code === "P0001"
            ? error.message
            : "No se pudo crear la sucursal. Inténtalo de nuevo.",
      };
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

  // El `maxLength` del campo no basta: no detiene a quien manda la petición sin
  // pasar por el navegador.
  const acercaDe = texto(datos, "acerca_de");
  const largo = revisarLargo(acercaDe, LIMITES.acercaDe, "El «acerca de»");
  if (largo) return { error: largo };

  const supabase = await crearClienteServidor();

  const { error } = await supabase
    .from("sucursales")
    .update({
      nombre_sucursal: nombre,
      acerca_de: acercaDe,
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

  /*
    Durante el alta guiada, guardar y avanzar son el mismo gesto. Sin esto había
    dos botones —"Guardar" y "Siguiente"— y quien apretaba el segundo sin el
    primero perdía lo que acababa de escribir.

    El destino no viaja en el formulario: llega el nombre del paso y la ruta se
    arma aquí con el `id` que ya se comprobó que es suyo. Mandar la URL entera
    desde un campo oculto sería confiar en el navegador para decidir a dónde
    redirige el servidor.
  */
  const siguiente = datos.get("continuar_a")?.toString();
  if (esPasoDelAlta(siguiente)) {
    redirect(`/negocio/panel/sucursal/${id}?paso=${siguiente}`);
  }

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
// Publicar una sucursal
// ---------------------------------------------------------------------------

/**
 * Saca la sucursal al directorio.
 *
 * Ya no cobra nada: el plan se contrata a nivel cuenta y cubre a todas las
 * sucursales que quepan en su tope. Aqui solo se cambia el estado, y el trigger
 * de la base vuelve a exigir que la marca tenga plan activo — asi que esto no es
 * la unica barrera.
 */
export async function publicarSucursal(
  _previo: EstadoAccion,
  datos: FormData,
): Promise<EstadoAccion> {
  const perfil = await exigirNegocio();
  const id = datos.get("sucursal_id")?.toString() ?? "";
  const sucursal = await exigirSucursalPropia(perfil.id, id);

  if (sucursal.estado === "publicado" || sucursal.estado === "pendiente_aprobacion") {
    return { error: "Este micrositio ya esta publicado o en revision." };
  }

  const supabase = await crearClienteServidor();

  const { error } = await supabase
    .from("sucursales")
    .update({ estado: "publicado", motivo_rechazo: null })
    .eq("id", id);

  if (error) {
    // El trigger explica en su mensaje que falta —normalmente, plan activo.
    return {
      error:
        error.code === "P0001"
          ? error.message
          : "No se pudo publicar. Intentalo de nuevo.",
    };
  }

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

  revalidatePath("/negocio/panel/eventos");
  revalidatePath("/negocio/panel/foro");
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

  revalidatePath("/negocio/panel/eventos");
  revalidatePath("/negocio/panel/foro");
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

  if (!data) redirect("/negocio/panel/eventos");

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

  revalidatePath("/negocio/panel/eventos");
  revalidatePath("/negocio/panel/foro");
  revalidatePath(clase === "evento" ? "/eventos" : "/noticias");
  return { ok: "Foto actualizada." };
}

export async function eliminarPublicacion(datos: FormData) {
  const perfil = await exigirNegocio();

  const clase = claseDe(datos);
  if (!clase) redirect("/negocio/panel/eventos");

  const id = datos.get("publicacion_id")?.toString() ?? "";
  const publicacion = await exigirPublicacionPropia(perfil.id, clase, id);

  const supabase = await crearClienteServidor();

  await supabase.from(TABLA[clase]).delete().eq("id", id);

  // La foto se va con la publicación; nadie más la referencia.
  if (publicacion.imagenes?.length > 0) {
    await supabase.storage.from("micrositios").remove(publicacion.imagenes);
  }

  revalidatePath("/negocio/panel/eventos");
  revalidatePath("/negocio/panel/foro");
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

  /*
    Abrir la reseña y darla por leída son el mismo gesto: el botón "Verla" manda
    aquí con el destino puesto y de paso apaga su aviso. Antes eran dos —ver y
    marcar—, y el contador se quedaba en rojo después de haber atendido todo.

    El destino se comprueba: llega en el formulario, así que solo se acepta una
    ruta interna. Sin el filtro, un enlace preparado usaría nuestro dominio para
    empujar a la gente afuera.
  */
  const destino = datos.get("ir_a")?.toString();

  if (destino && destino.startsWith("/") && !destino.startsWith("//")) {
    redirect(destino);
  }
}

// ---------------------------------------------------------------------------
// Borrar un micrositio
// ---------------------------------------------------------------------------

/**
 * Borrar el micrositio entero.
 *
 * Cancela primero la suscripción y luego borra la sucursal. El orden importa:
 * si el borrado fallara a medias, lo peor que queda es una ficha sin cobrar, y
 * no un cobro andando sobre algo que ya no existe.
 *
 * Las filas que cuelgan —productos, eventos, noticias, reseñas, solicitudes, la
 * suscripción— se van solas por `on delete cascade`. Los archivos de Storage no:
 * hay que barrerlos a mano, porque nadie más va a hacerlo y esa carpeta se
 * quedaría ocupando espacio para siempre.
 */
export async function eliminarSucursal(
  _previo: EstadoAccion,
  datos: FormData,
): Promise<EstadoAccion> {
  const perfil = await exigirNegocio();
  const id = datos.get("sucursal_id")?.toString() ?? "";
  const sucursal = await exigirSucursalPropia(perfil.id, id);

  if (datos.get("entendido") !== "si") {
    return { error: "Marca la casilla para confirmar que entiendes que esto no se deshace." };
  }

  // Escribir el nombre es la última red: un botón rojo se aprieta sin querer,
  // el nombre de la sucursal no se teclea por accidente.
  const confirmacion = (datos.get("confirmacion")?.toString() ?? "").trim();
  if (confirmacion !== sucursal.nombre_sucursal) {
    return { error: `Escribe «${sucursal.nombre_sucursal}» tal cual para confirmar.` };
  }

  const supabase = await crearClienteServidor();

  await supabase
    .from("suscripciones")
    .update({ estado: "cancelado" })
    .eq("sucursal_id", id)
    .eq("estado", "activo");

  // Las imágenes viven todas bajo `{sucursal_id}/`, que es lo que exige la
  // política de Storage. Si esto falla no se detiene el borrado: quedarse con
  // la ficha por no poder tirar unas fotos sería peor.
  const { data: archivos } = await supabase.storage.from("micrositios").list(id);

  if (archivos?.length) {
    await supabase.storage
      .from("micrositios")
      .remove(archivos.map((archivo) => `${id}/${archivo.name}`));
  }

  const { error } = await supabase.from("sucursales").delete().eq("id", id);

  if (error) return { error: "No se pudo eliminar el micrositio. Inténtalo de nuevo." };

  revalidatePath("/negocio/panel");
  redirect("/negocio/panel");
}

/**
 * Abre las reseñas de una sucursal y apaga su campanita.
 *
 * Las dos cosas en el mismo gesto: si ver las reseñas no las diera por vistas,
 * el punto rojo seguiría encendido después de haberlas leído y dejaría de
 * significar algo.
 *
 * Los avisos se marcan por su `enlace`, que es lo que los ata a una sucursal.
 * El slug llega del formulario, así que se comprueba contra las sucursales
 * propias antes de usarlo: sin eso, cualquiera podría apagar avisos ajenos
 * mandando otro slug.
 */
export async function abrirResenas(datos: FormData) {
  const perfil = await exigirNegocio();
  const slug = datos.get("slug")?.toString() ?? "";

  const mias = await misSucursales(perfil.id);
  if (!mias.some((sucursal) => sucursal.slug === slug)) {
    redirect("/negocio/panel");
  }

  const supabase = await crearClienteServidor();

  await supabase
    .from("notificaciones")
    .update({ leida: true })
    .eq("enlace", `/marca/${slug}`)
    .eq("leida", false);

  revalidatePath("/negocio/panel");
  redirect(`/marca/${slug}#resenas`);
}

// ---------------------------------------------------------------------------
// Ocultar y volver a mostrar un micrositio
// ---------------------------------------------------------------------------

/**
 * Saca la sucursal del directorio sin borrarla.
 *
 * Es la alternativa suave a eliminar: el local cierra por temporada, se muda o
 * se está rehaciendo la ficha, y nada de eso justifica perder las fotos, el
 * catálogo y las reseñas. Vuelve con un toque.
 *
 * Reutiliza el estado `pausado`, que ya existía para esto. Lo que cambió es el
 * nombre en pantalla —"Oculto" dice lo que pasa, "Pausado" no— y que ahora el
 * negocio puede ponerlo él.
 */
export async function ocultarSucursal(datos: FormData) {
  const perfil = await exigirNegocio();
  const id = datos.get("sucursal_id")?.toString() ?? "";
  await exigirSucursalPropia(perfil.id, id);

  const supabase = await crearClienteServidor();

  await supabase
    .from("sucursales")
    .update({ estado: "pausado", pausado_por_admin: false })
    .eq("id", id);

  revalidatePath("/negocio/panel");
  revalidatePath(`/negocio/panel/sucursal/${id}`);
}

/**
 * La devuelve al directorio.
 *
 * El trigger de la base vuelve a exigir plan activo, y si la pausa la puso un
 * administrador no la levanta nadie más: eso no se comprueba aquí porque no
 * debe depender de que esta acción se acuerde.
 */
export async function mostrarSucursal(datos: FormData) {
  const perfil = await exigirNegocio();
  const id = datos.get("sucursal_id")?.toString() ?? "";
  await exigirSucursalPropia(perfil.id, id);

  const supabase = await crearClienteServidor();

  await supabase
    .from("sucursales")
    .update({ estado: "publicado" })
    .eq("id", id);

  revalidatePath("/negocio/panel");
  revalidatePath(`/negocio/panel/sucursal/${id}`);
}

/**
 * Deja constancia de que ya miró sus solicitudes de monedas.
 *
 * Apaga el destello de "nueva", no el icono: lo que sigue pendiente sigue
 * pendiente aunque se haya visto, y el icono es lo que recuerda que hay trabajo
 * por hacer.
 */
export async function marcarMonedasVistas() {
  const perfil = await exigirNegocio();

  const supabase = await crearClienteServidor();

  await supabase
    .from("perfiles")
    .update({ monedas_vistas_en: new Date().toISOString() })
    .eq("id", perfil.id);

  revalidatePath("/negocio/panel");
}

// ---------------------------------------------------------------------------
// Editar y cancelar un evento
// ---------------------------------------------------------------------------

/**
 * La sucursal de un evento, comprobando que sea de quien lo pide.
 *
 * Se filtra por dueño a mano aunque RLS ya lo cubra: la política de lectura de
 * eventos es tan ancha como el público de un micrositio publicado, así que sin
 * esto se podría abrir el editor de un evento ajeno con solo saber su id.
 */
async function miEvento(perfilId: string, eventoId: string) {
  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("eventos")
    .select("id, sucursal_id, sucursales!inner(marca_id, marcas!inner(perfil_id))")
    .eq("id", eventoId)
    .eq("sucursales.marcas.perfil_id", perfilId)
    .maybeSingle();

  if (!data) redirect("/negocio/panel/eventos");

  return data as unknown as { id: string; sucursal_id: string };
}

export async function editarEvento(
  _previo: EstadoAccion,
  datos: FormData,
): Promise<EstadoAccion> {
  const perfil = await exigirNegocio();
  const eventoId = datos.get("evento_id")?.toString() ?? "";
  const evento = await miEvento(perfil.id, eventoId);

  const problema = validarPublicacion(datos);
  if (problema) return problema;

  const fecha = texto(datos, "fecha_evento");
  if (!fecha) return { error: "Elige la fecha del evento." };

  const supabase = await crearClienteServidor();

  const portada = await subirPortada(
    supabase,
    evento.sucursal_id,
    datos.get("imagen"),
    "evento",
  );
  if ("error" in portada) return portada;

  const { error } = await supabase
    .from("eventos")
    .update({
      titulo: texto(datos, "titulo"),
      subtitulo: texto(datos, "subtitulo"),
      contenido: texto(datos, "contenido"),
      fecha_evento: new Date(fecha).toISOString(),
      // Sin foto nueva se conserva la que había: cambiar la fecha y cambiar la
      // portada son dos gestos distintos y no tienen por qué ir juntos.
      ...(portada.imagenes.length > 0 ? { imagenes: portada.imagenes } : {}),
    })
    .eq("id", eventoId);

  if (error) {
    if (portada.imagenes.length > 0) {
      await supabase.storage.from("micrositios").remove(portada.imagenes);
    }
    return { error: traducirErrorContenido(error.message) };
  }

  revalidatePath("/negocio/panel/eventos");
  revalidatePath("/eventos");
  return { ok: "Evento actualizado." };
}

/**
 * Cancela un evento, o lo devuelve a la agenda.
 *
 * Cancelar no es borrar: el evento se queda a la vista, tachado y con su
 * letrero. Quien ya apartó la fecha necesita enterarse de que se cayó — un
 * evento borrado desaparece sin decir nada y deja gente presentándose en la
 * puerta.
 */
export async function cambiarEstadoEvento(datos: FormData) {
  const perfil = await exigirNegocio();
  const eventoId = datos.get("evento_id")?.toString() ?? "";
  await miEvento(perfil.id, eventoId);

  const cancelar = datos.get("cancelar") === "si";

  const supabase = await crearClienteServidor();

  await supabase
    .from("eventos")
    .update({ cancelado_en: cancelar ? new Date().toISOString() : null })
    .eq("id", eventoId);

  revalidatePath("/negocio/panel/eventos");
  revalidatePath(`/negocio/panel/eventos/${eventoId}`);
  revalidatePath("/eventos");
}
