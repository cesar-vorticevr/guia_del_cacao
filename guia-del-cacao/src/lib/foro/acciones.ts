"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { perfilActual } from "@/lib/auth/sesion";
import { MONEDA } from "@/lib/vocabulario";

export type EstadoForo = { error?: string; ok?: string };

/** Traduce lo que gritan los triggers del foro. */
function traducir(mensaje: string) {
  if (mensaje.includes("Hacen falta 50 monedas")) {
    return `Hacen falta 50 ${MONEDA.plural} para abrir un tema.`;
  }
  if (mensaje.includes("temas que puedes abrir")) {
    return "Ya usaste todos los temas que puedes tener abiertos. Cierra uno o junta más monedas.";
  }
  if (mensaje.includes("No tienes monedas")) {
    return `No te queda ninguna moneda para apoyar. Junta más visitando negocios.`;
  }
  if (mensaje.includes("apoyar tu propio tema")) {
    return "No puedes apoyar tu propio tema.";
  }
  if (mensaje.includes("apoyos_tema_pkey")) {
    return "Ya apoyaste este tema. Es una moneda por persona.";
  }
  if (mensaje.includes("row-level security")) {
    return "Abrir temas es de los clientes con 50 monedas y de los negocios Tier 3.";
  }
  return "No se pudo completar. Inténtalo de nuevo.";
}

export async function crearTema(
  _previo: EstadoForo,
  datos: FormData,
): Promise<EstadoForo> {
  const perfil = await perfilActual();

  if (!perfil) redirect("/login");

  // Desde la migracion 000015 tambien abre temas un negocio de Tier 3. Cuantos
  // le tocan lo decide el trigger; aqui solo se deja pasar a los dos roles que
  // pueden intentarlo.
  if (perfil.rol !== "cliente" && perfil.rol !== "negocio") {
    return { error: "El foro es de clientes y de negocios." };
  }

  const titulo = (datos.get("titulo")?.toString() ?? "").trim();
  const contenido = (datos.get("contenido")?.toString() ?? "").trim();

  if (titulo.length < 5) return { error: "Ponle un título de al menos 5 letras." };
  if (titulo.length > 120) return { error: "El título no puede pasar de 120 caracteres." };
  if (contenido.length < 10) return { error: "Cuenta un poco más de qué va tu tema." };
  if (contenido.length > 3000) {
    return { error: "El tema no puede pasar de 3000 caracteres." };
  }

  const supabase = await crearClienteServidor();

  // Cuántos temas le tocan lo decide el trigger `limitar_temas_por_autor`
  // contra las monedas del año; aquí solo se traduce su negativa.
  const { data, error } = await supabase
    .from("temas_foro")
    .insert({ autor_id: perfil.id, titulo, contenido })
    .select("id")
    .maybeSingle();

  if (error || !data) return { error: traducir(error?.message ?? "") };

  revalidatePath("/comunidad");
  redirect(`/comunidad/tema/${data.id}`);
}

export async function borrarTema(datos: FormData) {
  const perfil = await perfilActual();
  if (!perfil) redirect("/login");

  const temaId = datos.get("tema_id")?.toString() ?? "";

  const supabase = await crearClienteServidor();

  // Se acota al propio además de RLS: la política deja borrar también a un
  // administrador, y esta acción es la del autor.
  await supabase.from("temas_foro").delete().eq("id", temaId).eq("autor_id", perfil.id);

  revalidatePath("/comunidad");
  redirect("/comunidad");
}

/**
 * Regalarle una moneda al autor de un tema.
 *
 * Es una transferencia de verdad: quien apoya se queda con una menos. Si el
 * sistema regalara monedas nuevas, un tema con cien apoyos crearía cien
 * monedas de la nada y el rango dejaría de significar cuánto visitaste. El
 * movimiento y el recálculo de los dos rangos los hace el trigger
 * `mover_moneda_de_apoyo`, en una sola transacción.
 */
export async function apoyarTema(
  _previo: EstadoForo,
  datos: FormData,
): Promise<EstadoForo> {
  const perfil = await perfilActual();
  const temaId = datos.get("tema_id")?.toString() ?? "";

  if (!perfil) redirect("/login");
  if (perfil.rol !== "cliente") {
    return { error: "Solo las cuentas de cliente pueden apoyar." };
  }

  const supabase = await crearClienteServidor();

  const { error } = await supabase
    .from("apoyos_tema")
    .insert({ tema_id: temaId, usuario_id: perfil.id });

  if (error) return { error: traducir(error.message) };

  revalidatePath(`/comunidad/tema/${temaId}`);
  revalidatePath("/comunidad");
  revalidatePath("/cuenta");

  return { ok: `Listo, le diste una ${MONEDA.singular}.` };
}
