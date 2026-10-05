import { pesos, type Tier } from "@/lib/tipos";

/**
 * Lo que cuesta un plan, para enseñarlo antes de contratar.
 *
 * **La cuenta que vale es la de la base** (`precio_de_suscripcion`, migración
 * 000051): ella fija el monto al abrir la suscripción y lo que se mande desde
 * aquí se sobrescribe. Esta es una copia para la pantalla; si se cambia una
 * regla, se cambia en las dos.
 */

export type Periodo = "mensual" | "anual";

/** Lo que trae un código de convenio vigente (`revisar_convenio`). */
export type Oferta = {
  codigo: string;
  descripcion: string;
  basicoGratisHasta: string | null;
  descuento: number;
};

/** El descuento del pago anual. No se suma al de un convenio: queda el mayor. */
export const DESCUENTO_ANUAL = 20;

const DIA = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

export function fechaDeOferta(fecha: string) {
  return DIA.format(new Date(`${fecha}T00:00:00Z`));
}

export type Precio = {
  /** Lo que se cobra cada periodo. */
  cobro: number;
  /** Lo que se cobraría sin descuento, para tacharlo. Null si no hay. */
  antes: number | null;
  /** Gratis hasta una fecha (Básico con convenio). */
  gratisHasta: string | null;
  periodo: Periodo;
};

export function precioDe(
  tier: Tier,
  tiers: Tier[],
  periodo: Periodo,
  oferta: Oferta | null,
): Precio {
  const basico = [...tiers].sort((a, b) => a.precio_mensual - b.precio_mensual)[0];
  const esBasico = tier.id === basico?.id;
  const base = Number(tier.precio_mensual);

  if (oferta && esBasico && oferta.basicoGratisHasta) {
    return { cobro: 0, antes: null, gratisHasta: oferta.basicoGratisHasta, periodo };
  }

  let descuento = oferta && !esBasico ? oferta.descuento : 0;

  if (periodo === "anual") {
    descuento = Math.max(descuento, DESCUENTO_ANUAL);
    const lleno = base * 12;
    return {
      cobro: Math.round(lleno * (1 - descuento / 100)),
      antes: lleno,
      gratisHasta: null,
      periodo,
    };
  }

  return {
    cobro: Math.round(base * (1 - descuento / 100)),
    antes: descuento > 0 ? base : null,
    gratisHasta: null,
    periodo,
  };
}

/** «$159/mes», «$2,870/año» o «Gratis». */
export function textoDePrecio(cobro: number, periodo: Periodo) {
  if (Number(cobro) === 0) return "Gratis";
  return `${pesos(cobro)}/${periodo === "anual" ? "año" : "mes"}`;
}
