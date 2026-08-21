/**
 * Cómo se llaman las cosas de cara al público.
 *
 * El nombre de la unidad del pasaporte era una decisión abierta del spec §10
 * ("mazorcas / monedas de chocolate / otro"). Quedó en monedas de chocolate,
 * pero vive aquí y no repartido por la interfaz: si algún día cambia, se
 * cambia en un solo lugar.
 *
 * En la base de datos las columnas siguen llamándose `puntos_*`. Es a
 * propósito: ahí se guarda la unidad, aquí se le pone nombre comercial. Mezclar
 * las dos cosas obligaría a una migración cada vez que cambie la marca.
 */
export const MONEDA = {
  singular: "moneda de chocolate",
  plural: "monedas de chocolate",
  /** Para espacios cortos, cuando ya quedó claro de qué se habla. */
  unaCorta: "moneda",
  variasCortas: "monedas",
} as const;

/** "1 moneda de chocolate" / "3 monedas de chocolate". */
export function conMonedas(cantidad: number, corto = false) {
  const una = corto ? MONEDA.unaCorta : MONEDA.singular;
  const varias = corto ? MONEDA.variasCortas : MONEDA.plural;

  return `${cantidad} ${cantidad === 1 ? una : varias}`;
}

/** Solo el sustantivo, sin la cantidad. */
export function monedas(cantidad: number, corto = false) {
  if (corto) return cantidad === 1 ? MONEDA.unaCorta : MONEDA.variasCortas;
  return cantidad === 1 ? MONEDA.singular : MONEDA.plural;
}

/**
 * La escalera de rangos (spec §5.4), con nombre.
 *
 * Los cortes son los mismos que calcula `public.calcular_rango` en la base;
 * aquí solo se les pone nombre y se usan para decir cuánto falta para el
 * siguiente. Si alguna vez cambian los números, tienen que cambiar en los dos
 * lados: la base es la que manda, esto solo lo explica.
 *
 * El plural existe porque los eventos exclusivos hablan de un grupo
 * ("solo para Maestros cacaoteros"), no de una persona.
 */
export const RANGOS = [
  { nivel: 1, nombre: "Curioso", plural: "Curiosos", desde: 0 },
  { nivel: 2, nombre: "Catador", plural: "Catadores", desde: 20 },
  { nivel: 3, nombre: "Conocedor", plural: "Conocedores", desde: 50 },
  { nivel: 4, nombre: "Maestro cacaotero", plural: "Maestros cacaoteros", desde: 100 },
] as const;

export type Rango = (typeof RANGOS)[number];

export function rango(nivel: number): Rango {
  return RANGOS.find((r) => r.nivel === nivel) ?? RANGOS[0];
}

export function siguienteRango(nivel: number): Rango | undefined {
  return RANGOS.find((r) => r.nivel === nivel + 1);
}
