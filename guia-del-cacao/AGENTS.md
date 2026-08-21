<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Guía del Cacao — convenciones

La especificación funcional está en la raíz del repo:
`spec-tecnica-guia-del-cacao.md` (fuente de verdad) y
`estructura-guia-del-cacao.md` (contexto de producto).
`app-prototipo.html` es la referencia visual, no código a copiar.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript.
- Tailwind v4: los tokens de marca viven en `@theme` dentro de
  `src/app/globals.css`, no en un `tailwind.config.ts`.
- Supabase: Postgres + Auth (correo y Google) + Storage.
  El esquema es `supabase/migrations/`, la única fuente de verdad.

## Reglas que no se negocian

- **La autorización se decide en Postgres, con RLS.** El frontend nunca es la
  única barrera. Si una regla comercial importa, va en un trigger o política.
- **El rol se lee de `public.perfiles`, jamás de `user_metadata`**: el propio
  usuario puede editar su metadata, así que no sirve para autorizar.
- Las políticas que cruzan tablas usan funciones `security definer`
  (`posee_marca`, `posee_sucursal`, …). Consultarlas en línea provoca
  recursión infinita entre políticas.
- **RLS autoriza, no acota.** Una vista privada siempre filtra a mano por su
  dueño (`.eq("perfil_id", perfil.id)`). La política de lectura es tan ancha
  como su lector legítimo más amplio: `marcas` es visible para el directorio
  público, así que un panel que se apoye solo en RLS le enseña al negocio las
  marcas de los demás. Ya pasó una vez.
- El dominio se nombra **en español**, igual que el spec.

## Puertos locales

Este proyecto convive con otro Supabase local en la misma máquina, así que usa
un rango propio: API `54421`, base `54422`, Studio `54423`, correo `54424`.

## Pruebas de la base

Las reglas de negocio y RLS se prueban en SQL, contra Postgres real, en
`supabase/tests/`. Usan identificadores fijos, así que necesitan una base
recién creada:

```
npm run db:reset && npm run db:test
```

Al agregar una regla al esquema, agrega ahí su prueba — sobre todo las
negativas (lo que NO se debe poder hacer), que es donde han salido los errores.
Y cuidado al probar RLS: `SET LOCAL` solo surte efecto dentro de una
transacción, y como `postgres` es superusuario, una prueba mal armada pasa
saltándose las políticas sin comprobar nada.

## Google OAuth

El código ya está completo; falta encenderlo. En `supabase/config.toml`,
`[auth.external.google]` está en `enabled = false` hasta que existan
credenciales de Google Cloud. En producción hay que fijar además
`NEXT_PUBLIC_SITE_URL`: detrás de un proxy la cabecera host no es el dominio
real y la URL de retorno saldría mal.

## Antes de cerrar trabajo

```
npm run typecheck && npm run lint && npm run build
```
