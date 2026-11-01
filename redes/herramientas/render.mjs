// Arma las piezas de redes de una semana: post 4:5, story 9:16 y video 9:16.
//
//   node render.mjs ../semana-01/piezas.json            todas
//   node render.mjs ../semana-01/piezas.json 01 03     solo esas
//   node render.mjs ../semana-01/piezas.json --sin-video
//
// Usa el Chrome instalado (puppeteer-core) y sirve la raíz del repo por http:
// desde file:// el lienzo queda "manchado" y no deja exportar ni grabar.

import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, "../..");
const CHROME = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
];
const TIPOS = { ".html": "text/html", ".js": "text/javascript", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp" };

const args = process.argv.slice(2);
const archivo = path.resolve(args[0]);
const sinVideo = args.includes("--sin-video");
const solo = args.slice(1).filter((a) => !a.startsWith("--"));
const semana = JSON.parse(await fs.readFile(archivo, "utf8"));
const carpeta = path.dirname(archivo);
const salida = path.join(carpeta, "listas");
await fs.mkdir(salida, { recursive: true });

const servidor = http.createServer(async (req, res) => {
  const ruta = path.join(RAIZ, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!ruta.startsWith(RAIZ)) return res.writeHead(403).end();
  try {
    const datos = await fs.readFile(ruta);
    res.writeHead(200, { "content-type": TIPOS[path.extname(ruta)] || "application/octet-stream" }).end(datos);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((ok) => servidor.listen(0, "127.0.0.1", ok));
const base = `http://127.0.0.1:${servidor.address().port}`;

let ejecutable;
for (const c of CHROME) if (await fs.access(c).then(() => true, () => false)) { ejecutable = c; break; }
const navegador = await puppeteer.launch({ executablePath: ejecutable, headless: true });

try {
  for (const pieza of semana.piezas) {
    if (solo.length && !solo.includes(pieza.id)) continue;
    const ilustracion = "/" + path.relative(RAIZ, path.join(carpeta, pieza.ilustracion)).replaceAll("\\", "/");
    for (const formato of ["feed", "story"]) {
      const pagina = await navegador.newPage();
      pagina.on("pageerror", (e) => console.error("  error en la página:", e.message));
      await pagina.goto(`${base}/redes/herramientas/motor.html`, { waitUntil: "networkidle0" });
      await pagina.evaluate((p, f) => prepararPieza(p, f), { ...pieza, ilustracion }, formato);

      const png = await pagina.evaluate((t) => cuadroPNG(t), pieza.cuadroFijo ?? 6);
      const nombre = `${pieza.id}-${pieza.nombre}-${formato === "feed" ? "post" : "story"}`;
      await fs.writeFile(path.join(salida, `${nombre}.png`), Buffer.from(png.split(",")[1], "base64"));
      console.log("✓", `${nombre}.png`);

      if (formato === "story" && !sinVideo) {
        const { base64, codec } = await pagina.evaluate((s) => grabarMP4(s, 30), pieza.segundos ?? 8);
        const video = `${pieza.id}-${pieza.nombre}-reel.mp4`;
        await fs.writeFile(path.join(salida, video), Buffer.from(base64, "base64"));
        console.log("✓", video, `(${codec})`);
      }
      await pagina.close();
    }
  }
} finally {
  await navegador.close();
  servidor.close();
}
