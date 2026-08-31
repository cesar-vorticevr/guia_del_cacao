"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { perfilActual } from "@/lib/auth/sesion";
import { procesarPago, proximoCobro } from "@/lib/pagos";

export type EstadoPlan = { error?: string; ok?: string };

/**
 * El plan es de la cuenta, no de cada sucursal.
 *
 * Antes cada micrositio llevaba su propia suscripción: una marca con cuatro
 * locales tenía cuatro cobros al mismo plan, cuatro sitios donde cancelarlo y
 * cuatro fechas distintas. Ahora hay uno por marca, y lo que cambia con él es
 * cuántas sucursales caben y qué puede hacer cada una.
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

async function suscripcionActiva(marcaId: string) {
  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("suscripciones")
    .select("id, tier_id, monto_mensual, fecha_proximo_cobro")
    .eq("marca_id", marcaId)
    .eq("estado", "activo")
    .maybeSingle();

  return data;
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
    .select("id, nombre, precio_mensual, max_sucursales")
    .eq("id", tierId)
    .maybeSingle();

  if (!tier) return { error: "Ese plan no existe." };

  const vigente = await suscripcionActiva(marca.id);
  if (vigente?.tier_id === tier.id) return { error: "Ya estás en ese plan." };

  /*
    Bajar de plan no puede dejar sucursales publicadas por encima del tope: si
    alguien con seis locales pasa a un plan de tres, hay que decirle cuáles
    quitar antes, no elegirlas por él.
  */
  const { count } = await supabase
    .from("sucursales")
    .select("id", { count: "exact", head: true })
    .eq("marca_id", marca.id);

  if ((count ?? 0) > tier.max_sucursales) {
    return {
      error: `Tienes ${count} sucursales y el plan ${tier.nombre} permite ${tier.max_sucursales}. Elimina las que ya no uses y vuelve a intentarlo.`,
    };
  }

  const cobro = await procesarPago({
    sucursalId: marca.id,
    tierId: tier.id,
    montoMensual: tier.precio_mensual,
  });

  if (!cobro.ok) return { error: `No se pudo completar el pago: ${cobro.motivo}` };

  if (vigente) {
    await supabase
      .from("suscripciones")
      .update({ estado: "cancelado" })
      .eq("id", vigente.id);
  }

  const { error } = await supabase.from("suscripciones").insert({
    marca_id: marca.id,
    tier_id: tier.id,
    monto_mensual: tier.precio_mensual,
    fecha_proximo_cobro: proximoCobro().toISOString(),
    metodo_pago_stub: cobro.referencia,
  });

  if (error) return { error: "El cobro pasó pero no se registró el plan. Avísanos." };

  // El `tier_id` de cada sucursal es el reflejo del plan de su marca: de ahí
  // leen el micrositio y el panel si reparte monedas o sale en el banner.
  await supabase
    .from("sucursales")
    .update({ tier_id: tier.id })
    .eq("marca_id", marca.id);

  revalidatePath("/negocio/panel");
  return { ok: `Listo, tu cuenta está en el plan ${tier.nombre}.` };
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

  const { error } = await supabase
    .from("suscripciones")
    .update({ estado: "cancelado" })
    .eq("marca_id", marca.id)
    .eq("estado", "activo");

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
