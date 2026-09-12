"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { perfilActual } from "@/lib/auth/sesion";
import { revisarImagen } from "@/lib/imagenes";
import { TOPE_FOTOS } from "@/lib/limites";
import { MONEDA } from "@/lib/vocabulario";

export type EstadoForo = { error?: string; ok?: string };

/** Traduce lo que gritan los triggers y las políticas. */
function traducir(mensaje: string) {
  if (mensaje.includes("cuesta una mazorca")) {
    return `Publicar cuesta una ${MONEDA.singular} y no te queda ninguna. Visita un negocio y pide las tuyas.`;
  }
  if (mensaje.includes("No tienes mazorcas")) {
    return "No te queda ninguna mazorca para apoyar. Junta más visitando negocios.";
  }
  if (mensaje.includes("apoyar tu propia")) {
    return "No puedes apoyar tu propia publicación.";
  }
  if (mensaje.includes("apoyos_tema_pkey") || mensaje.includes("apoyos_pkey")) {
    return "Ya la apoyaste. Es una mazorca por persona.";
  }
  if (mensaje.includes("Tu plan no incluye")) {
    return "Publicar como negocio viene con el plan Premier.";
  }
  if (mensaje.includes("row-level security")) {
    return "Tu cuenta no puede publicar aquí ahora mismo.";
  }
  return "No se pudo completar. Inténtalo de nuevo.";
}

/**
 * Sube las fotos de una publicación y devuelve sus rutas.
 *
 * La primera carpeta es el perfil de quien sube: es la llave que usa la
 * política del bucket para impedir escribir en la carpeta de otro.
 */
async function subirFotos(
  supabase: Awaited<ReturnType<typeof crearClienteServidor>>,
  perfilId: string,
  archivos: File[],
) {
  const rutas: string[] = [];

  for (const [i, archivo] of archivos.entries()) {
    const problema = revisarImagen(archivo);
    if (problema) return { error: problema };

    const extension = archivo.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const ruta = `${perfilId}/${Date.now()}-${i}.${extension}`;

    const { error } = await supabase.storage
      .from("comunidad")
      .upload(ruta, archivo);

    if (error) {
      return {
        error: "No se pudo subir una de las fotos. Inténtalo de nuevo.",
      };
    }

    // Se guarda con el bucket delante: es lo que luego permite saber dónde
    // buscarla sin adivinar por la forma de la ruta.
    rutas.push(`comunidad/${ruta}`);
  }

  return { rutas };
}

/** Las fotos que vienen en el formulario, sin las casillas vacías. */
function fotosDe(datos: FormData) {
  return datos
    .getAll("imagenes")
    .filter((f): f is File => f instanceof File && f.size > 0)
    .slice(0, TOPE_FOTOS);
}

/** Lo que aceptan los campos, igual que los `check` de la base. */
function revisarTexto(titulo: string, contenido: string) {
  if (titulo.length < 5) return "Ponle un título de al menos 5 letras.";
  if (titulo.length > 120) return "El título no puede pasar de 120 caracteres.";
  if (contenido.length < 10) return "Cuenta un poco más.";
  if (contenido.length > 3000) return "No puede pasar de 3000 caracteres.";
  return null;
}

/**
 * Publicar en la comunidad.
 *
 * A una persona le cuesta una mazorca —se la cobra el trigger `cobrar_publicacion`,
 * que es quien puede hacerlo en la misma transacción— y a un negocio le pide el
 * plan Premier. Aquí solo se valida el texto y se traduce la negativa.
 */
export async function crearTema(
  _previo: EstadoForo,
  datos: FormData,
): Promise<EstadoForo> {
  const perfil = await perfilActual();

  if (!perfil) redirect("/login");
  if (perfil.rol !== "cliente" && perfil.rol !== "negocio") {
    return { error: "La comunidad es de clientes y de negocios." };
  }

  const titulo = (datos.get("titulo")?.toString() ?? "").trim();
  const contenido = (datos.get("contenido")?.toString() ?? "").trim();
  const sucursalId = datos.get("sucursal_id")?.toString() || null;

  const mal = revisarTexto(titulo, contenido);
  if (mal) return { error: mal };

  /*
    La foto es obligatoria y no un adorno: sin ella el muro era una lista de
    párrafos y nadie se paraba a leerlos. Se pide aquí y además lo exige la
    base, que es lo que impide publicar sin foto por otra vía.
  */
  const archivos = fotosDe(datos);
  if (archivos.length === 0) {
    return {
      error:
        "Ponle al menos una foto: es lo que hace que alguien se pare a leerte.",
    };
  }

  const supabase = await crearClienteServidor();

  const subidas = await subirFotos(supabase, perfil.id, archivos);
  if ("error" in subidas) return { error: subidas.error };

  const { data, error } = await supabase
    .from("publicaciones")
    .insert({
      autor_id: perfil.id,
      titulo,
      contenido,
      imagenes: subidas.rutas,
      sucursal_id: perfil.rol === "negocio" ? sucursalId : null,
    })
    .select("id")
    .maybeSingle();

  if (error || !data) return { error: traducir(error?.message ?? "") };

  revalidatePath("/comunidad");
  // El `?nueva=1` es lo que dispara el festejo al llegar: publicar y que la
  // pantalla se quede muda es lo que hace que nadie vuelva a escribir.
  redirect(`/comunidad/${data.id}?nueva=1`);
}

