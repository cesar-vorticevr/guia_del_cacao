import Stripe from "stripe";
import { crearClienteDeServicio } from "@/lib/supabase/servicio";
import { precioDe, type Oferta, type Periodo } from "@/lib/precios";
import type { Tier } from "@/lib/tipos";

/**
 * Stripe: el cobro de verdad.
 *
 * Todo lo que habla con Stripe vive aquí y solo corre en el servidor. La
 * tarjeta la captura Stripe Checkout, en su propia página: nunca pasa por la
 * Guía, que solo guarda identificadores (`stripe_customer_id`,
 * `stripe_subscription_id`, migración 000056).
 *
 * El precio no se guarda en Stripe: se manda en cada cobro (`price_data`) con
 * la misma cuenta que enseña la pantalla, `precioDe` de `lib/precios.ts`, que
 * es el espejo de `precio_de_suscripcion`. Así no hay una lista de precios en
 * el panel de Stripe que se pueda quedar atrás de la de la base.
 */

/**
 * La etiqueta que marca un cobro como de la Guía.
 *
 * La cuenta de Stripe es la de Vórtice VR y la comparte con su propia web: los
 * webhooks de la cuenta reciben los eventos de las dos. El de la Guía ignora
 * todo lo que no traiga esta etiqueta en su metadata, y el de la web de
 * Vórtice debe ignorar lo que sí la traiga.
 */
export const APP = "guia-del-cacao";

let cliente: Stripe | null = null;

/** El cliente de Stripe, o null si no hay llave (cobro simulado). */
export function stripe() {
  const llave = process.env.STRIPE_SECRET_KEY;
  if (!llave) return null;
  cliente ??= new Stripe(llave);
  return cliente;
}

/** Pesos a centavos, que es como cuenta Stripe. */
function centavos(pesos: number) {
  return Math.round(pesos * 100);
}

/**
 * Medianoche del día siguiente a `fecha`, en el centro de México, como
 * segundos Unix: el momento en que vence lo que cubre una promoción. México
 * no tiene horario de verano desde 2022, así que es siempre UTC-6.
 */
function diaSiguienteEnMexico(fecha: string) {
  return Math.floor((Date.parse(`${fecha}T06:00:00Z`) + 86_400_000) / 1000);
}

/**
 * El producto de Stripe de un plan. Se crea la primera vez que se cobra y se
 * guarda en `tiers.stripe_product_id`, para que todos los cobros de un mismo
 * plan salgan agrupados en el panel de Stripe.
 */
async function productoDelPlan(tier: Tier) {
  const servicio = crearClienteDeServicio();
  const { data } = await servicio
    .from("tiers")
    .select("stripe_product_id")
    .eq("id", tier.id)
    .maybeSingle();

  if (data?.stripe_product_id) return data.stripe_product_id as string;

  const producto = await stripe()!.products.create({
    name: `Guía del Cacao · Plan ${tier.nombre}`,
    metadata: { app: APP, tier_id: String(tier.id) },
  });

  await servicio.from("tiers").update({ stripe_product_id: producto.id }).eq("id", tier.id);
  return producto.id;
}

/** Lo que se cobra cada periodo, como `price_data` de una suscripción. */
async function precioRecurrente(tier: Tier, tiers: Tier[], periodo: Periodo, oferta: Oferta | null) {
  const precio = precioDe(tier, tiers, periodo, oferta);
  // Con promoción, lo recurrente es lo de después; lo de ahora va aparte.
  const monto = precio.cubreHasta ? (precio.despues ?? 0) : precio.cobro;

  return {
    currency: "mxn",
    product: await productoDelPlan(tier),
    unit_amount: centavos(monto),
    recurring: { interval: periodo === "anual" ? ("year" as const) : ("month" as const) },
  };
}

export type DatosDelPago = {
  marcaId: string;
  /** Cliente de Stripe de la marca, si ya pagó antes. */
  clienteStripe: string | null;
  correo: string;
  sucursalIds: string[];
  tier: Tier;
  tiers: Tier[];
  periodo: Periodo;
  oferta: Oferta | null;
  convenioId: string | null;
  /** A dónde vuelve al pagar y al arrepentirse. */
  exito: string;
  cancelado: string;
};

