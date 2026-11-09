/**
 * Sube la agenda del Festival del Chocolate 2026 y su Prefestival como la
 * propia Guía del Cacao: una marca «Guía del Cacao» con su micrositio
 * («/marca/guia-del-cacao»), su catálogo (los planes del Festival) y los
 * eventos, que salen en /eventos y en la agenda del micrositio.
 *
 *   node scripts/agenda-del-festival.mjs               (Supabase local)
 *   node scripts/agenda-del-festival.mjs --produccion  (la base de .env.prod.local)
 *
 * Los datos salen de lo publicado al 9 de noviembre de 2026 por el sitio
 * oficial (festivaldelchocolate.tabasco.gob.mx) y la prensa de Tabasco. Lo que
 * no estaba confirmado se dice en el propio evento («horario por confirmar»)
 * en vez de inventarlo.
 *
 * Sigue el orden de `crear-demo.mjs`: cuenta, marca, catálogo, sucursal en
 * borrador, productos, plan y publicar. No es demo: no lleva cinta. Es
 * idempotente: un evento se reconoce por su título y se pone al día.
 */
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const PRODUCCION = process.argv.includes("--produccion");
const ARCHIVO_CUENTAS = PRODUCCION ? ".env.cuentas-agenda.produccion" : ".env.cuentas-agenda.local";

const CUENTA = { correo: "agenda@guiadelcacao.com", nombre: "Guía del Cacao" };
const SLUG = "guia-del-cacao";
const WHATSAPP = "9992230256";

const ACERCA = `Somos la Guía del Cacao, el directorio de productores, chocolateros y marcas de cacao de México. Aquí reunimos la agenda del Festival del Chocolate 2026 y su Prefestival para que no te pierdas nada.

El Festival cumple 15 ediciones con el lema «15 años de encuentros: Maridaje». Es del 12 al 16 de noviembre en el Parque Tabasco «Dora María», en Villahermosa, con entrada libre. Puebla es el estado invitado y Costa Rica el país invitado; también llegan Belice, Honduras y Guatemala por el Mundo Maya.

¿Tienes una marca de cacao o chocolate? Visítanos en nuestro stand: te registramos ahí mismo con acompañamiento paso a paso.`;

const PRODUCTOS = [
  {
    nombre: "Anualidad · Precio de festival",
    descripcion: "Tu marca en la Guía del Cacao un año completo. Solo hasta el 16 de noviembre de 2026; precio normal $2,990. Incluye registro en el stand con acompañamiento y tu QR con ruleta impreso ahí mismo.",
    precio: 1499,
    portada: "stand-guia",
  },
  {
    nombre: "Membresía mensual",
    descripcion: "Página propia con catálogo, eventos, ruleta de premios con QR y visibilidad en todo México. Cancela cuando quieras.",
    precio: 299,
    portada: "plan-mensual",
  },
  {
    nombre: "Prueba gratis 30 días",
    descripcion: "Regístrate sin costo y usa todas las herramientas durante 30 días.",
    precio: 0,
    portada: "prueba-gratis",
  },
];

/*
  Las horas van en el centro de México (UTC−6). Cuando la fuente no dio hora,
  se pone la apertura del transporte al parque (11:00) y el texto lo dice.
*/
const FUENTE = "Fuente: sitio oficial del Festival del Chocolate y prensa de Tabasco, al 9 de noviembre de 2026.";

