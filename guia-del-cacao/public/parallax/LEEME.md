# Elementos de parallax

Ilustraciones de cacao para el fondo en movimiento. Todas en PNG con fondo
transparente, así que se pueden encimar sobre cualquier color sin recorte.

Van en `public/`, no en Supabase Storage: son parte del diseño del sitio, no
contenido que suba un negocio. Se sirven estáticas y se referencian con ruta
absoluta, por ejemplo `/parallax/hoja.png`.

| Archivo | Qué es | Medidas |
|---|---|---|
| `rama-tres-mazorcas.png` | Rama con mazorca amarilla y rosa | 1024 × 1536 |
| `rama-una-mazorca.png` | Rama con una mazorca amarilla | 1024 × 1536 |
| `rama-de-hojas.png` | Rama horizontal, solo hojas | 1536 × 1024 |
| `hoja.png` | Una hoja suelta | 1254 × 1254 |
| `mazorca-rosa.png` | Mazorca rosa con hoja | 1254 × 1254 |
| `mazorca-amarilla.png` | Mazorca amarilla sola | 1254 × 1254 |
| `flores-de-cacao.png` | Flores y botones de cacao | 1254 × 1254 |
| `granos-de-cacao.png` | Tres granos, uno abierto | 1254 × 1254 |

Son ocho y no nueve: dos de las que llegaron eran el mismo archivo, byte por
byte (la rama horizontal de hojas). Se guardó una sola vez.

## Quién las usa

`src/components/publico/fondo-cacao-capas.tsx`. El catálogo de ese archivo
apunta a estos nombres tal cual; si se renombra un PNG aquí, hay que renombrarlo
allá o esa capa vuelve a pintar su marcador de color.

Las tres cosas que había que cuidar ya están cuidadas ahí:

- **El peso.** Estos archivos pesan entre 0.5 y 1.5 MB, unos 8 MB en total, y un
  adorno de fondo no puede costar más que la página. No se sirven crudos: van
  por `next/image` con `sizes` en el ancho exacto al que se ven, así que salen
  como WebP del tamaño que toca. Una hoja de 546 KB llega al navegador como 13
  KB, y la rama de 1.4 MB como 40 KB. Por eso los originales se dejan grandes:
  son el master, no lo que se descarga.
- **Son decorativas**: van con `alt=""` y el contenedor en `aria-hidden`, para
  que un lector de pantalla no las lea como contenido.
- **El movimiento respeta `prefers-reduced-motion`**: la capa entera se apaga
  con `motion-reduce:hidden`.

## Sobre la hoja

Solo hay **una** hoja suelta y se usa dos veces, con distinto giro y espejo. Por
eso el encargo pedía que fuera asimétrica: una hoja simétrica se ve idéntica al
voltearla y delata la repetición.
