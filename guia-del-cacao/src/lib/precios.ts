import { pesos, type Tier } from "@/lib/tipos";

/**
 * Lo que cuesta un plan, para enseñarlo antes de contratar.
 *
 * **La cuenta que vale es la de la base** (`precio_de_suscripcion`, migración
 * 000053): ella fija el monto al abrir la suscripción y lo que se mande desde
 * aquí se sobrescribe. Esta es una copia para la pantalla; si se cambia una
 * regla, se cambia en las dos.
 */

export type Periodo = "mensual" | "anual";

/** Lo que trae un código de convenio vigente (`revisar_convenio`). */
export type Oferta = {
  codigo: string;
  descripcion: string;
  /** El plan Gratis dura hasta esta fecha, si es más que los 30 días. */
  basicoGratisHasta: string | null;
  descuento: number;
  /**
   * Promoción: pagar un mes de este plan, con el descuento, lo cubre hasta
   * `cubreHasta`. Los dos van juntos o ninguno.
   */
  planId: number | null;
  cubreHasta: string | null;
  /** Cuántas veces más se puede canjear. Null: sin límite o no se sabe. */
  quedan: number | null;
  /**
   * Código de un Embajador del Cacao: su nombre. El descuento es solo del
   * primer pago (migración 000059), no de cada mes como el de un convenio.
   */
  embajador: string | null;
  /**
   * El código destacado del asesor (migración 000070): no descuenta nada y
   * deja al negocio `MESES_DE_DESTACADO` meses en «Destacados» de la portada.
   */
  destacado?: boolean;
};

/** Una fila de `revisar_convenio` o `convenio_de_sucursal`, como `Oferta`. */
export type FilaDeConvenio = {
  descripcion: string;
  basico_gratis_hasta: string | null;
  descuento: number;
  plan_id: number | null;
  cubre_hasta: string | null;
  quedan?: number | null;
};

export function ofertaDeFila(codigo: string, fila: FilaDeConvenio): Oferta {
  return {
    codigo,
    descripcion: fila.descripcion,
    basicoGratisHasta: fila.basico_gratis_hasta,
    descuento: Number(fila.descuento),
    planId: fila.plan_id === null ? null : Number(fila.plan_id),
    cubreHasta: fila.cubre_hasta,
    quedan: fila.quedan ?? null,
    embajador: null,
  };
}

/**
 * El código de un asesor de ventas, como `Oferta`: el de descuento da
 * `DESCUENTO_DE_EMBAJADOR`% en el primer pago; el destacado no descuenta y
 * pone al negocio en «Destacados» de la portada.
 */
export function ofertaDeEmbajador(
  codigo: string,
  nombre: string,
  tipo: "descuento" | "destacado" = "descuento",
): Oferta {
  if (tipo === "destacado") {
    return {
      codigo,
      descripcion: `Código de ${nombre}, asesor de la Guía: tu negocio sale en Destacados de la portada durante ${MESES_DE_DESTACADO} meses.`,
      basicoGratisHasta: null,
      descuento: 0,
      planId: null,
      cubreHasta: null,
      quedan: null,
      embajador: nombre,
      destacado: true,
    };
  }

  return {
    codigo,
    descripcion: `Código de ${nombre}, asesor de la Guía: ${DESCUENTO_DE_EMBAJADOR}% de descuento en tu primer pago.`,
    basicoGratisHasta: null,
    descuento: DESCUENTO_DE_EMBAJADOR,
    planId: null,
    cubreHasta: null,
    quedan: null,
    embajador: nombre,
  };
}

/**
 * El pago anual regala dos meses: cuesta diez mensualidades. La base lo tiene
 * en `public.meses_pagados_al_anio()` (migración 000055). No se suma al
 * descuento de un convenio: queda el más barato.
 */
export const MESES_PAGADOS_AL_ANIO = 10;

/** Lo que dura el plan Gratis. La base lo tiene en `public.dias_gratis()`. */
export const DIAS_GRATIS = 15;

/**
 * Las cuentas de ventas: el negocio se descuenta 15% en su primer pago, y el
 * vendedor gana 25% de **cada** cobro de ese negocio, ya con el descuento,
 * hasta su `comision_hasta` (migraciones 000065 y 000067). La base los tiene
 * en `descuento_de_embajador()` y `comision_de_embajador()`.
 */
