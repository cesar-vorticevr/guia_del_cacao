/**
 * Crea la empresa de demostración: «Chocolatería Demo», con su cinta de DEMO,
 * plan Pro, catálogo, micrositio publicado y Ruleta Mágica, y dos cuentas para
 * enseñarla —la del negocio y la de un cliente que gira la ruleta—.
 *
 *   node scripts/crear-demo.mjs               (Supabase local)
 *   node scripts/crear-demo.mjs --produccion  (la base de .env.prod.local)
 *
 * Sigue las reglas de hoy, en el orden que piden los triggers: cuenta y
 * correo verificado, marca, catálogo, sucursal en borrador, productos de la
 * sucursal, suscripción Pro y, al final, publicarla. Es idempotente: si ya
 * existe, la deja como debe estar y conserva las contraseñas.
 *
 * Las contraseñas se inventan aquí y se guardan en `.env.cuentas-demo.local` o
 * `.env.cuentas-demo.produccion` —ignorados por git, como todo `.env*`—. No se
 * imprimen: un registro de la terminal no es lugar para una contraseña.
 */
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const PRODUCCION = process.argv.includes("--produccion");
const ARCHIVO_CUENTAS = PRODUCCION ? ".env.cuentas-demo.produccion" : ".env.cuentas-demo.local";

const NEGOCIO = { correo: "negocio.demo@guiadelcacao.com", nombre: "Negocio Demo" };
const CLIENTE = { correo: "cliente.demo@guiadelcacao.com", nombre: "Cliente Demo" };
const SLUG = "chocolateria-demo";

const PRODUCTOS = [
  { nombre: "Barra 70% cacao", descripcion: "Cacao de la Chontalpa, tostado en casa.", precio: 95, foto: "granos-de-cacao.png" },
  { nombre: "Chocolate de mesa", descripcion: "Para el chocolate caliente de la abuela.", precio: 120, foto: "mazorca-amarilla.png" },
  { nombre: "Trufas surtidas", descripcion: "Caja de 12, rellenas de frutas tropicales.", precio: 180, foto: "flores-de-cacao.png" },
  { nombre: "Taller de temperado", descripcion: "Dos horas, para principiantes.", precio: 450, foto: "mazorca-rosa.png" },
];

