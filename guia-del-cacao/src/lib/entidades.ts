/**
 * Las 32 entidades de México, escritas como las escribe el INEGI.
 *
 * Vive aquí y no en una tabla de catálogo porque la lista no cambia nunca y el
 * directorio filtra por esta columna en cada carga: una consulta más por
 * pantalla, para siempre, por una lista que lleva un siglo igual.
 *
 * El mismo texto está en el check de `sucursales.entidad` (migración 000035).
 * Si se toca una lista hay que tocar la otra, o la base rechazará lo que el
 * formulario ofrece.
 */
export const ENTIDADES = [
  "Aguascalientes",
  "Baja California",
  "Baja California Sur",
  "Campeche",
  "Chiapas",
  "Chihuahua",
  "Ciudad de México",
  "Coahuila",
  "Colima",
  "Durango",
  "Estado de México",
  "Guanajuato",
  "Guerrero",
  "Hidalgo",
  "Jalisco",
  "Michoacán",
  "Morelos",
  "Nayarit",
  "Nuevo León",
  "Oaxaca",
  "Puebla",
  "Querétaro",
  "Quintana Roo",
  "San Luis Potosí",
  "Sinaloa",
  "Sonora",
  "Tabasco",
  "Tamaulipas",
  "Tlaxcala",
  "Veracruz",
  "Yucatán",
  "Zacatecas",
] as const;

export type Entidad = (typeof ENTIDADES)[number];

export function esEntidad(valor: unknown): valor is Entidad {
  return typeof valor === "string" && (ENTIDADES as readonly string[]).includes(valor);
}
