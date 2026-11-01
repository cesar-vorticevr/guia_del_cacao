// Arma los dos documentos: incrusta el CSS común y las imágenes (reducidas, en
// data URI) y genera el PDF de cada uno con Edge sin ventana.
//
//   node presentaciones/dossier/construir.mjs
//
// sharp se toma de la app (guia-del-cacao/node_modules), no se instala aparte.
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(aqui, "../..");
const app = join(raiz, "guia-del-cacao");
const sharp = createRequire(join(app, "package.json"))("sharp");

const IMAGENES = {
  logo: [join(app, "public/marca/logotipo.png"), 640],
  mazorca: [join(app, "public/marca/mazorca.png"), 160],
  vortice: [join(app, "public/marca/vortice-vr.png"), 420],
  "vortice-blanco": [join(app, "public/marca/vortice-vr-blanco.png"), 420],
  rama3: [join(app, "public/parallax/rama-tres-mazorcas.png"), 520],
  rama1: [join(app, "public/parallax/rama-una-mazorca.png"), 460],
  ramahojas: [join(app, "public/parallax/rama-de-hojas.png"), 620],
  hoja: [join(app, "public/parallax/hoja.png"), 300],
  "mazorca-rosa": [join(app, "public/parallax/mazorca-rosa.png"), 320],
  "mazorca-amarilla": [join(app, "public/parallax/mazorca-amarilla.png"), 320],
  flores: [join(app, "public/parallax/flores-de-cacao.png"), 300],
  granos: [join(app, "public/parallax/granos-de-cacao.png"), 260],
  "cap-portada": [join(aqui, "capturas/m-portada.png"), 600, "jpg"],
  "cap-directorio": [join(aqui, "capturas/m-directorio.png"), 600, "jpg"],
  "cap-micrositio": [join(aqui, "capturas/m-micrositio.png"), 600, "jpg"],
  "cap-escritorio": [join(aqui, "capturas/d-portada.png"), 1400, "jpg"],
};

const datos = {};
for (const [clave, [ruta, ancho, tipo]] of Object.entries(IMAGENES)) {
  let img = sharp(ruta).resize({ width: ancho, withoutEnlargement: true });
  img = tipo === "jpg" ? img.jpeg({ quality: 82 }) : img.png({ compressionLevel: 9, palette: true, quality: 90 });
  const buf = await img.toBuffer();
  datos[clave] = `data:image/${tipo === "jpg" ? "jpeg" : "png"};base64,${buf.toString("base64")}`;
}

const css = readFileSync(join(aqui, "comun.css"), "utf8");

// Solo corre con ?pdf: encoge el contenido de la hoja que no quepa en su carta.
const AJUSTAR_A_CARTA = `<script>
if (location.search.includes("pdf")) {
  document.documentElement.classList.add("pdf");
  const ajustar = () => document.querySelectorAll(".hoja").forEach((hoja) => {
    const col = hoja.querySelector(".col");
    const cs = getComputedStyle(hoja);
    const libre = hoja.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    col.style.zoom = "";
    if (col.scrollHeight > libre) col.style.zoom = (libre / col.scrollHeight).toFixed(3);
  });
  document.fonts.ready.then(ajustar);
  addEventListener("load", ajustar);
}
</script>`;
const salida = join(aqui, "dist");
mkdirSync(salida, { recursive: true });

// Chrome primero: Edge suele estar abierto y le pasa el encargo a esa ventana.
const EDGE = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
].find(existsSync);

// Con su propio perfil: si Edge ya está abierto en la máquina, sin esto le pasa
// el encargo a esa ventana y sale sin escribir nada. Aun así, a veces falla una
// vez; por eso se reintenta.
const PERFIL = join(aqui, "dist", ".perfil-edge");

function edge(args, salida) {
  for (let intento = 0; intento < 3; intento++) {
    try {
      execFileSync(EDGE, [`--user-data-dir=${PERFIL}`, ...args], { stdio: "ignore", timeout: 120_000 });
    } catch {
      // Se juzga por el archivo, no por el código de salida.
    }
    if (existsSync(salida)) return;
  }
  throw new Error(`Edge no generó ${salida}`);
}