/**
 * Abre la página de pago de Stripe y devuelve su dirección.
 *
 * Una sola suscripción de Stripe para todas las sucursales que se pagan
 * juntas: una unidad por sucursal. Con promoción, su pago va como un cargo
 * único y la mensualidad normal arranca cuando vence lo que cubre.
 *
 * Lo que pasa después —abrir las suscripciones, volver a publicar— no se hace
 * aquí sino en el webhook, cuando Stripe confirma el cobro: volver de la página
 * de pago no prueba nada.
 */
export async function crearPago(datos: DatosDelPago) {
  const precio = precioDe(datos.tier, datos.tiers, datos.periodo, datos.oferta);
  const cuantas = datos.sucursalIds.length;
  const producto = await productoDelPlan(datos.tier);

  const metadata = {
    app: APP,
    marca_id: datos.marcaId,
    sucursales: datos.sucursalIds.join(","),
    tier_id: String(datos.tier.id),
    periodo: datos.periodo,
    convenio_id: datos.convenioId ?? "",
  };

  const lineas: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    {
      price_data: await precioRecurrente(datos.tier, datos.tiers, datos.periodo, datos.oferta),
      quantity: cuantas,
    },
  ];

  if (precio.cubreHasta) {
    lineas.push({
      price_data: {
        currency: "mxn",
        product: producto,
        unit_amount: centavos(precio.cobro),
      },
      quantity: cuantas,
    });
  }

  const sesion = await stripe()!.checkout.sessions.create({
    mode: "subscription",
    locale: "es",
    ...(datos.clienteStripe
      ? { customer: datos.clienteStripe }
      : { customer_email: datos.correo }),
    client_reference_id: datos.marcaId,
    line_items: lineas,
    metadata,
    subscription_data: {
      metadata,
      ...(precio.cubreHasta ? { trial_end: diaSiguienteEnMexico(precio.cubreHasta) } : {}),
    },
    success_url: datos.exito,
    cancel_url: datos.cancelado,
  });

  if (!sesion.url) throw new Error("Stripe no devolvió la página de pago.");
  return sesion.url;
}

/**
 * Cambia el plan o el periodo de una suscripción que ya se paga.
 *
 * Stripe prorratea: cobra o abona la diferencia en la siguiente factura. La
 * cantidad (cuántas sucursales cubre) no cambia.
 */
export async function cambiarPrecio(
  suscripcionId: string,
  tier: Tier,
  tiers: Tier[],
  periodo: Periodo,
  oferta: Oferta | null,
) {
  const s = stripe()!;
  const actual = await s.subscriptions.retrieve(suscripcionId);
  const renglon = actual.items.data[0];

  await s.subscriptions.update(suscripcionId, {
    items: [
      {
        id: renglon.id,
        price_data: await precioRecurrente(tier, tiers, periodo, oferta),
        quantity: renglon.quantity ?? 1,
      },
    ],
    proration_behavior: "create_prorations",
    metadata: { app: APP, tier_id: String(tier.id), periodo },
  });
}

/** Da de baja suscripciones de Stripe en el acto. No se devuelve lo pagado. */
export async function cancelarEnStripe(suscripcionIds: string[]) {
  const s = stripe();
  if (!s) return;

  for (const id of new Set(suscripcionIds)) {
    try {
      await s.subscriptions.cancel(id);
    } catch (error) {
      // Ya cancelada en Stripe: lo que importa es que no se vuelva a cobrar.
      if ((error as Stripe.errors.StripeError).code !== "resource_missing") throw error;
    }
  }
}

/** El portal de Stripe donde el negocio cambia su tarjeta y ve sus recibos. */
export async function abrirPortalDeStripe(clienteId: string, regreso: string) {
  const sesion = await stripe()!.billingPortal.sessions.create({
    customer: clienteId,
    return_url: regreso,
    locale: "es",
  });
  return sesion.url;
}
