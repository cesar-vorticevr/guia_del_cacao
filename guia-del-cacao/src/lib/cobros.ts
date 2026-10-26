import type Stripe from "stripe";
import { crearClienteDeServicio } from "@/lib/supabase/servicio";
import { APP } from "@/lib/stripe";
import { registrarComision } from "@/lib/embajadores";

/**
 * Lo que hace la Guía cuando Stripe avisa de un cobro (`/api/stripe/webhook`).
 *
 * Aquí se decide quién queda pagado y quién se oculta. Corre con la llave de
 * servicio porque llega sin sesión de nadie; por eso cada función filtra a
 * mano por la suscripción de Stripe que nombra el evento.
 *
 * Todas son **idempotentes**: Stripe reintenta un aviso si no recibe un 200 a
 * tiempo, y el mismo evento puede llegar dos veces.
 */

type Servicio = ReturnType<typeof crearClienteDeServicio>;

const ABIERTAS = ["trial", "activo", "pausado_por_pago"];

/** El evento es de la Guía y no de la web de Vórtice VR, que comparte la cuenta. */
export function esDeLaGuia(metadata: Stripe.Metadata | null | undefined) {
  return metadata?.app === APP;
}

/** El id de un objeto que Stripe puede mandar expandido o como cadena. */
function idDe(valor: string | { id: string } | null | undefined) {
  if (!valor) return null;
  return typeof valor === "string" ? valor : valor.id;
}

/** Fin del periodo que se acaba de pagar, para `fecha_proximo_cobro`. */
function finDelPeriodo(suscripcion: Stripe.Subscription) {
  const renglon = suscripcion.items.data[0];
  const fin = suscripcion.trial_end && suscripcion.status === "trialing"
    ? suscripcion.trial_end
    : renglon?.current_period_end;
  return fin ? new Date(fin * 1000).toISOString() : new Date().toISOString();
}

/** Vuelve a publicar las sucursales que estaban ocultas por no pagar. */
async function republicar(servicio: Servicio, sucursalIds: string[]) {
  if (sucursalIds.length === 0) return;
  await servicio
    .from("sucursales")
    .update({ estado: "publicado" })
    .in("id", sucursalIds)
    .eq("estado", "pausado");
}

/**
 * Pagó en Checkout: se abren las suscripciones de cada sucursal, ya pagadas.
 *
 * Como en `contratarPlan`, no se edita la fila vieja: se cierra y se abre otra,
 * y el monto lo vuelve a fijar `precio_de_suscripcion` con el plan, el periodo
 * y el convenio. Con promoción, ese mismo trigger guarda el pago de apertura y
 * el próximo cobro al vencer lo que cubre.
 */
export async function pagoCompletado(sesion: Stripe.Checkout.Session, suscripcion: Stripe.Subscription) {
  const servicio = crearClienteDeServicio();
  const meta = sesion.metadata ?? {};
  const sucursalIds = (meta.sucursales ?? "").split(",").filter(Boolean);
  const tierId = Number(meta.tier_id);

  if (sucursalIds.length === 0 || !tierId) return;

  // Ya procesado: Stripe repitió el aviso.
  const { count } = await servicio
    .from("suscripciones")
    .select("id", { count: "exact", head: true })
    .eq("stripe_subscription_id", suscripcion.id);
  if ((count ?? 0) > 0) return;

  const clienteId = idDe(sesion.customer);
  if (clienteId && meta.marca_id) {
    await servicio.from("marcas").update({ stripe_customer_id: clienteId }).eq("id", meta.marca_id);
  }

  const { data: abiertas } = await servicio
    .from("suscripciones")
    .select("id, sucursal_id, estado")
    .in("sucursal_id", sucursalIds)
    .in("estado", ABIERTAS);

  const ocultasPorPago = (abiertas ?? [])
    .filter((fila) => fila.estado === "pausado_por_pago")
    .map((fila) => fila.sucursal_id as string);

  if ((abiertas ?? []).length > 0) {
    await servicio
      .from("suscripciones")
      .update({ estado: "cancelado" })
      .in("id", (abiertas ?? []).map((fila) => fila.id));
  }

  await servicio.from("suscripciones").insert(
    sucursalIds.map((sucursalId) => ({
      sucursal_id: sucursalId,
      tier_id: tierId,
      monto_mensual: 0,
      periodo: meta.periodo === "anual" ? "anual" : "mensual",
      convenio_id: meta.convenio_id || null,
      estado: "activo",
      fecha_proximo_cobro: finDelPeriodo(suscripcion),
      metodo_pago_stub: suscripcion.id,
      stripe_subscription_id: suscripcion.id,
    })),
  );

  await servicio.from("sucursales").update({ tier_id: tierId }).in("id", sucursalIds);
  await republicar(servicio, ocultasPorPago);

  // Llegó con código de embajador: su comisión es el 20% de lo que Stripe
  // cobró de verdad, ya con el descuento. La base no la anota dos veces.
  if (meta.embajador_id && meta.marca_id) {
    await registrarComision(meta.marca_id, (sesion.amount_total ?? 0) / 100, suscripcion.id);
  }
}

/** Entró un cobro (la renovación de cada mes o año): sigue pagado. */
export async function facturaPagada(suscripcion: Stripe.Subscription) {
  const servicio = crearClienteDeServicio();

  const { data: filas } = await servicio
    .from("suscripciones")
    .select("id, sucursal_id, estado")
    .eq("stripe_subscription_id", suscripcion.id)
    .in("estado", ["activo", "pausado_por_pago"]);

  if (!filas || filas.length === 0) return;

  await servicio
    .from("suscripciones")
    .update({ estado: "activo", fecha_proximo_cobro: finDelPeriodo(suscripcion) })
    .in("id", filas.map((fila) => fila.id));

  await republicar(
    servicio,
    filas.filter((fila) => fila.estado === "pausado_por_pago").map((fila) => fila.sucursal_id as string),
  );
}

/**
 * Stripe dio el cobro por perdido (la suscripción quedó impagada o se canceló
 * sin que la Guía lo pidiera): la sucursal sale del directorio. No se borra
 * nada; vuelve en cuanto pague.
 *
 * Un primer rechazo (`past_due`) todavía no oculta: Stripe reintenta durante
 * unos días, y una tarjeta vencida no debería apagar un negocio de golpe.
 */
export async function cobroPerdido(suscripcion: Stripe.Subscription) {
  const servicio = crearClienteDeServicio();

  const { data: filas } = await servicio
    .from("suscripciones")
    .select("id, sucursal_id")
    .eq("stripe_subscription_id", suscripcion.id)
    .eq("estado", "activo");

  if (!filas || filas.length === 0) return;

  await servicio
    .from("suscripciones")
    .update({ estado: "pausado_por_pago" })
    .in("id", filas.map((fila) => fila.id));

  await servicio
    .from("sucursales")
    .update({ estado: "pausado" })
    .in("id", filas.map((fila) => fila.sucursal_id as string))
    .eq("estado", "publicado");
}