// Las invitaciones llevan los datos de quien vende. Sin argumentos salen las
// de César con el código en blanco, para llenarlo a mano; con un código salen
// solo las dos invitaciones, con el código en el nombre del archivo:
//
//   node presentaciones/dossier/construir.mjs --asesor "Jorge Ruiz" --telefono "99 …" --codigo JORGE-W5TY
//   (--corto "Jorge Ruiz" para el nombre de la tarjeta, si el completo es largo)
const argumento = (nombre) => {
  const i = process.argv.indexOf(`--${nombre}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const ASESOR = {
  asesor: argumento("asesor") ?? "Mtro. César Adrián García Martínez",
  // En la tarjeta de WhatsApp cabe poco: nombre y primer apellido.
  corto: argumento("corto") ?? argumento("asesor")?.split(" ").slice(0, 2).join(" ") ?? "César García",
  telefono: argumento("telefono") ?? "99 83 44 82 07",
  codigo: argumento("codigo") ?? "__________",
  // Igual que `DESCUENTO_DE_EMBAJADOR` en guia-del-cacao/src/lib/precios.ts.
  descuento: "15",
};
const PERSONAL = argumento("codigo") !== undefined;
const conCodigo = (archivo) =>
  PERSONAL ? archivo.replace(/(\.\w+)$/, `-${ASESOR.codigo}$1`) : archivo;

const DOCS = [
  ["dossier-proyecto", "Guia-del-Cacao-Dossier-del-Proyecto.pdf"],
  ["identidad-de-marca", "Guia-del-Cacao-Identidad-de-Marca.pdf"],
  ["invitacion-negocios", conCodigo("Guia-del-Cacao-Invitacion-Negocios.pdf")],
  // La tarjeta no es PDF: sale como imagen de 1080 × 1350 para WhatsApp.
  ["tarjeta-invitacion", conCodigo("Guia-del-Cacao-Invitacion.png")],
].filter(([nombre]) => !PERSONAL || nombre.includes("invitacion"));

for (const [nombre, pdf] of DOCS) {
  const html = readFileSync(join(aqui, `${nombre}.html`), "utf8")
    .replace("{{css}}", css)
    .replace(/\{\{(asesor|corto|telefono|codigo|descuento)\}\}/g, (_, k) => ASESOR[k])
    .concat("\n", AJUSTAR_A_CARTA)
    .replace(/\{\{img:([\w-]+)\}\}/g, (_, k) => {
      if (!datos[k]) throw new Error(`Falta la imagen «${k}» en ${nombre}`);
      return datos[k];
    });
  const destino = join(salida, `${nombre}.html`);
  // El PDF necesita un documento completo; la página web se publica sin el
  // esqueleto, que lo pone quien la sirve.
  writeFileSync(join(salida, `${nombre}.web.html`), html);
  writeFileSync(destino, `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n${html}</html>`);
  console.log(`${nombre}.html  ${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MB`);

  if (EDGE && pdf.endsWith(".png")) {
    if (existsSync(join(raiz, "presentaciones", pdf))) unlinkSync(join(raiz, "presentaciones", pdf));
    edge([
      "--headless=new", "--disable-gpu", "--hide-scrollbars",
      "--virtual-time-budget=15000", "--force-device-scale-factor=2",
      "--window-size=540,675",
      `--screenshot=${join(raiz, "presentaciones", pdf)}`, `file:///${destino.replace(/\\/g, "/")}`,
    ], join(raiz, "presentaciones", pdf));
    console.log(`  → ${pdf}`);
  } else if (EDGE) {
    const pdfRuta = join(raiz, "presentaciones", pdf);
    if (existsSync(pdfRuta)) unlinkSync(pdfRuta);
    edge([
      "--headless=new", "--disable-gpu", "--no-pdf-header-footer",
      "--virtual-time-budget=15000", "--run-all-compositor-stages-before-draw",
      `--print-to-pdf=${pdfRuta}`, `file:///${destino.replace(/\\/g, "/")}?pdf`,
    ], pdfRuta);
    const paginas = (readFileSync(pdfRuta, "latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
    console.log(`  → ${pdf}  ${paginas} páginas`);
  }
}