export const DESCUENTO_DE_EMBAJADOR = 15;
export const COMISION_DE_EMBAJADOR = 25;

/**
 * Cuánto dura un negocio en «Destacados» desde que pone el código destacado de
 * su asesor (migración 000070). La base lo tiene en `meses_de_destacado()`.
 */
export const MESES_DE_DESTACADO = 3;

const DIA = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

/** «30 de noviembre». */
export function fechaDeOferta(fecha: string) {
  return DIA.format(new Date(`${fecha}T00:00:00Z`));
}

/** Hoy en el centro de México, como `aaaa-mm-dd`. */
function hoy() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
  }).format(new Date());
}

/** El plan más barato es el Gratis. Así lo decide también la base. */
export function esPlanGratis(tier: Tier, tiers: Tier[]) {
  const masBarato = [...tiers].sort((a, b) => a.precio_mensual - b.precio_mensual)[0];
  return tier.id === masBarato?.id;
}

/** La oferta trae una promoción para este plan, y todavía se puede pagar. */
export function promocionPara(tier: Pick<Tier, "id">, oferta: Oferta | null) {
  return Boolean(
    oferta?.planId === tier.id && oferta.cubreHasta && hoy() <= oferta.cubreHasta,
  );
}

export type Precio = {
  /** Lo que se cobra ahora: cada periodo, o el pago único de la promoción. */
  cobro: number;
  /** Lo que se cobraría sin descuento, para tacharlo. Null si no hay. */
  antes: number | null;
  /** Gratis hasta una fecha (plan Gratis con convenio). */
  gratisHasta: string | null;
  /** Promoción: el pago de ahora cubre hasta esta fecha. */
  cubreHasta: string | null;
  /** Promoción: lo que se cobra después de `cubreHasta`, cada periodo. */
  despues: number | null;
  /** El descuento es solo de este cobro (código de embajador); `despues` es el normal. */
  soloPrimerPago: boolean;
  periodo: Periodo;
};

export function precioDe(
  tier: Tier,
  tiers: Tier[],
  periodo: Periodo,
  oferta: Oferta | null,
): Precio {
  const base = Number(tier.precio_mensual);
  const vacio = {
    antes: null,
    gratisHasta: null,
    cubreHasta: null,
    despues: null,
    soloPrimerPago: false,
  };

  if (esPlanGratis(tier, tiers)) {
    const hasta =
      oferta?.basicoGratisHasta && hoy() <= oferta.basicoGratisHasta
        ? oferta.basicoGratisHasta
        : null;
    return { ...vacio, cobro: 0, gratisHasta: hasta, periodo };
  }

  const anual = base * MESES_PAGADOS_AL_ANIO;
  const normal = periodo === "anual" ? anual : base;

  if (oferta && promocionPara(tier, oferta)) {
    return {
      ...vacio,
      cobro: Math.round(base * (1 - oferta.descuento / 100)),
      antes: base,
      cubreHasta: oferta.cubreHasta,
      despues: normal,
      periodo,
    };
  }

  // El de un embajador también, pero sin fecha: el primer cobro, sea del mes o
  // del año, va con descuento y los siguientes al precio normal.
  // El destacado no descuenta: su precio es el normal.
  if (oferta?.embajador && !oferta.destacado) {
    return {
      ...vacio,
      cobro: Math.round(normal * (1 - oferta.descuento / 100) * 100) / 100,
      antes: normal,
      despues: normal,
      soloPrimerPago: true,
      periodo,
    };
  }

  // El descuento de una promoción es solo de su primer pago.
  const descuento = oferta && oferta.planId === null ? oferta.descuento : 0;

  if (periodo === "anual") {
    // Dos meses gratis, o el convenio si descuenta más: el más barato.
    const lleno = base * 12;
    return {
      ...vacio,
      cobro: Math.min(anual, Math.round(lleno * (1 - descuento / 100))),
      antes: lleno,
      periodo,
    };
  }

  return {
    ...vacio,
    cobro: Math.round(base * (1 - descuento / 100)),
    antes: descuento > 0 ? base : null,
    periodo,
  };
}

/** «$199/mes», «$1,910/año» o «Gratis». */
export function textoDePrecio(cobro: number, periodo: Periodo) {
  if (Number(cobro) === 0) return "Gratis";
  return `${pesos(cobro)}/${periodo === "anual" ? "año" : "mes"}`;
}
