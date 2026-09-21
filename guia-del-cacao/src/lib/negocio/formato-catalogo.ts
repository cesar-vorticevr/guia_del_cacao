import ExcelJS from "exceljs";
import { LIMITES, revisarLargo } from "@/lib/limites";
import {
  COLUMNAS,
  TOPE_DE_FILAS,
  normalizar,
  type ColumnaDelFormato,
} from "@/lib/negocio/columnas-catalogo";

/**
 * El formato de catálogo: cómo se escribe y cómo se vuelve a leer.
 *
 * Las dos mitades viven juntas y **sin tocar la base ni la sesión**. La acción
 * de servidor se queda con lo suyo —comprobar de quién es la marca, preguntar
 * qué productos ya existen, insertar— y aquí queda lo que se puede probar con
 * un archivo y nada más. Mezclado, la única forma de comprobar que un precio
 * con coma se lee bien era entrar al panel con una cuenta de negocio y subir
 * una hoja a mano.
 *
 * No lleva `"use server"`: no es un punto de entrada, es una librería que usan
 * la ruta que entrega el archivo y la acción que lo recibe.
 */

/* Los colores de `globals.css`, que aquí van en el ARGB que entiende Excel. */
const SELVA = "FF106B46";
const CREMA = "FFFFF7E8";
const CREMA_2 = "FFFDEECB";
const CACAO = "FF4A2C1D";

/**
 * El libro en blanco que el negocio se baja.
 *
 * Son **dos hojas**. En "Productos" solo van los encabezados, sin renglones de
 * ejemplo: un ejemplo que nadie borra se sube como un producto de verdad, y el
 * negocio acaba con una "Barra 70% cacao" que no vende. El ejemplo vive en la
 * segunda hoja, donde se lee pero no se importa.
 */
export async function construirFormato(): Promise<ArrayBuffer> {
  const libro = new ExcelJS.Workbook();
  libro.creator = "Guía del Cacao";
  libro.created = new Date();

  /* ── Hoja 1: la que se llena ──────────────────────────────────────── */

  const productos = libro.addWorksheet("Productos", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  productos.columns = COLUMNAS.map((columna) => ({
    header: columna.encabezado,
    key: columna.clave,
    width: columna.ancho,
  }));

  const encabezado = productos.getRow(1);
  encabezado.height = 24;
  encabezado.font = { bold: true, color: { argb: CREMA }, size: 12 };
  encabezado.alignment = { vertical: "middle" };
  encabezado.eachCell((celda) => {
    celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SELVA } };
  });

  /*
    El precio se marca como número en toda la columna, no solo donde ya hay
    algo. Sin esto Excel guarda "90" como texto en cuanto alguien lo pega desde
    otro sitio, y al leerlo vuelve una cadena que hay que adivinar si era un
    precio.
  */
  const cualPrecio = COLUMNAS.findIndex((c) => c.clave === "precio") + 1;
  productos.getColumn(cualPrecio).numFmt = "0.00";

  /* ── Hoja 2: cómo llenarlo ────────────────────────────────────────── */

  const guia = libro.addWorksheet("Cómo llenarlo");
  guia.columns = [{ width: 24 }, { width: 76 }];

  const titulo = guia.addRow(["Cómo llenar este formato"]);
  titulo.font = { bold: true, size: 14, color: { argb: SELVA } };
  guia.addRow([]);

  for (const linea of [
    "Escribe un producto por renglón en la hoja «Productos», debajo de los encabezados.",
    "No cambies los nombres de los encabezados. Sí puedes moverlos de lugar o quitar los que no uses.",
    `Cabe un máximo de ${TOPE_DE_FILAS} productos por archivo.`,
    "Las fotos no van aquí. Se suben después, una por producto, desde el panel.",
    "Al subirlo, los productos se agregan a tu catálogo. Si un nombre ya existe, ese renglón se salta: no se duplica ni se sobrescribe.",
  ]) {
    const fila = guia.addRow(["", linea]);
    fila.getCell(2).alignment = { wrapText: true, vertical: "top" };
  }

  guia.addRow([]);

  const queVaEnCada = guia.addRow(["Qué va en cada columna"]);
  queVaEnCada.font = { bold: true, size: 12, color: { argb: SELVA } };
  guia.addRow([]);

  for (const columna of COLUMNAS) {
    const fila = guia.addRow([
      columna.encabezado + (columna.obligatorio ? " (obligatorio)" : ""),
      columna.ayuda,
    ]);
    fila.getCell(1).font = { bold: true, color: { argb: CACAO } };
    fila.getCell(2).alignment = { wrapText: true, vertical: "top" };
  }

  guia.addRow([]);

  const ejemploTitulo = guia.addRow(["Un ejemplo"]);
  ejemploTitulo.font = { bold: true, size: 12, color: { argb: SELVA } };

  const ejemploEncabezado = guia.addRow(COLUMNAS.map((c) => c.encabezado));
  ejemploEncabezado.font = { bold: true, color: { argb: CACAO } };
  ejemploEncabezado.eachCell((celda) => {
    celda.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: CREMA_2 },
    };
  });

  guia.addRow(COLUMNAS.map((c) => c.ejemplo));

  return libro.xlsx.writeBuffer() as Promise<ArrayBuffer>;
}

