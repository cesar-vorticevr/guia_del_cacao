import { LIMITES } from "@/lib/limites";

/**
 * Las columnas del formato de catálogo, en un solo sitio.
 *
 * Las usan las dos mitades de la carga masiva: la que **escribe** el archivo
 * que el negocio se baja y la que **lee** el que devuelve lleno. Escritas dos
 * veces, el día que se agregue una columna se agregaría en una sola y el
 * formato dejaría de poder leerse a sí mismo, sin que nada avisara hasta que
 * alguien subiera un archivo.
 *
 * El orden es el de la hoja, y también el orden en que se pide un producto en
 * el formulario de uno en uno: quien ya cargó productos a mano encuentra las
 * mismas cuatro cosas y en el mismo orden.
 */
export type ColumnaDelFormato = {
  /** El campo de `productos_servicios` al que va a parar. */
  clave: "nombre" | "sku" | "descripcion" | "precio";
  /** Lo que se lee en la primera fila de la hoja. */
  encabezado: string;
  /** Ancho en caracteres, para que Excel no lo abra todo en columnas iguales. */
  ancho: number;
  obligatorio: boolean;
  /** Lo que se explica en la hoja de instrucciones. */
  ayuda: string;
  /** Un valor de muestra, para la tabla de ejemplo. */
  ejemplo: string;
};

export const COLUMNAS: readonly ColumnaDelFormato[] = [
  {
    clave: "nombre",
    encabezado: "Nombre",
    ancho: 36,
    obligatorio: true,
    ayuda: "Cómo se llama el producto. Es lo único obligatorio.",
    ejemplo: "Barra 70% cacao",
  },
  {
    clave: "sku",
    encabezado: "SKU",
    ancho: 16,
    obligatorio: false,
    ayuda:
      "Tu clave interna, si manejas alguna. No se publica: sirve para que lo reconozcas en tu inventario.",
    ejemplo: "BAR-70",
  },
  {
    clave: "descripcion",
    encabezado: "Descripción",
    ancho: 50,
    obligatorio: false,
    ayuda: `Dos renglones que digan qué es. Máximo ${LIMITES.descripcionProducto} caracteres.`,
    ejemplo: "Origen Comalcalco, tostado medio",
  },
  {
    clave: "precio",
    encabezado: "Precio",
    ancho: 12,
    obligatorio: false,
    ayuda:
      "Solo el número, sin el signo de pesos y sin comas: 90 o 90.50. Déjalo vacío si el precio es a consultar.",
    ejemplo: "90",
  },
];

/** Cuántos productos admite un archivo de una sentada. */
export const TOPE_DE_FILAS = 500;

/**
 * Un encabezado reducido a lo comparable: sin acentos, sin espacios y en
 * minúsculas.
 *
 * Las columnas se buscan por su nombre y no por su posición, así que quien
 * reordene las columnas o escriba "descripcion" sin acento sigue teniendo un
 * archivo que se puede leer. Lo contrario —leer por posición— convierte
 * arrastrar una columna en un catálogo con los precios en el nombre.
 */
export function normalizar(texto: string) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, "");
}
