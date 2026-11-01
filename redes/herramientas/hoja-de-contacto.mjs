// Revisa una animación sin reproductor: pinta varios instantes del video
// vertical lado a lado en un PNG.   node hoja-de-contacto.mjs ../semana-01/piezas.json 07

import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, "../..");
const [archivo, id] = process.argv.slice(2).map((a, i) => (i === 0 ? path.resolve(a) : a));
const carpeta = path.dirname(archivo);
const pieza = JSON.parse(await fs.readFile(archivo, "utf8")).piezas.find((p) => p.id === id);
const INSTANTES = [0.3, 0.8, 1.3, 2.0, 3.0, 6.0];

const servidor = http.createServer(async (req, res) => {
  const ruta = path.join(RAIZ, decodeURIComponent(new URL(req.url, "http://x").pathname));
  let datos;
  try { datos = await fs.readFile(ruta); } catch { return res.writeHead(404).end(); }
  res.writeHead(200, { "content-type": ruta.endsWith(".html") ? "text/html" : ruta.endsWith(".js") ? "text/javascript" : "image/png" }).end(datos);
});
await new Promise((ok) => servidor.listen(0, "127.0.0.1", ok));
const navegador = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const pagina = await navegador.newPage();
await pagina.goto(`http://127.0.0.1:${servidor.address().port}/redes/herramientas/motor.html`, { waitUntil: "networkidle0" });
const ilustracion = "/" + path.relative(RAIZ, path.join(carpeta, pieza.ilustracion)).replaceAll("\\", "/");
await pagina.evaluate((p) => prepararPieza(p, "story"), { ...pieza, ilustracion });
const png = await pagina.evaluate(async (ts) => {
  const src = document.getElementById("lienzo");
  const hoja = document.createElement("canvas");
  hoja.width = 270 * ts.length; hoja.height = 480;
  const h = hoja.getContext("2d");
  ts.forEach((t, i) => { pintar(t); h.drawImage(src, i * 270, 0, 270, 480); });
  return hoja.toDataURL("image/png").split(",")[1];
}, INSTANTES);
await fs.writeFile(path.join(carpeta, "listas", `${id}-contacto.png`), Buffer.from(png, "base64"));
await navegador.close();
servidor.close();
console.log("✓", `${id}-contacto.png`, INSTANTES.join(" · "), "s");
