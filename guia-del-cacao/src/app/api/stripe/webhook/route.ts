import type Stripe from "stripe";
import {
  cobroPerdido,
  comisionDeLaFactura,
  esDeLaGuia,
  experienciaPagada,
  facturaPagada,
  pagoCompletado,
} from "@/lib/cobros";
import { stripe } from "@/lib/stripe";

/**
 * Los avisos de Stripe: un pago completado, una renovación, un cobro perdido.
 *
 * **La firma se comprueba antes de nada** (`STRIPE_WEBHOOK_SECRET`): sin eso,
 * cualquiera podría mandar aquí un «ya pagué» inventado. Por eso el cuerpo se
 * lee como texto crudo: la firma es sobre los bytes exactos que mandó Stripe.
 *
 * La cuenta de Stripe es la de Vórtice VR y su web también cobra con ella, así
 * que aquí llegan eventos de las dos. Lo que no trae la etiqueta de la Guía se
 * contesta con 200 y se ignora (`esDeLaGuia`).
 */
export async function POST(request: Request) {
  const cliente = stripe();
  const secreto = process.env.STRIPE_WEBHOOK_SECRET;

  if (!cliente || !secreto) {
    return new Response("Stripe no está configurado.", { status: 503 });
  }

  const firma = request.headers.get("stripe-signature");
  if (!firma) return new Response("Falta la firma.", { status: 400 });

  let evento: Stripe.Event;
  try {
    evento = cliente.webhooks.constructEvent(await request.text(), firma, secreto);
  } catch {
    return new Response("Firma inválida.", { status: 400 });
  }

  try {
    switch (evento.type) {
      case "checkout.session.completed": {
        const sesion = evento.data.object;
        if (!esDeLaGuia(sesion.metadata)) break;

        // Una experiencia de realidad aumentada más: pago único (000066).
        if (sesion.mode === "payment" && sesion.metadata?.tipo === "experiencia_extra") {
          if (sesion.payment_status === "paid") await experienciaPagada(sesion);
          break;
        }

        if (sesion.mode !== "subscription") break;

        const suscripcionId =
          typeof sesion.subscription === "string" ? sesion.subscription : sesion.subscription?.id;
        if (!suscripcionId) break;

        const suscripcion = await cliente.subscriptions.retrieve(suscripcionId);
        await pagoCompletado(sesion, suscripcion);
        break;
      }

      case "invoice.paid": {
        const factura = evento.data.object;
        const detalle = factura.parent?.subscription_details;
        if (!detalle || !esDeLaGuia(detalle.metadata)) break;

        const suscripcionId =
          typeof detalle.subscription === "string" ? detalle.subscription : detalle.subscription.id;
        await facturaPagada(await cliente.subscriptions.retrieve(suscripcionId));
        await comisionDeLaFactura(factura, suscripcionId);
        break;
      }

      case "customer.subscription.updated": {
        const suscripcion = evento.data.object;
        if (!esDeLaGuia(suscripcion.metadata)) break;

        if (suscripcion.status === "unpaid" || suscripcion.status === "canceled") {
          await cobroPerdido(suscripcion);
        } else if (suscripcion.status === "active") {
          await facturaPagada(suscripcion);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const suscripcion = evento.data.object;
        if (!esDeLaGuia(suscripcion.metadata)) break;
        // Si la canceló la Guía (cambio a Gratis o baja), sus filas ya están
        // cerradas y esto no encuentra nada que ocultar.
        await cobroPerdido(suscripcion);
        break;
      }
    }
  } catch (error) {
    // Un 500 hace que Stripe reintente el aviso más tarde.
    console.error("Webhook de Stripe:", evento.type, error);
    return new Response("No se pudo procesar.", { status: 500 });
  }

  return new Response("ok");
}
