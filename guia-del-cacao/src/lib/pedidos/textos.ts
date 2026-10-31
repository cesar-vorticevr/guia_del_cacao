import type { EstadoDePedido } from "@/lib/datos/pedidos";

/** Cómo se lee cada paso, para quien pide y para quien vende. */
export const ESTADOS_DE_PEDIDO: Record<
  EstadoDePedido,
  { texto: string; cliente: string; negocio: string; color: string }
> = {
  nuevo: {
    texto: "Nuevo",
    cliente: "Esperando a que el negocio confirme que lo tiene. Todavía no pagues.",
    negocio: "Revisa que lo tengas y confirma el total. Hasta entonces el cliente no ve tu CLABE.",
    color: "bg-mango text-ink",
  },
  confirmado: {
    texto: "Confirmado",
    cliente: "El negocio lo tiene. Transfiere el total y avísale con «Ya transferí».",
    negocio: "Esperando la transferencia. Márcalo pagado cuando la veas en tu banco.",
    color: "bg-selva text-white",
  },
  pagado: {
    texto: "Pagado",
    cliente: "El negocio recibió tu pago.",
    negocio: "Pagado. Márcalo entregado cuando lo reciba.",
    color: "bg-selva-2 text-white",
  },
  entregado: {
    texto: "Entregado",
    cliente: "Entregado. ¡Que lo disfrutes!",
    negocio: "Entregado.",
    color: "bg-crema-2 text-selva-2",
  },
  cancelado: {
    texto: "Cancelado",
    cliente: "Cancelado.",
    negocio: "Cancelado.",
    color: "bg-guayaba/15 text-guayaba",
  },
};

/** Lo que cabe en un pedido. La base lo vuelve a exigir (`hacer_pedido`). */
export const MAX_PIEZAS = 99;
export const MAX_PRODUCTOS = 30;
