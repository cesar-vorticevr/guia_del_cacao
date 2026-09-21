/**
 * Le pone fotos a las publicaciones de la comunidad que no tienen ninguna.
 *
 * Las dibuja aquí mismo, pixel a pixel, por lo mismo que `imagenes-de-demo.mjs`:
 * así el proyecto no depende de que un servicio de fotos de relleno siga vivo, y
 * `db reset` se puede repetir sin conexión. Son manchas de color de la paleta
 * de la marca —no pretenden ser fotos—, suficientes para ver cómo se acomoda un
 * feed cuando todo tiene imagen.
 *
 *   node scripts/comunidad-de-demo.mjs > actualizar.sql
 *   docker exec -i supabase_db_guia-del-cacao psql -U postgres -d postgres < actualizar.sql
 *
 * Es idempotente: solo toca las publicaciones sin archivos, y sube sobre las
 * mismas rutas. Correrlo dos veces no duplica nada.
 *
 * **Sube los archivos pero no toca la base.** El rol de servicio no tiene
 * permisos sobre `publicaciones` —las migraciones se los dieron a `anon` y a
 * `authenticated`, que es la dirección segura— así que las rutas salen por la
 * salida estándar como SQL, para aplicarlas con psql. Los avisos van a la de
 * error para no ensuciar el SQL.
 *
 * **Lo que no hace es video.** Aquí no hay con qué codificarlo —ni ffmpeg ni
 * sharp— y escribir un MP4 a mano es otra clase de problema. Para probar el
 * reproductor hay que subir un video a mano desde el panel; todo lo demás del
 * feed se puede ver con esto.
 */
import { deflateSync } from "node:zlib";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const PALETA = [
  [16, 107, 70], // selva
  [168, 217, 74], // lima
  [255, 183, 3], // mango
  [255, 93, 115], // guayaba
  [18, 184, 172], // turquesa
  [74, 44, 29], // cacao
  [253, 238, 203], // crema-2
];

/*
  Cuántas fotos le toca a cada publicación, en rueda. Que unas lleven una y
  otras cinco es justo lo que hay que ver: el carrusel solo se nota cuando
  conviven publicaciones de una foto con publicaciones de varias.
*/
const CUANTAS = [1, 3, 1, 5, 2, 1, 4, 2, 10];

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

/** Un número estable a partir de un texto: la misma foto sale igual siempre. */
function semilla(texto) {
  let n = 0;
  for (const letra of texto) n = (n * 31 + letra.charCodeAt(0)) >>> 0;
  return n;
}

function color(s, corrimiento) {
  return PALETA[(s >>> corrimiento) % PALETA.length];
}

/**
 * Tres formas distintas, elegidas por la semilla.
 *
 * Tres y no una porque un muro entero del mismo dibujo no enseña nada: lo que
 * se quiere ver es cómo se sostiene la columna con imágenes distintas.
 */
function dibujo(clave, ancho, alto) {
  const s = semilla(clave);
  const fondo = color(s, 0);
  const figura = color(s, 5);
  const cual = (s >>> 11) % 3;

  return png(ancho, alto, (x, y) => {
    const u = x / ancho;
    const v = y / alto;

    // Franjas en diagonal.
    if (cual === 0) return ((u + v) * 6) % 1 < 0.5 ? fondo : figura;

    // Un círculo en medio.
    if (cual === 1) {
      const dx = u - 0.5;
      const dy = v - 0.5;
      return dx * dx + dy * dy < 0.055 ? figura : fondo;
    }

    // Cuadros.
    return (Math.floor(u * 5) + Math.floor(v * 5)) % 2 === 0 ? fondo : figura;
  });
}

// ---------------------------------------------------------------------------

/**
 * A dónde apuntar y con qué llave, sin tenerla escrita en el repo.
 *
 * Se mira primero el entorno para poder correrlo en una terminal donde la
 * llave ya está a mano, y solo si no está se le pregunta a `supabase status`,
 * que tarda unos segundos porque levanta la CLI entera.
 */
