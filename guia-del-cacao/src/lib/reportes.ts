/**
 * Por qué se reporta una reseña (migración 000054).
 *
 * Las claves están también en el `check` de `reportes_resena`: si se agrega
 * una, va en los dos lados.
 */
export const MOTIVOS_DE_REPORTE = {
  ofensiva: "Ofensiva o con insultos",
  falsa: "Falsa: no vino o no es de este negocio",
  spam: "Spam o publicidad",
  otro: "Otra razón",
} as const;

export type MotivoDeReporte = keyof typeof MOTIVOS_DE_REPORTE;

export function esMotivoDeReporte(valor: string): valor is MotivoDeReporte {
  return valor in MOTIVOS_DE_REPORTE;
}
