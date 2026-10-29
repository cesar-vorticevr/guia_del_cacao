/**
 * Lo de las cuentas de ventas que se pinta en el navegador: las etapas de la
 * libreta y los textos del kit. Sin nada de servidor, para que un componente
 * de cliente lo pueda importar.
 */

export type EtapaDeProspecto = "por_contactar" | "contactado" | "demo" | "alta" | "pago" | "no_interesa";

/** Las etapas en orden, con cómo se dicen. Están también en el `check` de la tabla (000067). */
export const ETAPAS: { valor: EtapaDeProspecto; texto: string }[] = [
  { valor: "por_contactar", texto: "Por contactar" },
  { valor: "contactado", texto: "Contactado" },
  { valor: "demo", texto: "Le enseñé la demo" },
  { valor: "alta", texto: "Ya se dio de alta" },
  { valor: "pago", texto: "Ya pagó" },
  { valor: "no_interesa", texto: "No le interesa" },
];

export type Prospecto = {
  id: string;
  negocio: string;
  contacto: string | null;
  telefono: string | null;
  ciudad: string | null;
  etapa: EtapaDeProspecto;
  nota: string | null;
  siguienteEn: string | null;
  actualizadoEn: string;
};

