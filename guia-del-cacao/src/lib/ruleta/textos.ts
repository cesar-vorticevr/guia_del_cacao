/**
 * Lo que se dice de la ruleta en pantalla. Vive aparte de `lib/datos/ruleta`
 * porque esto lo importan componentes de cliente, y aquel archivo trae el
 * cliente de Supabase de servidor, que en el navegador no compila.
 */

export type Frecuencia = "una_vez" | "diaria" | "ilimitada";

export const TEXTO_DE_FRECUENCIA: Record<Frecuencia, string> = {
  una_vez: "Una vez por persona",
  diaria: "Una vez al día",
  ilimitada: "Sin límite",
};
