/**
 * Genera y sube las imágenes de los micrositios de demostración.
 *
 * Las dibuja aquí mismo, pixel a pixel, en vez de traerlas de internet: así el
 * proyecto no depende de que un servicio de fotos de relleno siga vivo, y
 * `db reset` se puede repetir sin conexión. Son manchas de color de la paleta
 * de la marca —no pretenden ser fotos—, suficientes para ver cómo se acomoda
 * la interfaz cuando todo tiene imagen.
 *
 *   node scripts/imagenes-de-demo.mjs
 *
 * Es idempotente: vuelve a subir sobre las mismas rutas. Corre contra el
 * Supabase local, con la llave de servicio que imprime `supabase status`.
 */
import { deflateSync } from "node:zlib";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

// Los mismos ids que usa supabase/seed.sql para las sucursales de demostración.
const SUCURSALES = Array.from(
  { length: 10 },
  (_, i) => `5a000000-0000-4000-a000-${String(i + 1).padStart(12, "0")}`,
);

const PRODUCTOS_POR_SUCURSAL = 5;

const PALETA = [
  [16, 107, 70], // selva
  [168, 217, 74], // lima
  [255, 183, 3], // mango
  [255, 93, 115], // guayaba
  [18, 184, 172], // turquesa
  [74, 44, 29], // cacao
  [253, 238, 203], // crema-2
];

// ---------------------------------------------------------------------------
// PNG a mano
// ---------------------------------------------------------------------------

const TABLA_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = TABLA_CRC[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function trozo(tipo, datos) {
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length);

  const cuerpo = Buffer.concat([Buffer.from(tipo, "ascii"), datos]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(cuerpo));

  return Buffer.concat([largo, cuerpo, crc]);
}

/** `pixel(x, y)` devuelve [r, g, b]. */
function png(ancho, alto, pixel) {
  const cabecera = Buffer.alloc(13);
  cabecera.writeUInt32BE(ancho, 0);
  cabecera.writeUInt32BE(alto, 4);
  cabecera[8] = 8; // bits por canal
  cabecera[9] = 2; // color verdadero, sin alfa
  // Los tres siguientes van en cero: compresión, filtro e interlazado estándar.

  // Cada renglón lleva delante su byte de filtro; con 0 se guarda tal cual.
  const crudo = Buffer.alloc(alto * (1 + ancho * 3));
  let i = 0;

  for (let y = 0; y < alto; y++) {
    crudo[i++] = 0;
    for (let x = 0; x < ancho; x++) {
      const [r, g, b] = pixel(x, y);
      crudo[i++] = r;
      crudo[i++] = g;
      crudo[i++] = b;
    }
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    trozo("IHDR", cabecera),
    trozo("IDAT", deflateSync(crudo, { level: 9 })),
    trozo("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// Los dibujos
// ---------------------------------------------------------------------------

/** Un número estable a partir de un texto, para que cada imagen salga igual siempre. */
function semilla(texto) {
  let n = 0;
  for (const letra of texto) n = (n * 31 + letra.charCodeAt(0)) >>> 0;
  return n;
}

/** Un color de la paleta. El desplazamiento va sin signo: con >> el numero se
 *  vuelve negativo y el indice sale fuera del arreglo. */
function color(s, corrimiento) {
  return PALETA[(s >>> corrimiento) % PALETA.length];
}

function dibujo(clave, ancho, alto) {
  const s = semilla(clave);
  const fondo = color(s, 0);
  const frente = color(s, 3);
  const acento = color(s, 6);
  const forma = s % 3;

  return png(ancho, alto, (x, y) => {
    const cx = ancho / 2;
    const cy = alto / 2;

    if (forma === 0) {
      // Círculo, como una mazorca vista de frente.
      const d = Math.hypot(x - cx, y - cy);
      if (d < Math.min(ancho, alto) * 0.28) return acento;
      if (d < Math.min(ancho, alto) * 0.38) return frente;
      return fondo;
    }

    if (forma === 1) {
      // Franjas diagonales.
      const franja = Math.floor((x + y) / (ancho / 6)) % 3;
      return franja === 0 ? frente : franja === 1 ? fondo : acento;
    }

    // Cuadros.
    const cuadro = (Math.floor(x / (ancho / 4)) + Math.floor(y / (alto / 4))) % 2;
    return cuadro === 0 ? fondo : frente;
  });
}

// ---------------------------------------------------------------------------
// Subida
// ---------------------------------------------------------------------------

function llaves() {
  const salida = execFileSync("npx", ["supabase", "status", "-o", "json"], {
    encoding: "utf8",
    shell: process.platform === "win32",
  });

  const estado = JSON.parse(salida);
  return { url: estado.API_URL, llave: estado.SERVICE_ROLE_KEY };
}

const { url, llave } = llaves();
const supabase = createClient(url, llave, { auth: { persistSession: false } });

let subidas = 0;

for (const sucursal of SUCURSALES) {
  const archivos = [
    { ruta: `${sucursal}/logo.png`, ancho: 512, alto: 512 },
    { ruta: `${sucursal}/fondo.png`, ancho: 1200, alto: 450 },
    { ruta: `${sucursal}/galeria-1.png`, ancho: 900, alto: 600 },
    { ruta: `${sucursal}/galeria-2.png`, ancho: 900, alto: 600 },
    ...Array.from({ length: PRODUCTOS_POR_SUCURSAL }, (_, i) => ({
      ruta: `${sucursal}/producto-${i + 1}.png`,
      ancho: 600,
      alto: 600,
    })),
  ];

  for (const archivo of archivos) {
    const imagen = dibujo(archivo.ruta, archivo.ancho, archivo.alto);

    const { error } = await supabase.storage
      .from("micrositios")
      .upload(archivo.ruta, imagen, { contentType: "image/png", upsert: true });

    if (error) {
      console.error(`No se pudo subir ${archivo.ruta}: ${error.message}`);
      process.exit(1);
    }

    subidas++;
  }
}

console.log(`${subidas} imágenes subidas al bucket micrositios.`);
