"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { perfilActual } from "@/lib/auth/sesion";
import { procesarPago, proximoCobro } from "@/lib/pagos";

export type EstadoPlan = { error?: string; ok?: string };

/**
 * El plan es de cada sucursal.
 *
 * Desde la spec v2 el cobro es por sucursal: una marca con tres micrositios
 * paga tres suscripciones, y cada una puede estar en un plan distinto y en su
 * propia prueba. La suscripción nace al publicar —ahí se elige el plan— y esta
 * pantalla sirve para lo que viene después: cambiarlo o darlo de baja.
 *
 * Desde aquí el cambio se aplica **a todas** las sucursales de la marca, que es
 * lo que se entiende al cambiar de plan desde la cuenta. Cambiarle el plan a una
 * sola se hace en su propia ficha.
 */
async function miMarca() {
  const perfil = await perfilActual();

  if (!perfil) redirect("/login");
  if (perfil.rol !== "negocio") redirect("/cuenta");

  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("marcas")
    .select("id, nombre_comercial")
    .eq("perfil_id", perfil.id)
    .limit(1)
    .maybeSingle();

  if (!data) redirect("/negocio/completar-marca");

  return data as { id: string; nombre_comercial: string };
}

/** Las suscripciones abiertas de una marca, por sucursal. */
async function suscripcionesAbiertas(marcaId: string) {
  const supabase = await crearClienteServidor();

  const { data: sucursales } = await supabase
    .from("sucursales")
    .select("id")
    .eq("marca_id", marcaId);

  const ids = (sucursales ?? []).map((s) => s.id as string);
  if (ids.length === 0) return [];

  const { data } = await supabase
    .from("suscripciones")
    .select("id, sucursal_id, tier_id, monto_mensual, estado, fecha_fin_trial")
    .in("sucursal_id", ids)
    .in("estado", ["trial", "activo", "pausado_por_pago"]);

  return data ?? [];
}

/**
 * Contrata o cambia de plan.
 *
 * Es la misma acción para las dos cosas: contratar es cambiar desde "ninguno".
 * Se cancela la suscripción vigente y se abre otra en vez de editar su
 * `tier_id`, para que el historial guarde qué se pagó y hasta cuándo — eso hará
 * falta el día que haya facturación de verdad.
 */
export async function contratarPlan(
  _previo: EstadoPlan,
  datos: FormData,
): Promise<EstadoPlan> {
  const marca = await miMarca();

  const tierId = Number(datos.get("tier_id")?.toString() ?? "");
  if (!tierId) return { error: "Elige un plan." };

  const supabase = await crearClienteServidor();

  const { data: tier } = await supabase
    .from("tiers")
    .select("id, nombre, precio_mensual")
    .eq("id", tierId)
    .maybeSingle();

  if (!tier) return { error: "Ese plan no existe." };

  const abiertas = await suscripcionesAbiertas(marca.id);

  if (abiertas.length === 0) {
    return {
      error:
        "Todavía no tienes ninguna sucursal publicada. El plan se elige al publicar el micrositio.",
    };
  }

  if (abiertas.every((s) => s.tier_id === tier.id)) {
    return { error: "Ya estás en ese plan." };
  }

  /*
    Durante la prueba el cambio es gratis y no se cobra nada: "el negocio puede
    cambiar de tier libremente sin costo" (spec v2 §3.3, paso 7). Solo se cobra
    por las que ya estaban pagando.
  */
  const enPrueba = abiertas.filter((s) => s.estado === "trial");
  const pagando = abiertas.filter((s) => s.estado !== "trial");

  /*
    Ya no se comprueba ningún tope de sucursales. Desde la spec v2 el cobro es
    por sucursal, así que no hay un número que el plan permita: cada micrositio
    paga el suyo. Antes esto impedía bajar de plan con más locales de los que
    cabían, y esa idea desapareció con el tope.
  */

  let referencia: string | undefined;

  if (pagando.length > 0) {
    const cobro = await procesarPago({
      sucursalId: marca.id,
      tierId: tier.id,
      montoMensual: tier.precio_mensual * pagando.length,
    });

    if (!cobro.ok) {
      return { error: `No se pudo completar el pago: ${cobro.motivo}` };
    }

    referencia = cobro.referencia;
  }

  /*
    Se cierra la suscripción vieja y se abre otra en vez de editarle el
    `tier_id`, para que el historial guarde qué se pagó y hasta cuándo. Las que
    estaban en prueba siguen en prueba, con la misma fecha de fin: cambiar de
    plan no regala días nuevos.
  */
  for (const abierta of abiertas) {
    if (abierta.tier_id === tier.id) continue;

    await supabase
      .from("suscripciones")
      .update({ estado: "cancelado" })
      .eq("id", abierta.id);

    const { error } = await supabase.from("suscripciones").insert({
      sucursal_id: abierta.sucursal_id,
      tier_id: tier.id,
      monto_mensual: tier.precio_mensual,
      estado: abierta.estado,
      fecha_fin_trial: abierta.fecha_fin_trial,
      fecha_proximo_cobro: proximoCobro().toISOString(),
      metodo_pago_stub: referencia,
    });

    if (error) {
      return { error: "El cobro pasó pero no se registró el plan. Avísanos." };
    }
  }

  // El `tier_id` de la sucursal es el reflejo de su suscripción: de ahí leen el
  // micrositio y el directorio si acepta reseñas o sale en el banner.
  for (const abierta of abiertas) {
    await supabase
      .from("sucursales")
      .update({ tier_id: tier.id })
      .eq("id", abierta.sucursal_id);
  }

  revalidatePath("/negocio/panel");
  revalidatePath("/negocio/panel/cuenta");

  return {
    ok:
      enPrueba.length > 0 && pagando.length === 0
        ? `Listo, tu prueba sigue en el plan ${tier.nombre}. No se te cobró nada.`
        : `Listo, tus micrositios están en el plan ${tier.nombre}.`,
  };
}

