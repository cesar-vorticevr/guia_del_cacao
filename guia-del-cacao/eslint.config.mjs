import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // El stack local de Supabase deja archivos temporales suyos aquí; no son
    // código de la app y traen su propio estilo.
    "supabase/**",
    // El visor y el motor 3D de la realidad aumentada vienen de vorticevr.mx
    // tal cual (migración 000066): se copian, no se reescriben.
    "public/ra/**",
    "src/lib/ra/*.js",
  ]),
]);

export default eslintConfig;
