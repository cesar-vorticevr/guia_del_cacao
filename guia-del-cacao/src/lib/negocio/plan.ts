"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { perfilActual } from "@/lib/auth/sesion";
import { procesarPago, proximoCobro } from "@/lib/pagos";
import {
  fechaDeOferta,
  ofertaDeFila,
  promocionPara,
  type FilaDeConvenio,
  type Oferta,
} from "@/lib/precios";
import { normalizarCodigo } from "@/lib/tipos";
import { origenDelSitio } from "@/lib/auth/sesion";
import { listarTiers } from "@/lib/datos/sucursales";
import { crearClienteDeServicio } from "@/lib/supabase/servicio";
import { esPlanGratis } from "@/lib/precios";
import {
  abrirPortalDeStripe,
  cambiarPrecio,
  cancelarEnStripe,
  crearPago,
  stripe,
} from "@/lib/stripe";

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
    .select("id, sucursal_id, tier_id, monto_mensual, estado, fecha_fin_trial, convenio_id, periodo, stripe_subscription_id, fecha_proximo_cobro")
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

  const periodo = datos.get("periodo")?.toString() === "anual" ? "anual" : "mensual";
  const abiertas = await suscripcionesAbiertas(marca.id);

  /*
    Un código nuevo se puede poner también aquí, no solo al publicar: quien ya
    estaba en su prueba cuando salió la promoción de apertura tiene que poder
    usarla. Sin código, cada sucursal se queda con el convenio que ya tenía.
  */
  const codigo = (datos.get("codigo_convenio")?.toString() ?? "").trim();
  let convenioNuevo: string | null = null;
  let oferta: Oferta | null = null;

  if (codigo) {
    const { data, error } = await supabase.rpc("revisar_convenio", {
      p_codigo: codigo,
    });

    if (error) {
      return {
        error:
          error.code === "P0001"
            ? error.message
            : "No se pudo revisar el código. Inténtalo de nuevo.",
      };
    }

    const fila = (data as (FilaDeConvenio & { id: string })[] | null)?.[0];
    convenioNuevo = fila?.id ?? null;
    oferta = fila ? ofertaDeFila(normalizarCodigo(codigo), fila) : null;
  }

  // La promoción se paga ya, y deja a todas las sucursales pagadas hasta su
  // fecha: ninguna se queda en prueba.
  const promocion = promocionPara(tier, oferta);

  if (abiertas.length === 0) {
    return {
      error:
        "Todavía no tienes ninguna sucursal publicada. El plan se elige al publicar el micrositio.",
    };
  }

  // «Pagar ahora» con el mismo plan de la prueba no es «ya estás en ese plan».
  const pagar = datos.get("pagar")?.toString() === "si";

  if (
    !promocion &&
    !pagar &&
    abiertas.every((s) => s.tier_id === tier.id && s.periodo === periodo && s.estado !== "pausado_por_pago")
  ) {
    return { error: "Ya estás en ese plan." };
  }

  // Con Stripe conectado, el cobro es de verdad y va por su propio camino. Lo
  // de abajo es el cobro simulado, para cuando no hay llaves (local, pruebas).
  if (stripe() && !(promocion && oferta && oferta.descuento >= 100)) {
    return contratarConStripe({
      marcaId: marca.id,
      tierId: tier.id,
      periodo,
      abiertas,
      oferta: promocion ? oferta : null,
      convenioNuevo,
      pagar,
    });
  }

  /*
    Durante la prueba el cambio es gratis y no se cobra nada: "el negocio puede
    cambiar de tier libremente sin costo" (spec v2 §3.3, paso 7). Solo se cobra
    por las que ya estaban pagando.
  */
  const enPrueba = promocion ? [] : abiertas.filter((s) => s.estado === "trial");
  const pagando = promocion ? abiertas : abiertas.filter((s) => s.estado !== "trial");

  /*
    Ya no se comprueba ningún tope de sucursales. Desde la spec v2 el cobro es
    por sucursal, así que no hay un número que el plan permita: cada micrositio
    paga el suyo. Antes esto impedía bajar de plan con más locales de los que
    cabían, y esa idea desapareció con el tope.
  */

  let referencia: string | undefined;

  if (pagando.length > 0 && promocion && oferta && oferta.descuento >= 100) {
    // Al 100% no hay nada que cobrar: el código lo regala.
    referencia = `promocion-${oferta.codigo}`;
  } else if (pagando.length > 0) {
    const mensualidad =
      promocion && oferta
        ? Math.round(Number(tier.precio_mensual) * (1 - oferta.descuento / 100))
        : Number(tier.precio_mensual);

    const cobro = await procesarPago({
      sucursalId: marca.id,
      tierId: tier.id,
      montoMensual: mensualidad * pagando.length,
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
    if (
      !promocion &&
      abierta.tier_id === tier.id &&
      abierta.periodo === periodo &&
      abierta.estado !== "pausado_por_pago"
    ) {
      continue;
    }

    await supabase
      .from("suscripciones")
      .update({ estado: "cancelado" })
      .eq("id", abierta.id);

    /*
      El convenio pasa a la suscripción nueva: quien entró por el Festival
      conserva su descuento al cambiar de plan. El monto lo vuelve a calcular la
      base (`precio_de_suscripcion`) con el plan, el periodo y el convenio.
      Quien estaba oculto por no pagar y paga ahora, queda activo.
    */
    const { error } = await supabase.from("suscripciones").insert({
      sucursal_id: abierta.sucursal_id,
      tier_id: tier.id,
      monto_mensual: tier.precio_mensual,
      periodo,
      convenio_id: convenioNuevo ?? abierta.convenio_id,
      estado: abierta.estado === "trial" && !promocion ? "trial" : "activo",
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
      .update(
        // Oculta por no pagar y ya pagó: vuelve al directorio.
        abierta.estado === "pausado_por_pago"
          ? { tier_id: tier.id, estado: "publicado" }
          : { tier_id: tier.id },
      )
      .eq("id", abierta.sucursal_id);
  }

  revalidatePath("/negocio/panel");
  revalidatePath("/negocio/panel/cuenta");

  if (promocion && oferta?.cubreHasta) {
    return {
      ok: `Listo, tus micrositios están en ${tier.nombre}, pagado hasta el ${fechaDeOferta(oferta.cubreHasta)}.`,
    };
  }

  return {
    ok:
      enPrueba.length > 0 && pagando.length === 0
        ? `Listo, tu prueba sigue en el plan ${tier.nombre}. No se te cobró nada.`
        : `Listo, tus micrositios están en el plan ${tier.nombre}.`,
  };
}

type Abierta = Awaited<ReturnType<typeof suscripcionesAbiertas>>[number];

/**
 * Contratar o cambiar de plan con Stripe.
 *
 * Tres caminos, según dónde está cada sucursal:
 *
 * - **Pasarse a Gratis**: se da de baja en Stripe y queda en Gratis, con sus
 *   treinta días.
 * - **Las que ya pagan con tarjeta**: se les cambia el precio en Stripe, que
 *   prorratea la diferencia. No hay que volver a pagar.
 * - **Las que no pagan con tarjeta** (en prueba, ocultas por falta de pago o
 *   pagadas a mano antes de Stripe): si toca cobrarles —eligió «Pagar ahora»,
 *   trae promoción o ya no están en prueba— van a la página de pago de Stripe.
 *   Si solo cambian de plan durante la prueba, se cambia y no se cobra nada.
 *
 * Abrir y cerrar filas con `stripe_subscription_id` lo hace el cliente de
 * servicio: el negocio no puede escribir esa columna (migración 000056).
 */
async function contratarConStripe({
  marcaId,
  tierId,
  periodo,
  abiertas,
  oferta,
  convenioNuevo,
  pagar,
}: {
  marcaId: string;
  tierId: number;
  periodo: "mensual" | "anual";
  abiertas: Abierta[];
  oferta: Oferta | null;
  convenioNuevo: string | null;
  pagar: boolean;
}): Promise<EstadoPlan> {
  const tiers = await listarTiers();
  const tier = tiers.find((t) => t.id === tierId);
  if (!tier) return { error: "Ese plan no existe." };

  const servicio = crearClienteDeServicio();
  const conTarjeta = abiertas.filter((s) => s.stripe_subscription_id);
  const sinTarjeta = abiertas.filter((s) => !s.stripe_subscription_id);

  // Cierra unas filas y abre otras en su lugar, como siempre: el historial
  // guarda qué se pagó y hasta cuándo.
  async function reabrir(filas: Abierta[], cambios: (fila: Abierta) => Record<string, unknown>) {
    if (filas.length === 0) return;
    await servicio.from("suscripciones").update({ estado: "cancelado" }).in("id", filas.map((f) => f.id));
    await servicio.from("suscripciones").insert(
      filas.map((fila) => ({
        sucursal_id: fila.sucursal_id,
        tier_id: tier!.id,
        monto_mensual: 0,
        periodo,
        convenio_id: convenioNuevo ?? fila.convenio_id,
        fecha_proximo_cobro: proximoCobro().toISOString(),
        ...cambios(fila),
      })),
    );
    await servicio.from("sucursales").update({ tier_id: tier!.id }).in("id", filas.map((f) => f.sucursal_id));
  }

  // 1. A Gratis: se deja de cobrar.
  if (esPlanGratis(tier, tiers)) {
    await cancelarEnStripe(conTarjeta.map((s) => s.stripe_subscription_id!));
    await reabrir(abiertas, (fila) => ({
      estado: "trial",
      fecha_fin_trial: fila.estado === "trial" ? fila.fecha_fin_trial : null,
    }));
    revalidatePath("/negocio/panel/cuenta");
    return { ok: `Listo, tus micrositios están en ${tier.nombre}. Ya no se te cobrará.` };
  }

  if (oferta && conTarjeta.length > 0) {
    return {
      error:
        "La promoción es para quien todavía no paga con tarjeta. Tu plan actual sigue igual.",
    };
  }

  // 2. Las que ya pagan: Stripe cambia el precio y prorratea.
  for (const id of new Set(conTarjeta.map((s) => s.stripe_subscription_id!))) {
    await cambiarPrecio(id, tier, tiers, periodo, null);
  }
  await reabrir(conTarjeta, (fila) => ({
    estado: "activo",
    // El siguiente cobro lo marca Stripe y no cambia por cambiar de plan.
    fecha_proximo_cobro: fila.fecha_proximo_cobro,
    stripe_subscription_id: fila.stripe_subscription_id,
    metodo_pago_stub: fila.stripe_subscription_id,
  }));

  // 3. Las que no pagan con tarjeta.
  const porCobrar = sinTarjeta.filter((s) => pagar || oferta || s.estado !== "trial");
  const soloCambian = sinTarjeta.filter((s) => !porCobrar.includes(s));

  await reabrir(soloCambian, (fila) => ({ estado: "trial", fecha_fin_trial: fila.fecha_fin_trial }));

  if (porCobrar.length > 0) {
    const perfil = await perfilActual();
    const { data: marca } = await servicio
      .from("marcas")
      .select("stripe_customer_id")
      .eq("id", marcaId)
      .maybeSingle();
    const origen = await origenDelSitio();

    const url = await crearPago({
      marcaId,
      clienteStripe: (marca?.stripe_customer_id as string | null) ?? null,
      correo: perfil!.correo,
      sucursalIds: porCobrar.map((s) => s.sucursal_id),
      tier,
      tiers,
      periodo,
      oferta,
      convenioId: convenioNuevo,
      exito: `${origen}/negocio/panel/cuenta?pago=listo`,
      cancelado: `${origen}/negocio/panel/cuenta?pago=cancelado`,
    });

    // `redirect` lanza: va fuera de cualquier try.
    redirect(url);
  }

  revalidatePath("/negocio/panel");
  revalidatePath("/negocio/panel/cuenta");

  return {
    ok:
      conTarjeta.length > 0
        ? `Listo, tus micrositios están en ${tier.nombre}. La diferencia se ajusta en tu siguiente cobro.`
        : `Listo, tu prueba sigue en el plan ${tier.nombre}. No se te cobró nada.`,
  };
}

/**
 * El portal de Stripe: cambiar la tarjeta, ver recibos. Solo para quien ya
 * pagó alguna vez con tarjeta.
 */
export async function abrirPortalDePago() {
  const marca = await miMarca();
  const servicio = crearClienteDeServicio();

  const { data } = await servicio
    .from("marcas")
    .select("stripe_customer_id")
    .eq("id", marca.id)
    .maybeSingle();

  if (!data?.stripe_customer_id || !stripe()) redirect("/negocio/panel/cuenta");

  const origen = await origenDelSitio();
  redirect(await abrirPortalDeStripe(data.stripe_customer_id as string, `${origen}/negocio/panel/cuenta`));
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

  // Primero Stripe: lo que importa es que no se vuelva a cobrar.
  await cancelarEnStripe(
    abiertas.flatMap((s) => (s.stripe_subscription_id ? [s.stripe_subscription_id] : [])),
  );

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