function dondeYConQue() {
  const delEntorno = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (delEntorno) {
    return {
      url: process.env.SUPABASE_URL ?? "http://127.0.0.1:54421",
      llave: delEntorno,
    };
  }

  const salida = execFileSync("npx", ["supabase", "status", "-o", "json"], {
    encoding: "utf8",
    shell: process.platform === "win32",
  });

  const estado = JSON.parse(salida);

  if (!estado.SERVICE_ROLE_KEY) {
    console.error(
      "`supabase status` no devolvió SERVICE_ROLE_KEY. Pásala en SUPABASE_SERVICE_ROLE_KEY.",
    );
    process.exit(1);
  }

  return { url: estado.API_URL, llave: estado.SERVICE_ROLE_KEY };
}

const { url, llave } = dondeYConQue();

const supabase = createClient(url, llave, {
  auth: { persistSession: false },
});

/**
 * Cuáles están sin foto, preguntándoselo a la base por psql.
 *
 * Por psql y no por la API porque el rol de servicio no tiene permisos sobre
 * `publicaciones`: las migraciones se los dieron a `anon` y a `authenticated`,
 * que es la dirección segura y no hay por qué aflojarla para un script de
 * demostración.
 */
function lasQueEstanVacias() {
  const consulta =
    "select coalesce(json_agg(json_build_object('id', id, 'autor_id', autor_id)), '[]') " +
    "from publicaciones where coalesce(array_length(imagenes, 1), 0) = 0";

  const salida = execFileSync(
    "docker",
    [
      "exec", "supabase_db_guia-del-cacao",
      "psql", "-U", "postgres", "-d", "postgres", "-t", "-A", "-c", consulta,
    ],
    { encoding: "utf8" },
  );

  return JSON.parse(salida.trim());
}

const vacias = lasQueEstanVacias();

if (vacias.length === 0) {
  console.error("Todas las publicaciones ya tienen archivos. No hay nada que hacer.");
  process.exit(0);
}

// Los avisos van a la salida de error: la estándar lleva el SQL.
console.error(`${vacias.length} publicaciones sin foto. Dibujando…`);

for (const [i, publicacion] of vacias.entries()) {
  const cuantas = CUANTAS[i % CUANTAS.length];
  const rutas = [];

  for (let n = 0; n < cuantas; n++) {
    const clave = `${publicacion.id}-${n}`;

    /*
      Medidas distintas a propósito: verticales, cuadradas y apaisadas. Es lo
      que destapa si el feed aguanta un cartel de 3:4 al lado de una foto
      apaisada sin descuadrarse, que fue justo el fallo del recorte a 16:9.
    */
    const forma = (semilla(clave) >>> 3) % 3;
    const [ancho, alto] =
      forma === 0 ? [900, 1200] : forma === 1 ? [1000, 1000] : [1200, 800];

    const ruta = `${publicacion.autor_id}/demo-${publicacion.id}-${n}.png`;

    const { error: falla } = await supabase.storage
      .from("comunidad")
      .upload(ruta, dibujo(clave, ancho, alto), {
        contentType: "image/png",
        upsert: true,
      });

    if (falla) {
      console.error(`  ${ruta}: ${falla.message}`);
      continue;
    }

    // Con el bucket delante, igual que las que sube la aplicación: es lo que
    // luego permite saber dónde buscarla sin adivinar por la forma de la ruta.
    rutas.push(`comunidad/${ruta}`);
  }

  if (rutas.length === 0) continue;

  // El SQL a la salida estándar, para canalizarlo a psql. Las rutas las pone
  // este script, así que no hay nada que escapar más allá de las comillas.
  const lista = rutas.map((r) => `'${r.replace(/'/g, "''")}'`).join(", ");

  console.log(
    `update publicaciones set imagenes = array[${lista}] where id = '${publicacion.id}';`,
  );

  console.error(
    `  ${publicacion.id}: ${rutas.length} ${rutas.length === 1 ? "foto" : "fotos"}`,
  );
}

console.error("Listo.");