const EVENTOS = [
  {
    titulo: "Prefestival del Chocolate en Comalcalco",
    subtitulo: "Unidad Deportiva «Joel Peralta», Comalcalco · 6 al 8 de noviembre",
    fecha: "2026-11-06T10:00:00-06:00",
    portada: "prefestival-comalcalco",
    contenido: `La antesala del Festival se vivió en Comalcalco, tierra cacaotera de la Chontalpa: tres días con unos 250 expositores entre productores, chocolateros, artesanos y cocina regional.

Hubo concursos tradicionales —«El quebrador de cacao», «Del metate al chocolate», «El pozol de mis amores» y «Cacaoteros a la carrera»—, música en vivo con Joss Favela, La Treviñosa y Chico Che Chico, y la entrega de 10 mil plantas de cacao injertado a productores de la región.

${FUENTE}`,
  },
  {
    titulo: "Curso «Chocolate Fino»: certificado Nivel 1 del IICCT",
    subtitulo: "Universidad IEU, Fracc. Carrizal, Villahermosa · 10:00 a 17:30",
    fecha: "2026-11-11T10:00:00-06:00",
    portada: "curso-iicct",
    contenido: `Un día antes del Festival, la Dra. Maricel E. Presilla, cofundadora del Instituto Internacional de Catadores de Cacao y Chocolate (IICCT), imparte en español el primer nivel de su certificación.

Es una jornada intensiva: análisis sensorial, cata de más de 12 orígenes, variedades, cultivo, elaboración y ética del cacao. Termina con examen y certificado oficial. Costo: 350 USD; la inscripción se hace por correo desde el sitio oficial del Festival.

${FUENTE}`,
  },
  {
    titulo: "Festival del Chocolate 2026: 15 años de encuentros",
    subtitulo: "Parque Tabasco «Dora María», Villahermosa · 12 al 16 de noviembre · Entrada libre",
    fecha: "2026-11-12T11:00:00-06:00",
    portada: "festival-2026",
    contenido: `La 15ª edición del Festival del Chocolate tiene como eje el maridaje: el chocolate con distintas bebidas. Se anuncian más de 240 actividades y la entrada es libre.

Qué vas a encontrar: el Salón Chocolate (mesas de negocios, catas y conversatorios), Sabor a Tabasco, Plaza del Pueblo, Chocolateros y Chocolaterías de Tabasco, Arte y Chocolate, Promesas del Chocolate, la experiencia ORIGEN con «Haz tu chocolate» y los Cinco Reinos del Chocolate, artesanías y el Foro Agua para Chocolate.

Invitados: Puebla como estado invitado y Costa Rica como país invitado, más Belice, Honduras y Guatemala por el Mundo Maya. Entre los chefs anunciados están Lupita Vidal, José Ramón Castillo, Aquiles Chávez, Gaby Ruiz y Alex Collado.

Cómo llegar: hay transporte público al parque de 11:00 a 20:00 ($12 en ruta urbana y $10 desde los centros de transferencia de Plaza de Toros, Planetario y Parque Tomás Garrido). El horario de cada área está por confirmar.

${FUENTE}`,
  },
  {
    titulo: "Inauguración y placa de origen del Cacao de la Chontalpa",
    subtitulo: "Área Sabor a Tabasco, Parque Tabasco · 17:00",
    fecha: "2026-11-12T17:00:00-06:00",
    portada: "inauguracion",
    contenido: `El gobernador abre el Festival y entrega la placa de la Indicación Geográfica Protegida «Cacao de la Región Chontalpa de Tabasco», que el IMPI declaró en mayo de 2026.

La protección reconoce el origen del cacao de seis municipios: Cárdenas, Comalcalco, Cunduacán, Huimanguillo, Jalpa de Méndez y Paraíso.

${FUENTE}`,
  },
  {
    titulo: "Cavacao, jueves 12: música en vivo y maridajes",
    subtitulo: "Área Cavacao, Parque Tabasco · desde las 16:00",
    fecha: "2026-11-12T16:00:00-06:00",
    portada: "cavacao-12",
    contenido: `Cavacao abre a partir de las 13:00 con bebidas de autor, maridajes y productos artesanales. Programa del jueves:

16:00 Tony Jenn · 17:00 Lado B · 18:00 Ctrl + Play · 19:00 Paty Ferrer · 21:00 Luz D Luna.

${FUENTE}`,
  },
  {
    titulo: "Cavacao, viernes 13: música en vivo y maridajes",
    subtitulo: "Área Cavacao, Parque Tabasco · desde las 16:00",
    fecha: "2026-11-13T16:00:00-06:00",
    portada: "cavacao-13",
    contenido: `Programa del viernes en Cavacao:

16:00 Manchy XP · 17:00 Enigma · 18:00 Omar Díaz · 19:00 Ut'zey Cum · 21:00 Joana Leyva.

${FUENTE}`,
  },
  {
    titulo: "Tiempo en Contra: noche romántica con maridaje",
    subtitulo: "Foro Agua para Chocolate, Parque Tabasco · horario por confirmar",
    fecha: "2026-11-13T20:00:00-06:00",
    portada: "tiempo-en-contra",
    contenido: `Una noche de música con maridaje de vinos y quesos en el Foro Agua para Chocolate. La fecha la publicó la prensa local; la hora y el costo todavía no están confirmados.

${FUENTE}`,
  },
  {
    titulo: "Cavacao, sábado 14: música en vivo y maridajes",
    subtitulo: "Área Cavacao, Parque Tabasco · desde las 16:00",
    fecha: "2026-11-14T16:00:00-06:00",
    portada: "cavacao-14",
    contenido: `Programa del sábado en Cavacao:

16:00 Pablo Ramón · 17:00 Eddie Ramón · 18:00 Azzty · 19:00 Ut'zey Cum · 21:00 La Cartelera.

${FUENTE}`,
  },
  {
    titulo: "Cena maridaje con Carlos Macías",
    subtitulo: "Parque Tabasco · horario por confirmar",
    fecha: "2026-11-14T20:00:00-06:00",
    portada: "cena-carlos-macias",
    contenido: `Cena maridaje acompañada por la música de Carlos Macías, dentro del Festival. La hora, el lugar exacto dentro del parque y el costo todavía no están confirmados.

${FUENTE}`,
  },
  {
    titulo: "Desfile de modas de Enrique Marín",
    subtitulo: "Festival del Chocolate · horario por confirmar",
    fecha: "2026-11-14T18:00:00-06:00",
    portada: "desfile-enrique-marin",
    contenido: `El diseñador Enrique Marín presenta un desfile dentro del Festival. La hora y el lugar todavía no están confirmados.

${FUENTE}`,
  },
  {
    titulo: "Rock and Run: 3.5 y 7 km",
    subtitulo: "Festival del Chocolate · salida 6:30",
    fecha: "2026-11-15T06:30:00-06:00",
    portada: "rock-and-run",
    contenido: `Carrera atlética de 3.5 y 7 kilómetros con concierto de rock al final. La salida es a las 6:30 según la prensa local; el punto de salida y el costo de inscripción todavía no están confirmados.

${FUENTE}`,
  },
  {
    titulo: "Cavacao, domingo 15: música en vivo y maridajes",
    subtitulo: "Área Cavacao, Parque Tabasco · desde las 16:00",
    fecha: "2026-11-15T16:00:00-06:00",
    portada: "cavacao-15",
    contenido: `Programa del domingo en Cavacao:

16:00 La Choquita · 17:00 Carlos Andrade · 18:00 Karla Priego · 19:30 Ael V.

${FUENTE}`,
  },
  {
    titulo: "Aleks Syntek en concierto gratuito",
    subtitulo: "Teatro al Aire Libre, Parque Tabasco · 21:00 (puertas 18:00)",
    fecha: "2026-11-15T21:00:00-06:00",
    portada: "aleks-syntek",
    contenido: `Aleks Syntek celebra los 15 años del Festival con su «Total Syntek Tour», por sus 35 años de carrera. La entrada es gratuita y no hay venta de boletos; las puertas abren a las 18:00.

${FUENTE}`,
  },
  {
    titulo: "Cavacao, lunes 16: cierre con música en vivo",
    subtitulo: "Área Cavacao, Parque Tabasco · desde las 16:00",
    fecha: "2026-11-16T16:00:00-06:00",
    portada: "cavacao-16",
    contenido: `Programa del último día en Cavacao:

16:00 Deadman · 17:00 Cielo Roto · 19:00 Williams Córdova · 21:00 Aura.

${FUENTE}`,
  },
  {
    titulo: "Registra tu marca en el stand de la Guía del Cacao",
    subtitulo: "Festival del Chocolate, Parque Tabasco · 12 al 16 de noviembre",
    fecha: "2026-11-12T12:00:00-06:00",
    portada: "stand-guia",
    contenido: `¿Produces cacao o haces chocolate? Pasa a nuestro stand y sal con tu marca en la guía: página propia con catálogo, publicación de eventos y noticias, y tu ruleta de premios con QR para tu mesa.

Promoción Festival, solo hasta el 16 de noviembre: la anualidad a $1,499 (precio normal $2,990), con registro paso a paso en el stand y tu QR con ruleta impreso ahí mismo. También hay plan mensual de $299 y prueba gratis de 30 días.

Escríbenos por WhatsApp al 999 223 0256.`,
  },
];