const PREMIOS = [
  { orden: 1, texto: "10% de descuento", probabilidad: 60 },
  { orden: 2, texto: "Chocolate caliente gratis", probabilidad: 30 },
  { orden: 3, texto: "Caja de trufas", probabilidad: 10 },
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

/** Una contraseña de 16 caracteres, sin los que se confunden al dictarla. */
function inventarContrasena() {
  const letras = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  return Array.from(randomBytes(16), (b) => letras[b % letras.length]).join("");
}

/**
 * SQL directo, para lo único que la llave de servicio no puede tocar: la
 * tabla `perfiles` no le da permisos a `service_role`, a propósito. En local
 * va por el contenedor de Postgres; en producción, por la API de
 * administración de Supabase con el token de `.env.prod.local`.
 */
async function sql(consulta) {
  if (PRODUCCION) {
    const token = leerEnv(".env.prod.local").SUPABASE_ACCESS_TOKEN;
    const proyecto = readFileSync("supabase/.temp/project-ref", "utf8").trim();
    const respuesta = await fetch(`https://api.supabase.com/v1/projects/${proyecto}/database/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: consulta }),
    });
    if (!respuesta.ok) throw new Error(`SQL: ${respuesta.status} ${await respuesta.text()}`);
    const filas = await respuesta.json();
    return filas.map((fila) => Object.values(fila)[0]);
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

const guardadas = leerEnv(ARCHIVO_CUENTAS);
const contrasenas = {
  negocio: guardadas.DEMO_NEGOCIO_CONTRASENA || inventarContrasena(),
  cliente: guardadas.DEMO_CLIENTE_CONTRASENA || inventarContrasena(),
};

/** La cuenta, creada o puesta al día, con su correo ya verificado. */
async function cuenta({ correo, nombre }, rol, contrasena) {
  // Se busca por SQL y no con `listUsers`: esa lista se cae entera si alguna
  // cuenta vieja tiene NULL donde GoTrue espera texto (lo cuenta AGENTS.md).
  const [id] = await sql(`select id from auth.users where lower(email) = '${correo}'`);
  let usuario = id ? { id } : null;

  if (usuario) {
    revisar(await db.auth.admin.updateUserById(usuario.id, { password: contrasena }), "contraseña");
  } else {
    usuario = revisar(
      await db.auth.admin.createUser({
        email: correo,
        password: contrasena,
        email_confirm: true,
        user_metadata: { nombre, rol },
      }),
      `crear ${correo}`,
    ).user;
  }

  // El id sale de la API de Auth, es un uuid: no hay nada que escapar.
  await sql(
    `update public.perfiles set rol = '${rol}', rol_confirmado = true, correo_verificado_en = coalesce(correo_verificado_en, now()) where id = '${usuario.id}'`,
  );
  return usuario.id;
}

async function subir(ruta, archivo) {
  const datos = readFileSync(path.join("public", archivo));
  revisar(
    await db.storage.from("micrositios").upload(ruta, datos, { contentType: "image/png", upsert: true }),
    `subir ${ruta}`,
  );
  return ruta;
}

const negocioId = await cuenta(NEGOCIO, "negocio", contrasenas.negocio);
await cuenta(CLIENTE, "cliente", contrasenas.cliente);

// La marca, con su cinta de DEMO.
const { data: categoria } = await db.from("categorias").select("id").eq("slug", "chocolateria").single();
let { data: marca } = await db.from("marcas").select("id").eq("perfil_id", negocioId).maybeSingle();
if (!marca) {
  marca = revisar(
    await db
      .from("marcas")
      .insert({ perfil_id: negocioId, nombre_comercial: "Chocolatería Demo", categoria_id: categoria.id, es_demo: true })
      .select("id")
      .single(),
    "marca",
  );
}
revisar(await db.from("marcas").update({ es_demo: true, nombre_comercial: "Chocolatería Demo" }).eq("id", marca.id), "demo");

// El catálogo, antes que la sucursal: sin catálogo no hay sucursal.
const { data: existentes } = await db.from("productos_servicios").select("id, nombre").eq("marca_id", marca.id);
const productos = [];
for (const [i, p] of PRODUCTOS.entries()) {
  let fila = existentes?.find((e) => e.nombre === p.nombre);
  const imagen = await subir(`catalogo/${marca.id}/demo-${i + 1}.png`, `parallax/${p.foto}`);
  if (!fila) {
    fila = revisar(
      await db
        .from("productos_servicios")
        .insert({ marca_id: marca.id, nombre: p.nombre, descripcion: p.descripcion, precio: p.precio, imagen })
        .select("id")
        .single(),
      `producto ${p.nombre}`,
    );
  }
  productos.push(fila.id);
}

// La sucursal, en borrador primero: publicar es lo último.
let { data: sucursal } = await db.from("sucursales").select("id, estado").eq("slug", SLUG).maybeSingle();
if (!sucursal) {
  sucursal = revisar(
    await db
      .from("sucursales")
      .insert({
        marca_id: marca.id,
        nombre_sucursal: "Sucursal de demostración",
        slug: SLUG,
        entidad: "Tabasco",
        ciudad: "Villahermosa",
        estado: "borrador",
        acerca_de:
          "Este es un negocio de demostración de la Guía del Cacao. Aquí ves cómo luce un micrositio con plan Pro: catálogo, contacto, reseñas y la Ruleta Mágica de premios.",
        whatsapp: "9931234567",
        correo_contacto: NEGOCIO.correo,
      })
      .select("id, estado")
      .single(),
    "sucursal",
  );
}

const logo = await subir(`${sucursal.id}/logo.png`, "marca/logotipo.png");
const fondo = await subir(`${sucursal.id}/fondo.png`, "parallax/rama-tres-mazorcas.png");
const galeria = [
  await subir(`${sucursal.id}/galeria-1.png`, "parallax/rama-una-mazorca.png"),
  await subir(`${sucursal.id}/galeria-2.png`, "parallax/flores-de-cacao.png"),
];
revisar(await db.from("sucursales").update({ logo, imagen_fondo: fondo, galeria }).eq("id", sucursal.id), "fotos");

revisar(
  await db
    .from("productos_sucursal")
    .upsert(productos.map((producto_id) => ({ producto_id, sucursal_id: sucursal.id })), { ignoreDuplicates: true }),
  "productos de la sucursal",
);

// Plan Pro, sin Stripe y sin vencimiento cercano: es de demostración.
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
      metodo_pago_stub: "demo",
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

// La Ruleta Mágica.
revisar(
  await db.from("ruletas").upsert({ sucursal_id: sucursal.id, activa: true, frecuencia: "diaria", vigencia_dias: 30 }),
  "ruleta",
);
await db.from("premios_ruleta").delete().eq("sucursal_id", sucursal.id);
revisar(
  await db.from("premios_ruleta").insert(PREMIOS.map((p) => ({ ...p, sucursal_id: sucursal.id }))),
  "premios",
);

writeFileSync(
  ARCHIVO_CUENTAS,
  [
    `# Cuentas de la empresa demo (${PRODUCCION ? "producción" : "local"}). No se sube a git.`,
    `DEMO_NEGOCIO_CORREO=${NEGOCIO.correo}`,
    `DEMO_NEGOCIO_CONTRASENA=${contrasenas.negocio}`,
    `DEMO_CLIENTE_CORREO=${CLIENTE.correo}`,
    `DEMO_CLIENTE_CONTRASENA=${contrasenas.cliente}`,
    `DEMO_MICROSITIO=/marca/${SLUG}`,
    "",
  ].join("\n"),
);

console.log(`Listo: Chocolatería Demo en /marca/${SLUG}. Las cuentas están en ${ARCHIVO_CUENTAS}.`);