/* ─────────────────────────────────────────────────────────────────────── */

/** Un producto sacado de la hoja, listo para insertarse. */
export type ProductoDelFormato = {
  nombre: string;
  sku: string | null;
  descripcion: string | null;
  precio: number | null;
};

export type LecturaDelFormato = {
  /** Un motivo por el que no se puede leer el archivo entero. */
  error?: string;
  /** Qué renglón hay que corregir y por qué. */
  problemas: { fila: number; motivo: string }[];
  /** Los que entrarían al catálogo. */
  nuevos: ProductoDelFormato[];
  /** Los que ya estaban, por nombre. */
  repetidos: string[];
};

/** El valor de una celda como texto, venga como venga de Excel. */
function celdaComoTexto(celda: ExcelJS.Cell | undefined): string {
  const valor = celda?.value;
  if (valor === null || valor === undefined) return "";

  if (valor instanceof Date) return valor.toISOString();

  /*
    Una celda con fórmula trae el texto calculado en `result`; una con enlace,
    en `text`. Sin esto, un precio escrito como fórmula llega como
    "[object Object]" y el renglón se rechaza sin motivo entendible.
  */
  if (typeof valor === "object") {
    if ("result" in valor) return String(valor.result ?? "").trim();
    if ("text" in valor) return String(valor.text ?? "").trim();
    return "";
  }

  return String(valor).trim();
}

/**
 * Lee un archivo lleno y dice qué entraría y qué hay que corregir.
 *
 * **No escribe nada.** Devuelve las tres listas y quien la llama decide: la
 * acción del panel solo inserta cuando `problemas` viene vacío, porque importar
 * a medias deja al negocio sin saber por dónde iba —tendría que comparar su
 * hoja con su catálogo renglón por renglón para averiguar qué entró.
 *
 * **Las columnas se buscan por su encabezado**, no por su posición, así que
 * quien las reordene o quite las que no usa sigue teniendo un archivo válido.
 * Leerlas por posición convierte arrastrar una columna en un catálogo con los
 * precios en el nombre.
 *
 * `yaExisten` son los nombres normalizados que la marca ya tiene. Lo repetido
 * se salta, no se duplica ni se sobrescribe: es lo que hace que volver a subir
 * el mismo archivo —después de corregir tres renglones— no deje el catálogo por
 * duplicado. Sobrescribir era la otra opción y se descartó: nadie espera que
 * subir un archivo le cambie precios que ya tenía puestos a mano.
 */