// ---------------------------------------------------------------------------

function leerEnv(archivo) {
  if (!existsSync(archivo)) return {};
  return Object.fromEntries(
    readFileSync(archivo, "utf8")
      .split(/\r?\n/)
      .filter((linea) => /^[A-Z_]+=/.test(linea))
      .map((linea) => {
        const i = linea.indexOf("=");
        return [linea.slice(0, i), linea.slice(i + 1).replace(/^"|"$/g, "")];
      }),
  );
}

function llaves() {
  if (PRODUCCION) {
    const env = leerEnv(".env.prod.local");
    if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.prod.local");
    }
    return { url: env.NEXT_PUBLIC_SUPABASE_URL, llave: env.SUPABASE_SERVICE_ROLE_KEY };
  }
  const salida = execFileSync("npx", ["supabase", "status", "-o", "json"], {
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  const estado = JSON.parse(salida);
  return { url: estado.API_URL, llave: estado.SERVICE_ROLE_KEY };
}

function inventarContrasena() {
  const letras = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  return Array.from(randomBytes(16), (b) => letras[b % letras.length]).join("");
}

/**
 * SQL directo para `perfiles`, como en `crear-demo.mjs`. En producción va por
 * el CLI de Supabase (`db query --remote`), con su sesión, y no por el token
 * de `.env.prod.local`: ese token vence y el del CLI es el mismo con el que se
 * suben las migraciones.
 */
async function sql(consulta) {
  if (PRODUCCION) {
    // Por archivo: en Windows el CLI corre en un shell y las comillas de la
    // consulta no sobreviven como argumento.
    const archivo = path.join(tmpdir(), `agenda-${process.pid}.sql`);
    writeFileSync(archivo, consulta);
    const salida = execFileSync(
      "npx",
      ["supabase", "db", "query", "--remote", "--yes", "--output-format", "json", "--file", archivo],
      { encoding: "utf8", shell: process.platform === "win32", stdio: ["ignore", "pipe", "ignore"] },
    );
    const { rows } = JSON.parse(salida.slice(salida.indexOf("{")));
    return rows.map((fila) => Object.values(fila)[0]);
  }
  const salida = execFileSync(
    "docker",
    ["exec", "supabase_db_guia-del-cacao", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-tA", "-c", consulta],
    { encoding: "utf8" },
  );
  return salida.split(/\r?\n/).filter(Boolean);
}

function revisar(resultado, que) {
  if (resultado.error) throw new Error(`${que}: ${resultado.error.message}`);
  return resultado.data;
}

// ---------------------------------------------------------------------------

const { url, llave } = llaves();
const db = createClient(url, llave, { auth: { persistSession: false } });

const contrasena = leerEnv(ARCHIVO_CUENTAS).AGENDA_CONTRASENA || inventarContrasena();

const [existente] = await sql(`select id from auth.users where lower(email) = '${CUENTA.correo}'`);
let perfilId = existente;
if (perfilId) {
  revisar(await db.auth.admin.updateUserById(perfilId, { password: contrasena }), "contraseña");
} else {
  perfilId = revisar(
    await db.auth.admin.createUser({
      email: CUENTA.correo,
      password: contrasena,
      email_confirm: true,
      user_metadata: { nombre: CUENTA.nombre, rol: "negocio" },
    }),
    "crear la cuenta",
  ).user.id;
}
await sql(
  `update public.perfiles set rol = 'negocio', rol_confirmado = true, correo_verificado_en = coalesce(correo_verificado_en, now()) where id = '${perfilId}'`,
);

/**
 * Sube una imagen al bucket. `archivo` es relativo a la app: las portadas
 * propias de la agenda están en `scripts/portadas-festival/` (las pinta
 * `presentaciones/portadas-eventos/construir.mjs`) y no se usan las
 * ilustraciones del sitio, que se repetían en todas las tarjetas.
 */
async function subir(ruta, archivo) {
  const datos = readFileSync(archivo);
  revisar(
    await db.storage.from("micrositios").upload(ruta, datos, { contentType: "image/png", upsert: true }),
    `subir ${ruta}`,
  );
  return ruta;
}

// La marca
const { data: categoria } = await db.from("categorias").select("id").eq("slug", "otros-servicios").single();
let { data: marca } = await db.from("marcas").select("id").eq("perfil_id", perfilId).maybeSingle();
if (!marca) {
  marca = revisar(
    await db
      .from("marcas")
      .insert({ perfil_id: perfilId, nombre_comercial: "Guía del Cacao", categoria_id: categoria.id })
      .select("id")
      .single(),
    "marca",
  );
}

// El catálogo: los planes del Festival. «Plan mensual» se llamó así hasta que
// dejó de haber planes: se renombra para no dejar el viejo junto al nuevo.
revisar(
  await db.from("productos_servicios").update({ nombre: "Membresía mensual" }).eq("marca_id", marca.id).eq("nombre", "Plan mensual"),
  "renombrar el plan mensual",
);
const { data: hechos } = await db.from("productos_servicios").select("id, nombre").eq("marca_id", marca.id);
const productos = [];
for (const p of PRODUCTOS) {
  const imagen = await subir(`catalogo/${marca.id}/${p.portada}.png`, `scripts/portadas-festival/${p.portada}.png`);
  let fila = hechos?.find((h) => h.nombre === p.nombre);
  const datos = { nombre: p.nombre, descripcion: p.descripcion, precio: p.precio, imagen };
  if (fila) {
    revisar(await db.from("productos_servicios").update(datos).eq("id", fila.id), `producto ${p.nombre}`);
  } else {
    fila = revisar(
      await db.from("productos_servicios").insert({ marca_id: marca.id, ...datos }).select("id").single(),
      `producto ${p.nombre}`,
    );
  }
  productos.push(fila.id);
}

// La sucursal: el micrositio de la Guía
let { data: sucursal } = await db.from("sucursales").select("id").eq("slug", SLUG).maybeSingle();
const ficha = {
  nombre_sucursal: "Agenda del Festival del Chocolate",
  entidad: "Tabasco",
  ciudad: "Villahermosa",
  acerca_de: ACERCA,
  whatsapp: WHATSAPP,
  correo_contacto: CUENTA.correo,
};
if (!sucursal) {
  sucursal = revisar(
    await db
      .from("sucursales")
      .insert({ marca_id: marca.id, slug: SLUG, estado: "borrador", ...ficha })
      .select("id")
      .single(),
    "sucursal",
  );
} else {
  revisar(await db.from("sucursales").update(ficha).eq("id", sucursal.id), "sucursal");
}

const logo = await subir(`${sucursal.id}/logo.png`, "public/marca/logotipo.png");
const fondo = await subir(`${sucursal.id}/portada-festival.png`, "scripts/portadas-festival/festival-2026.png");
revisar(await db.from("sucursales").update({ logo, imagen_fondo: fondo }).eq("id", sucursal.id), "fotos");

revisar(
  await db
    .from("productos_sucursal")
    .upsert(productos.map((producto_id) => ({ producto_id, sucursal_id: sucursal.id })), { ignoreDuplicates: true }),
  "productos de la sucursal",
);

// Plan Pro sin Stripe: el micrositio es de la propia Guía.
const { data: abierta } = await db
  .from("suscripciones")
  .select("id")
  .eq("sucursal_id", sucursal.id)
  .in("estado", ["trial", "activo"])
  .maybeSingle();
if (!abierta) {
  const diezAnios = new Date();
  diezAnios.setFullYear(diezAnios.getFullYear() + 10);
  revisar(
    await db.from("suscripciones").insert({
      sucursal_id: sucursal.id,
      tier_id: 3,
      monto_mensual: 0,
      estado: "activo",
      fecha_proximo_cobro: diezAnios.toISOString(),
      metodo_pago_stub: "guia",
    }),
    "suscripción",
  );
}

revisar(
  await db
    .from("sucursales")
    .update({ estado: "publicado", tier_id: 3, fecha_publicacion: new Date().toISOString() })
    .eq("id", sucursal.id),
  "publicar",
);

// Los eventos
const { data: yaHay } = await db.from("eventos").select("id, titulo").eq("sucursal_id", sucursal.id);
for (const e of EVENTOS) {
  const imagen = await subir(`${sucursal.id}/eventos/${e.portada}.png`, `scripts/portadas-festival/${e.portada}.png`);
  const datos = {
    titulo: e.titulo,
    subtitulo: e.subtitulo,
    contenido: e.contenido,
    imagenes: [imagen],
    fecha_evento: new Date(e.fecha).toISOString(),
  };
  const fila = yaHay?.find((h) => h.titulo === e.titulo);
  if (fila) {
    revisar(await db.from("eventos").update(datos).eq("id", fila.id), `evento ${e.titulo}`);
  } else {
    revisar(await db.from("eventos").insert({ sucursal_id: sucursal.id, ...datos }), `evento ${e.titulo}`);
  }
}

writeFileSync(
  ARCHIVO_CUENTAS,
  [
    `# Cuenta de la agenda de la Guía (${PRODUCCION ? "producción" : "local"}). No se sube a git.`,
    `AGENDA_CORREO=${CUENTA.correo}`,
    `AGENDA_CONTRASENA=${contrasena}`,
    `AGENDA_MICROSITIO=/marca/${SLUG}`,
    "",
  ].join("\n"),
);

console.log(`Listo: ${EVENTOS.length} eventos en /marca/${SLUG}. La cuenta está en ${ARCHIVO_CUENTAS}.`);
