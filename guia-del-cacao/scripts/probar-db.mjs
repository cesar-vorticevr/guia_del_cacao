/**
 * Corre las pruebas SQL de supabase/tests contra el Postgres local.
 *
 * Las pruebas usan identificadores fijos, así que necesitan una base recién
 * creada. No la reinicia por su cuenta a propósito: borrar la base local es
 * decisión de quien la usa, no de un script.
 *
 *   npm run db:reset && npm run db:test
 */
import { execFileSync, spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";

const CONTENEDOR = "supabase_db_guia-del-cacao";
const CARPETA = path.join("supabase", "tests");

const archivos = readdirSync(CARPETA)
  .filter((nombre) => nombre.endsWith(".sql"))
  .sort();

let hayFallas = false;

for (const archivo of archivos) {
  console.log(`\n── ${archivo} ${"─".repeat(Math.max(0, 60 - archivo.length))}`);

  execFileSync("docker", [
    "cp",
    path.join(CARPETA, archivo),
    `${CONTENEDOR}:/tmp/${archivo}`,
  ]);

  // psql manda los NOTICE por stderr, y ahí es donde viaja el resultado de casi
  // todas las aserciones. Hay que leer las dos salidas o el resumen mentiría.
  const corrida = spawnSync(
    "docker",
    ["exec", CONTENEDOR, "psql", "-U", "postgres", "-d", "postgres", "-q", "-f", `/tmp/${archivo}`],
    { encoding: "utf8" },
  );

  const salida = `${corrida.stdout ?? ""}\n${corrida.stderr ?? ""}`;

  for (const linea of salida.split("\n")) {
    if (/\bOK\b|\bFALLA\b|ERROR:/.test(linea)) {
      console.log(linea.replace(/^psql:[^ ]+ /, "").replace(/^NOTICE: */, ""));
    }
  }

  if (/\bFALLA\b|ERROR:/.test(salida)) hayFallas = true;
}

console.log(hayFallas ? "\nHay pruebas en falla." : "\nTodas las pruebas pasaron.");
process.exit(hayFallas ? 1 : 0);