export async function leerFormato(
  datos: ArrayBuffer,
  yaExisten: Set<string>,
): Promise<LecturaDelFormato> {
  const vacio = { problemas: [], nuevos: [], repetidos: [] };
  const libro = new ExcelJS.Workbook();

  try {
    await libro.xlsx.load(datos);
  } catch {
    return {
      ...vacio,
      error:
        "No se pudo abrir el archivo. Vuelve a bajar el formato y llénalo sobre ese.",
    };
  }

  /*
    La primera hoja, y no la que se llame "Productos": el formato solo trae una
    hoja para llenar, y buscarla por nombre rompería con quien la renombre o la
    copie a un libro suyo.
  */
  const hoja = libro.worksheets[0];
  if (!hoja) {
    return { ...vacio, error: "El archivo no tiene ninguna hoja con datos." };
  }

  /*
    Dónde quedó cada columna. Se lee la fila de encabezados y se compara
    normalizado, para aguantar acentos, mayúsculas y espacios de más.
  */
  const donde = new Map<ColumnaDelFormato["clave"], number>();

  hoja.getRow(1).eachCell((celda, columna) => {
    const escrito = normalizar(celdaComoTexto(celda));
    const cual = COLUMNAS.find((c) => normalizar(c.encabezado) === escrito);
    if (cual && !donde.has(cual.clave)) donde.set(cual.clave, columna);
  });

  if (!donde.has("nombre")) {
    return {
      ...vacio,
      error:
        "No encontré la columna «Nombre» en el primer renglón. Llena el formato que se descarga aquí: los encabezados tienen que ir arriba de todo.",
    };
  }

  const leer = (fila: ExcelJS.Row, clave: ColumnaDelFormato["clave"]) => {
    const columna = donde.get(clave);
    return columna ? celdaComoTexto(fila.getCell(columna)) : "";
  };

  const problemas: { fila: number; motivo: string }[] = [];
  const nuevos: ProductoDelFormato[] = [];
  const repetidos: string[] = [];

  // El mismo conjunto crece a medida que se lee, así que atrapa tanto lo que ya
  // estaba en el catálogo como lo repetido dentro del propio archivo.
  const vistos = new Set(yaExisten);

  let ultimaFila = 1;
  hoja.eachRow((_fila, numero) => {
    if (numero > ultimaFila) ultimaFila = numero;
  });

  for (let numero = 2; numero <= ultimaFila; numero += 1) {
    const fila = hoja.getRow(numero);

    const nombre = leer(fila, "nombre");
    const sku = leer(fila, "sku");
    const descripcion = leer(fila, "descripcion");
    const precioTexto = leer(fila, "precio");

    // Un renglón vacío no es un error: Excel arrastra filas en blanco al final
    // en cuanto alguien tocó una celda y la volvió a borrar.
    if (!nombre && !sku && !descripcion && !precioTexto) continue;

    if (!nombre) {
      problemas.push({ fila: numero, motivo: "Le falta el nombre." });
      continue;
    }

    if (nuevos.length >= TOPE_DE_FILAS) {
      problemas.push({
        fila: numero,
        motivo: `Pasa del tope de ${TOPE_DE_FILAS} productos por archivo. Pártelo en dos.`,
      });
      break;
    }

    const largo = revisarLargo(
      descripcion,
      LIMITES.descripcionProducto,
      "La descripción",
    );
    if (largo) {
      problemas.push({ fila: numero, motivo: largo });
      continue;
    }

    // La coma se cambia por punto antes de convertir: en Excel en español el
    // separador decimal es la coma, y "90,50" llegaría como NaN.
    const precio = precioTexto ? Number(precioTexto.replace(",", ".")) : null;

    /*
      Los dos motivos van separados. Juntos, a un «-5» se le contestaba «escribe
      solo el número, sin el signo de pesos», y el número ya estaba solo: quien
      lo leía se quedaba mirando la celda sin ver qué más quitarle.
    */
    if (precio !== null && Number.isNaN(precio)) {
      problemas.push({
        fila: numero,
        motivo: `«${precioTexto}» no es un precio. Escribe solo el número, sin el signo de pesos ni comas de millar.`,
      });
      continue;
    }

    if (precio !== null && precio < 0) {
      problemas.push({
        fila: numero,
        motivo: `El precio no puede ser negativo. Si es a consultar, deja la celda vacía.`,
      });
      continue;
    }

    const clave = normalizar(nombre);

    if (vistos.has(clave)) {
      repetidos.push(nombre);
      continue;
    }

    vistos.add(clave);
    nuevos.push({
      nombre,
      sku: sku || null,
      descripcion: descripcion || null,
      precio,
    });
  }

  return { problemas, nuevos, repetidos };
}
