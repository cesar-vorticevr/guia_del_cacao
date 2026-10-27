"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { origenDelSitio, perfilActual } from "@/lib/auth/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { crearClienteDeServicio } from "@/lib/supabase/servicio";
import { PAGO_SIMULADO } from "@/lib/pagos";
import { crearPagoDeExperiencia, explicarErrorDeStripe, stripe } from "@/lib/stripe";
import { marcaDe } from "@/lib/datos/experiencias";
import {
  BUCKET_EXPERIENCIAS,
  PRECIO_EXPERIENCIA_EXTRA,
  codigoNuevo,
  limpiarBotones,
  limpiarElementos,
} from "@/lib/experiencias";

/**
 * Acciones de las experiencias de realidad aumentada (migración 000066).
 *
 * Los archivos no pasan por aquí: el editor los sube directo al bucket con la
 * sesión del negocio (Vercel corta los cuerpos en 4.5 MB y un video pesa
 * más). Aquí solo viaja lo que se guarda en la tabla, y la base decide si se
 * puede publicar.
 */

export type EstadoExperiencia = { error?: string; ok?: string };

async function miMarca() {
  const perfil = await perfilActual();
  if (!perfil) redirect("/login");
  if (perfil.rol !== "negocio") redirect("/cuenta");
  const marca = await marcaDe(perfil.id);
  if (!marca) redirect("/negocio/completar-marca");
  return { perfil, marca };
}

/** Un mensaje de la base (P0001, los `raise exception`) dicho tal cual. */
function explicar(error: { code?: string; message: string }, otro: string) {
  return error.code === "P0001" ? error.message : otro;
}

/** Una experiencia nueva, en borrador, y directo al editor. */
export async function crearExperiencia() {
  const { marca } = await miMarca();
  const supabase = await crearClienteServidor();

  let id: string | null = null;
  for (let intento = 0; intento < 3 && !id; intento++) {
    const { data } = await supabase
      .from("experiencias")
      .insert({ marca_id: marca.id, codigo: codigoNuevo(), titulo: "" })
      .select("id")
      .maybeSingle();
    id = (data?.id as string | undefined) ?? null;
  }

  if (!id) redirect("/negocio/panel/experiencias?error=crear");
  redirect(`/negocio/panel/experiencias/${id}`);
}

export type DatosDeExperiencia = {
  titulo: string;
  imagen: string | null;
  objetivo: string | null;
  imagenAncho: number | null;
  imagenAlto: number | null;
  elementos: unknown;
  botones: Record<string, unknown>;
};

/**
 * Guarda lo armado en el editor y, si se pide, lo publica o lo regresa a
 * borrador. Las rutas de archivo tienen que estar dentro de la carpeta de la
 * propia experiencia: no se apunta a archivos de otros.
 */
export async function guardarExperiencia(
  id: string,
  datos: DatosDeExperiencia,
  estado?: "borrador" | "publicada",
): Promise<EstadoExperiencia> {
  const { marca } = await miMarca();
  const supabase = await crearClienteServidor();
  const carpeta = `${marca.id}/${id}/`;
  const propia = (ruta: string | null) => (ruta && ruta.startsWith(carpeta) ? ruta : null);

  const cambios: Record<string, unknown> = {
    titulo: String(datos.titulo ?? "").trim().slice(0, 80),
    imagen: propia(datos.imagen),
    objetivo: propia(datos.objetivo),
    imagen_ancho: datos.imagenAncho ? Math.round(datos.imagenAncho) : null,
    imagen_alto: datos.imagenAlto ? Math.round(datos.imagenAlto) : null,
    elementos: limpiarElementos(datos.elementos),
    botones: limpiarBotones(datos.botones ?? {}),
  };
  if (estado) cambios.estado = estado;

  const { data, error } = await supabase
    .from("experiencias")
    .update(cambios)
    .eq("id", id)
    .eq("marca_id", marca.id)
    .select("id")
    .maybeSingle();

  if (error) return { error: explicar(error, "No se pudo guardar. Inténtalo de nuevo.") };
  if (!data) return { error: "Esa experiencia no existe." };

  revalidatePath("/negocio/panel/experiencias");
  return {
    ok:
      estado === "publicada"
        ? "¡Publicada! Ya se puede ver con su link y su QR."
        : estado === "borrador"
          ? "Regresó a borrador: el link ya no la enseña."
          : "Cambios guardados.",
  };
}