/**
 * Corregir una publicación.
 *
 * Antes solo se podía cambiar la foto, que es lo único que no suele hacer falta
 * corregir. Ahora se edita lo que se escribió, que es de lo que uno se
 * arrepiente.
 */
export async function editarTema(
  _previo: EstadoForo,
  datos: FormData,
): Promise<EstadoForo> {
  const perfil = await perfilActual();
  if (!perfil) redirect("/login");

  const id = datos.get("publicacion_id")?.toString() ?? "";
  const titulo = (datos.get("titulo")?.toString() ?? "").trim();
  const contenido = (datos.get("contenido")?.toString() ?? "").trim();

  const mal = revisarTexto(titulo, contenido);
  if (mal) return { error: mal };

  const supabase = await crearClienteServidor();

  const cambios: Record<string, unknown> = {
    titulo,
    contenido,
    fecha_edicion: new Date().toISOString(),
  };

  /*
    Las fotos se recomponen: las que el formulario dice conservar, más las que
    se suban ahora. Antes mandar una nueva reemplazaba todas y no había forma
    de quitar una sola; quien subía cuatro y quería tirar la borrosa tenía que
    volver a subir las otras tres.

    El campo `conservar` viaja una vez por foto que se queda. Si no viene
    ninguno —porque el formulario es viejo o alguien lo manda a mano— se dejan
    las que ya estaban, que es lo que no destruye nada.
  */
  const conservar = datos.getAll("conservar").map(String).filter(Boolean);
  const archivos = fotosDe(datos);
  const tocaronFotos = datos.has("conservar") || archivos.length > 0;

  if (tocaronFotos) {
    const subidas =
      archivos.length > 0
        ? await subirFotos(supabase, perfil.id, archivos)
        : { rutas: [] as string[] };

    if ("error" in subidas) return { error: subidas.error };

    const finales = [...conservar, ...subidas.rutas].slice(0, TOPE_FOTOS);

    if (finales.length === 0) {
      return { error: "Déjale al menos una foto: es lo que se ve en el muro." };
    }

    cambios.imagenes = finales;
  }

  // Se acota al autor además de RLS: la política deja pasar también al
  // administrador, y esta acción es la de quien escribió.
  const { error } = await supabase
    .from("publicaciones")
    .update(cambios)
    .eq("id", id)
    .eq("autor_id", perfil.id);

  if (error) return { error: traducir(error.message) };

  revalidatePath("/comunidad");
  revalidatePath(`/comunidad/${id}`);

  return { ok: "Guardado." };
}

/**
 * Esconder o volver a mostrar una publicación.
 *
 * Ocultar no borra: la publicación sale del muro pero su autor la sigue viendo
 * y puede devolverla. Es la salida para quien se arrepiente de haberla puesto,
 * sin obligarle a perder los comentarios que le dejaron.
 */
export async function ocultarTema(datos: FormData) {
  const perfil = await perfilActual();
  if (!perfil) redirect("/login");

  const id = datos.get("publicacion_id")?.toString() ?? "";
  const esconder = datos.get("ocultar")?.toString() === "si";

  const supabase = await crearClienteServidor();

  await supabase
    .from("publicaciones")
    .update({ oculta_en: esconder ? new Date().toISOString() : null })
    .eq("id", id)
    .eq("autor_id", perfil.id);

  revalidatePath("/comunidad");
  revalidatePath(`/comunidad/${id}`);
}

export async function borrarTema(datos: FormData) {
  const perfil = await perfilActual();
  if (!perfil) redirect("/login");

  const id = datos.get("publicacion_id")?.toString() ?? "";

  const supabase = await crearClienteServidor();

  await supabase
    .from("publicaciones")
    .delete()
    .eq("id", id)
    .eq("autor_id", perfil.id);

  revalidatePath("/comunidad");
  redirect("/comunidad");
}

