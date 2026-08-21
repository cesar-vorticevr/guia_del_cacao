/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  PENDIENTE DE CONECTAR — cobro simulado
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Todavía no hay cuenta de pasarela (spec §4). Este archivo es el único punto
 * del sistema que "cobra": el resto del flujo —elegir plan, estados de la
 * sucursal, alta de la suscripción— ya es definitivo y no habrá que rediseñarlo
 * cuando exista proveedor real.
 *
 * Para conectarlo de verdad (Stripe, Conekta o Mercado Pago), se reemplaza el
 * cuerpo de `procesarPago` por la llamada al proveedor y se guarda su
 * identificador de cobro en `suscripciones.metodo_pago_stub`. Nada más de la
 * aplicación debería cambiar.
 *
 * IMPORTANTE: aquí no se guardan ni se validan datos de tarjeta. Cuando entre
 * el proveedor real, los datos deben capturarse en su widget alojado, para que
 * la tarjeta nunca toque este servidor.
 */

export type ResultadoPago =
  | { ok: true; referencia: string }
  | { ok: false; motivo: string };

export type DatosCobro = {
  sucursalId: string;
  tierId: number;
  montoMensual: number;
};

/** Fecha del próximo cobro: un mes después del que se acaba de "hacer". */
export function proximoCobro(desde = new Date()) {
  const siguiente = new Date(desde);
  siguiente.setMonth(siguiente.getMonth() + 1);
  return siguiente;
}

export async function procesarPago(datos: DatosCobro): Promise<ResultadoPago> {
  // SIMULADO: siempre aprueba. No hay cargo real de por medio.
  return {
    ok: true,
    referencia: `simulado-${datos.sucursalId.slice(0, 8)}-${datos.tierId}`,
  };
}

/** true mientras el cobro sea de mentiras, para poder avisarlo en pantalla. */
export const PAGO_SIMULADO = true;