/**
 * Da de baja el plan.
 *
 * Las sucursales publicadas vuelven a borrador: estar en el directorio es justo
 * lo que se paga. No se pierde nada de lo armado — fotos, datos y catálogo
 * siguen ahí, y volver a publicar es contratar de nuevo.
 */
export async function cancelarPlan(
  _previo: EstadoPlan,
  datos: FormData,
): Promise<EstadoPlan> {
  const marca = await miMarca();

  if (datos.get("entendido") !== "si") {
    return { error: "Marca la casilla para confirmar que entiendes qué pasa al cancelar." };
  }

  const supabase = await crearClienteServidor();

  const abiertas = await suscripcionesAbiertas(marca.id);

  const { error } = await supabase
    .from("suscripciones")
    .update({ estado: "cancelado" })
    .in("id", abiertas.map((s) => s.id));

  if (error) return { error: "No se pudo cancelar. Inténtalo de nuevo." };

  const { error: errorEstado } = await supabase
    .from("sucursales")
    .update({ estado: "borrador" })
    .eq("marca_id", marca.id)
    .eq("estado", "publicado");

  if (errorEstado) {
    return { error: "Se canceló el cobro pero las sucursales siguen publicadas. Avísanos." };
  }

  revalidatePath("/negocio/panel");
  return {
    ok: "Plan cancelado. Tus micrositios volvieron a borrador y ya no se te cobrará.",
  };
}

/**
 * Los datos de quien lleva la cuenta y el nombre comercial de la marca.
 *
 * El correo no se toca aquí: cambiarlo exige confirmar el nuevo, o una errata
 * dejaría a alguien fuera de su propia cuenta. Eso es un flujo aparte.
 */
export async function guardarDatosPersonales(
  _previo: EstadoPlan,
  datos: FormData,
): Promise<EstadoPlan> {
  const perfil = await perfilActual();

  if (!perfil) redirect("/login");
  if (perfil.rol !== "negocio") redirect("/cuenta");

  const nombre = (datos.get("nombre")?.toString() ?? "").trim();
  const comercial = (datos.get("nombre_comercial")?.toString() ?? "").trim();

  if (!nombre) return { error: "Escribe tu nombre." };
  if (!comercial) return { error: "El negocio necesita un nombre comercial." };

  const supabase = await crearClienteServidor();

  const { error } = await supabase
    .from("perfiles")
    .update({ nombre })
    .eq("id", perfil.id);

  if (error) return { error: "No se pudieron guardar tus datos." };

  const { error: errorMarca } = await supabase
    .from("marcas")
    .update({ nombre_comercial: comercial })
    .eq("perfil_id", perfil.id);

  if (errorMarca) return { error: "Tu nombre se guardó, pero el del negocio no." };

  revalidatePath("/negocio/panel");
  revalidatePath("/negocio/panel/cuenta");
  return { ok: "Datos guardados." };
}