/** Publicar o pasar a borrador desde el tablero, sin abrir el editor. */
export async function cambiarEstado(id: string, estado: "borrador" | "publicada"): Promise<EstadoExperiencia> {
  const { marca } = await miMarca();
  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("experiencias")
    .update({ estado })
    .eq("id", id)
    .eq("marca_id", marca.id);

  if (error) return { error: explicar(error, "No se pudo cambiar. Inténtalo de nuevo.") };
  revalidatePath("/negocio/panel/experiencias");
  return { ok: estado === "publicada" ? "Publicada." : "Pasó a borrador." };
}

/** Borra la experiencia y sus archivos. El link y el QR dejan de funcionar. */
export async function borrarExperiencia(id: string): Promise<EstadoExperiencia> {
  const { marca } = await miMarca();
  const supabase = await crearClienteServidor();
  const carpeta = `${marca.id}/${id}`;

  const { data: archivos } = await supabase.storage.from(BUCKET_EXPERIENCIAS).list(carpeta, { limit: 200 });
  if (archivos?.length) {
    await supabase.storage.from(BUCKET_EXPERIENCIAS).remove(archivos.map((a) => `${carpeta}/${a.name}`));
  }

  const { error } = await supabase.from("experiencias").delete().eq("id", id).eq("marca_id", marca.id);
  if (error) return { error: "No se pudo borrar. Inténtalo de nuevo." };

  revalidatePath("/negocio/panel/experiencias");
  return { ok: "Borrada." };
}

/**
 * Una experiencia más por $499, pago único. Con Stripe va a su página de
 * pago y la suma el webhook; sin llaves (local) el cobro es simulado y se
 * suma aquí con la llave de servicio, que es la única que puede hacerlo.
 */
export async function comprarExperienciaExtra(): Promise<EstadoExperiencia> {
  const { perfil, marca } = await miMarca();

  const supabase = await crearClienteServidor();
  const { data: cupo } = await supabase.rpc("cupo_de_experiencias", { p_marca: marca.id });
  if (!Number(cupo)) {
    return { error: "Las experiencias extra se suman al plan Pro. Primero pásate a Pro." };
  }

  if (stripe()) {
    const origen = await origenDelSitio();
    const { data } = await crearClienteDeServicio()
      .from("marcas")
      .select("stripe_customer_id")
      .eq("id", marca.id)
      .maybeSingle();

    let url: string;
    try {
      url = await crearPagoDeExperiencia({
        marcaId: marca.id,
        clienteStripe: (data?.stripe_customer_id as string | null) ?? null,
        correo: perfil.correo,
        precio: PRECIO_EXPERIENCIA_EXTRA,
        exito: `${origen}/negocio/panel/experiencias?pago=listo`,
        cancelado: `${origen}/negocio/panel/experiencias?pago=cancelado`,
      });
    } catch (error) {
      return { error: explicarErrorDeStripe(error) };
    }
    redirect(url);
  }

  if (!PAGO_SIMULADO || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: "El cobro no está configurado. Avísanos para activarlo." };
  }

  const { error } = await crearClienteDeServicio().rpc("sumar_experiencia_extra", {
    p_marca: marca.id,
    p_referencia: `simulado-${crypto.randomUUID()}`,
    p_monto: PRECIO_EXPERIENCIA_EXTRA,
  });
  if (error) return { error: "No se pudo sumar la experiencia." };

  revalidatePath("/negocio/panel/experiencias");
  return { ok: "Listo: tienes una experiencia más (cobro simulado)." };
}
