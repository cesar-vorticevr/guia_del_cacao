// Pinta las portadas 4:3 (1200×900) de la agenda del Festival del Chocolate y
// las deja donde las lee guia-del-cacao/scripts/agenda-del-festival.mjs.
//
//   node presentaciones/portadas-eventos/construir.mjs
//
// Playwright se toma del póster (presentaciones/poster-festival/node_modules),
// con el Edge instalado: no descarga navegadores.
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(aqui, "../..");
const { chromium } = createRequire(join(raiz, "presentaciones/poster-festival/package.json"))("playwright-core");
const salida = join(raiz, "guia-del-cacao/scripts/portadas-festival");
mkdirSync(salida, { recursive: true });

const ORO = "#ffb703";
const GUAYABA = "#ff5d73";
const LIMA = "#a8d94a";
const TURQUESA = "#12b8ac";

const PORTADAS = [
  { archivo: "prefestival-comalcalco", etiqueta: "Prefestival", dia: "6–8", resto: "Noviembre<br>Comalcalco", titulo: "Prefestival del <em>Chocolate</em>", lugar: "Unidad Deportiva «Joel Peralta», Comalcalco", acento: LIMA },
  { archivo: "curso-iicct", etiqueta: "Curso y cata", dia: "11", resto: "Miércoles<br>Noviembre · 10:00", titulo: "Chocolate Fino: <em>certificado IICCT</em> Nivel 1", lugar: "Universidad IEU, Villahermosa", acento: TURQUESA },
  { archivo: "festival-2026", etiqueta: "15 años de encuentros", dia: "12–16", resto: "Noviembre<br>Entrada libre", titulo: "Festival del <em>Chocolate</em> 2026", lugar: "Parque Tabasco «Dora María», Villahermosa", acento: ORO },
  { archivo: "inauguracion", etiqueta: "Ceremonia", dia: "12", resto: "Jueves<br>Noviembre · 17:00", titulo: "Inauguración y placa del <em>Cacao de la Chontalpa</em>", lugar: "Área Sabor a Tabasco, Parque Tabasco", acento: ORO },
  { archivo: "cavacao-12", etiqueta: "Música y maridaje", dia: "12", resto: "Jueves<br>Noviembre · 16:00", titulo: "Cavacao: <em>música en vivo</em>", lugar: "Área Cavacao, Parque Tabasco", acento: GUAYABA },
  { archivo: "cavacao-13", etiqueta: "Música y maridaje", dia: "13", resto: "Viernes<br>Noviembre · 16:00", titulo: "Cavacao: <em>música en vivo</em>", lugar: "Área Cavacao, Parque Tabasco", acento: GUAYABA },
  { archivo: "tiempo-en-contra", etiqueta: "Maridaje", dia: "13", resto: "Viernes<br>Noviembre", titulo: "Tiempo en Contra: <em>noche romántica</em>", lugar: "Foro Agua para Chocolate, Parque Tabasco", acento: GUAYABA },
  { archivo: "cavacao-14", etiqueta: "Música y maridaje", dia: "14", resto: "Sábado<br>Noviembre · 16:00", titulo: "Cavacao: <em>música en vivo</em>", lugar: "Área Cavacao, Parque Tabasco", acento: GUAYABA },
  { archivo: "cena-carlos-macias", etiqueta: "Cena maridaje", dia: "14", resto: "Sábado<br>Noviembre", titulo: "Cena maridaje con <em>Carlos Macías</em>", lugar: "Parque Tabasco, Villahermosa", acento: ORO },
  { archivo: "desfile-enrique-marin", etiqueta: "Moda", dia: "14", resto: "Sábado<br>Noviembre", titulo: "Desfile de modas de <em>Enrique Marín</em>", lugar: "Festival del Chocolate, Villahermosa", acento: GUAYABA },
  { archivo: "rock-and-run", etiqueta: "Carrera", dia: "15", resto: "Domingo<br>Noviembre · 6:30", titulo: "Rock and Run: <em>3.5 y 7 km</em>", lugar: "Festival del Chocolate, Villahermosa", acento: TURQUESA },
  { archivo: "cavacao-15", etiqueta: "Música y maridaje", dia: "15", resto: "Domingo<br>Noviembre · 16:00", titulo: "Cavacao: <em>música en vivo</em>", lugar: "Área Cavacao, Parque Tabasco", acento: GUAYABA },
  { archivo: "aleks-syntek", etiqueta: "Concierto gratuito", dia: "15", resto: "Domingo<br>Noviembre · 21:00", titulo: "Aleks Syntek <em>en concierto</em>", lugar: "Teatro al Aire Libre, Parque Tabasco", acento: GUAYABA },
  { archivo: "cavacao-16", etiqueta: "Música y maridaje", dia: "16", resto: "Lunes<br>Noviembre · 16:00", titulo: "Cavacao: <em>el cierre</em>", lugar: "Área Cavacao, Parque Tabasco", acento: GUAYABA },
  { archivo: "plan-mensual", etiqueta: "Membresía", dia: "$299", resto: "Al mes<br>Cancela cuando quieras", titulo: "Tu marca en la <em>Guía del Cacao</em>", lugar: "Catálogo, eventos y ruleta de premios con QR", acento: GUAYABA },
  { archivo: "prueba-gratis", etiqueta: "Prueba gratis", dia: "30", resto: "Días<br>Sin costo", titulo: "Conoce la <em>Guía del Cacao</em>", lugar: "Todas las herramientas, sin tarjeta", acento: LIMA },
  { archivo: "stand-guia", etiqueta: "Promoción Festival", dia: "$1,499", resto: "Tu primer año<br>12 al 16 nov", titulo: "Registra tu marca en la <em>Guía del Cacao</em>", lugar: "Stand de la Guía, Festival del Chocolate", acento: ORO },
];

const navegador = await chromium.launch({ channel: "msedge" });
const pagina = await navegador.newPage({ viewport: { width: 1200, height: 900 } });
for (const p of PORTADAS) {
  const { archivo, ...datos } = p;
  await pagina.goto(`${pathToFileURL(join(aqui, "portada.html")).href}?datos=${encodeURIComponent(JSON.stringify(datos))}`, { waitUntil: "networkidle" });
  await pagina.evaluate(() => document.fonts.ready);
  // Nada se sale de la portada: el título más largo tiene que caber.
  const sobra = await pagina.evaluate(() => {
    const h1 = document.querySelector("h1").getBoundingClientRect();
    const lugar = document.querySelector(".lugar").getBoundingClientRect();
    const fecha = document.querySelector(".fecha").getBoundingClientRect();
    const arriba = document.querySelector(".arriba").getBoundingClientRect();
    return lugar.bottom > 900 - 40 || fecha.top < arriba.bottom + 20 || h1.right > 1200 - 60;
  });
  if (sobra) console.warn(`  ojo: ${archivo} no cabe bien`);
  await pagina.screenshot({ path: join(salida, `${archivo}.png`), clip: { x: 0, y: 0, width: 1200, height: 900 } });
  console.log(`  ${archivo}.png`);
}
await navegador.close();
console.log(`${PORTADAS.length} portadas en ${salida}`);
