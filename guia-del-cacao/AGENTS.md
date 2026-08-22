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

## Cómo se llaman las cosas

La unidad del pasaporte se llama **monedas de chocolate** y los cuatro rangos
son **Curioso · Catador · Conocedor · Maestro cacaotero**. Todo eso vive en
`src/lib/vocabulario.ts`, no repartido por la interfaz.

Los cortes de la escalera (20, 50, 100) están dos veces: en
`public.calcular_rango` y en `RANGOS`. La base es la que manda; el vocabulario
solo los explica y dice cuánto falta para el siguiente. Si cambian, cambian en
los dos lados.

Los rangos van en masculino genérico a propósito, es una decisión tomada: no se
pregunta el género al registrarse y se prefirió eso antes que buscar nombres
neutros. No hace falta volver a plantearlo. En la base las columnas
siguen siendo `puntos_*`: ahí se guarda la unidad, en el vocabulario se le pone
nombre comercial. Si mañana se llaman mazorcas, se cambia un archivo y no hace
falta migración.

## Imágenes

Todo lo que se suba pasa por `src/lib/imagenes.ts`: tope de **5 MB**, formatos
JPG/PNG/WebP/AVIF y las medidas recomendadas de cada campo. Las medidas son
sugerencias —la plataforma recorta lo que le den—, pero se muestran para que
nadie tenga que adivinar por qué su logo salió cortado.

Dos límites tienen que coincidir o el resultado es un error sin explicación:
el del bucket (`file_size_limit` en la migración de storage) y el de Next.js
(`serverActions.bodySizeLimit` en `next.config.ts`, que por defecto es **1 MB**
y cortaba cualquier foto de celular con un 500 mudo).

## Primero la marca, luego la sucursal

En cualquier pantalla donde se nombre un negocio, el nombre grande es el de la
**marca** ("Chocolates Grijalva") y la **sucursal** va debajo y en chico
("Matriz Villahermosa"). La marca es lo que la gente reconoce; la sucursal es la
dirección. Sale de `nombrarNegocio()` en `lib/datos/publico.ts`, que además
oculta la sucursal cuando no hay marca, para no repetir el mismo texto dos
veces. Toda consulta que traiga una sucursal para enseñarla debe pedir también
`marcas(nombre_comercial)`.

## El micrositio enseña lo vigente, no el archivo

`agendaDe()` es lo que el negocio anuncia hoy: eventos que todavía no ocurren y
noticias de los últimos `DIAS_DE_NOTICIA` días (hoy, 30). Lo que caduca
desaparece **del micrositio**, no de la base: sigue en `/eventos`, `/noticias` y
en su propia página `/eventos/[id]`. Nada se borra.

## Publicar lo autoriza el pago

Desde la migración **000012** ya no hay revisión previa: quien paga, sale en el
directorio. El trigger `proteger_estado_sucursal` deja pasar a `publicado` si
existe una fila en `suscripciones` con `estado = 'activo'` para esa sucursal.
Que la sucursal sea suya no se comprueba ahí: de eso se encarga la política
`sucursales_edita_propia`, la única vía por la que un UPDATE llega al trigger.

Lo que **no** cambió y no debe cambiar:

- **Rechazar** sigue siendo del administrador. Ya no es el paso normal de nadie,
  pero es como se saca del directorio a un negocio que no debía estar.
- **Una pausa de moderación no se levanta pagando.** Si faltara esa rama,
  bastaría un mes más de suscripción para deshacer la decisión del
  administrador. La pausa que se puso el propio negocio sí se levanta sola.

`pendiente_aprobacion` quedó en desuso pero sigue en el enum: puede haber filas
viejas y quitar un valor de un enum obliga a recrear el tipo.

## Reseñas: son dos cosas, no una

Calificar y comentar tienen reglas distintas, y por eso son dos tablas:

- **`calificaciones`** — de 1 a 5 estrellas, **una sola vez** por persona y
  negocio. La llave primaria es `(usuario_id, sucursal_id)` y **no existe
  política de UPDATE**: la ausencia de la política *es* la regla, porque RLS
  niega por omisión. Si alguien agrega una, rompe el spec sin darse cuenta.
- **`resenas`** — texto y foto opcional, **una al día** por persona y negocio,
  contado en hora de Tabasco por el trigger `limitar_resena_diaria`. Es
  `before insert` nada más: corregir el comentario de hoy no cuenta como dejar
  otro, y la marca sigue pudiendo responder.

El promedio sale de la vista `calificaciones_sucursal`, que va con
`security_invoker = true` para que respete la política de lectura y el promedio
de un micrositio en borrador no se asome al público. En el directorio se pega a
las tarjetas con un solo `in` (`conCalificaciones`), no con una consulta por
negocio.

Las fotos de reseña van a su propio bucket **`resenas`** (`{usuario_id}/…`),
aparte de `micrositios` (`{sucursal_id}/…`): en uno escribe el cliente y en el
otro el dueño del negocio, y una sola política tendría que dejar escribir a los
dos.

## Cuentas de demostración

`supabase/seed.sql` las recrea en cada `db reset`, así que reiniciar la base
nunca obliga a darlas de alta a mano. Todas con contraseña `cacao12345`:

| Rol | Correo |
|---|---|
| Cliente | `cliente@guiadelcacao.mx` |
| Negocio | `negocio@guiadelcacao.mx` (marca *Chocolatería La Mazorca*) |
| Administrador | `admin@guiadelcacao.mx` |

Si alguna vez agregas usuarios ahí: `confirmation_token`, `recovery_token`,
`email_change`, `email_change_token_new` y `email_change_token_current` deben ir
en cadena vacía, no en NULL. GoTrue las lee como texto no nulable y el login
falla con un opaco *"Database error querying schema"*.

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
