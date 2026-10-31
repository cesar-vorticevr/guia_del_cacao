/**
 * Lo que el buzón (migración 000069) dice con palabras.
 *
 * Los motivos están también en el `check` de `reportes_conversacion`, y el
 * largo en el de `mensajes`: si se cambia uno, va en los dos lados.
 */
export const MOTIVOS_DE_MENSAJE = {
  ofensivo: "Ofensivo o con insultos",
  acoso: "Acoso o insistencia que no quiero",
  spam: "Spam o publicidad",
  fraude: "Fraude o engaño",
  otro: "Otra razón",
} as const;

export type MotivoDeMensaje = keyof typeof MOTIVOS_DE_MENSAJE;

export function esMotivoDeMensaje(valor: string): valor is MotivoDeMensaje {
  return valor in MOTIVOS_DE_MENSAJE;
}

export const LARGO_DE_MENSAJE = 2000;

/** Cómo se presenta cada tipo de cuenta (`cuenta_en_buzon` en la base). */
export const TIPOS_DE_CUENTA = {
  negocio: "Negocio",
  guia: "Administración",
  ventas: "Asesor de la Guía",
  persona: "Visitante",
} as const;

export type TipoDeCuenta = keyof typeof TIPOS_DE_CUENTA;

export function tipoDeCuenta(tipo: string): string {
  return TIPOS_DE_CUENTA[tipo as TipoDeCuenta] ?? "";
}
