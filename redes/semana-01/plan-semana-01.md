# Redes · Semana 1 (lunes 2 – domingo 8 de noviembre de 2026)

Cuenta regresiva al **Festival del Chocolate (12–16 nov)**: la semana presenta
la guía, invita a los negocios y calienta el festival.

Todo lo listo para subir está en `listas/`. Por cada día hay tres archivos:

| Archivo | Medida | Para |
|---|---|---|
| `NN-…-post.png` | 1080×1350 (4:5) | Feed de Instagram y Facebook |
| `NN-…-story.png` | 1080×1920 (9:16) | Historias de Instagram y Facebook |
| `NN-…-reel.mp4` | 1080×1920, 8 s, 30 fps | Reels, TikTok, Shorts (ponle música desde la app) |

Las ilustraciones (`ilustraciones/`) las hizo ChatGPT **sin texto**, con la
paleta de `guia-de-estilo-ilustraciones.pdf`. El texto, la noche de la selva,
el oro y la animación los pone `redes/herramientas/` con las tipografías de la
marca, así nunca salen letras deformes ni faltas.

> Los copys **no** dicen «gratis todo 2026» ni mencionan a la Secretaría: hoy
> el Gratis es una prueba de 15 días y el convenio está en pausa (ver
> `guia-del-cacao/AGENTS.md`). Si eso cambia, se ajustan aquí y en
> `piezas.json`.

## Calendario y copys

**Lun 2 · Presentación** — `01-presentacion`
> El cacao de México por fin tiene vitrina. 🍫 Productoras, chocolaterías,
> museos y talleres, todos en un solo lugar: guiadelcacao.com. Explorar no pide
> registro. ¿A quién deberíamos conocer primero? 👇
> #GuíaDelCacao #CacaoMexicano #ChocolateMexicano #Tabasco

**Mar 3 · Cómo funciona** — `02-como-funciona`
> ¿Buscas cacao en polvo, una barra o un molinillo? Filtra por estado, por tipo
> de negocio o por producto y llega directo con quien lo hace: WhatsApp, mapa y
> catálogo con un toque. 📍
> #GuíaDelCacao #HechoEnMéxico #CacaoDeTabasco

**Mié 4 · Para negocios** — `03-para-negocios`
> ¿Tienes un negocio de cacao? Arma tu página desde el celular en una tarde:
> logo, historia, catálogo con precios, WhatsApp, reseñas y cómo llegar.
> Pruébalo 15 días gratis, con todo incluido. Link en la bio. 🌱
> #GuíaDelCacao #Emprendedores #Chocolatería #Tabasco

**Jue 5 · Para saber** — `04-del-arbol-a-la-taza`
> De la mazorca a tu taza hay fermentación, secado, tostado, molienda… y mucho
> oficio. Guarda este post y conoce a quienes lo hacen en la guía. ☕
> #CacaoMexicano #ChocolateArtesanal #Tabasco

**Vie 6 · Festival** — `05-festival`
> ¡Faltan 6 días! 🎉 Del 12 al 16 de noviembre, Festival del Chocolate en
> Tabasco. Arma desde hoy tu ruta: guarda tus negocios favoritos y llega
> directo. ¿Quién va? 🙋
> #FestivalDelChocolate #Tabasco #Villahermosa #GuíaDelCacao

**Sáb 7 · Para quien visita** — `06-tu-ruta`
> Guarda tus favoritos y arma tu ruta del cacao antes de salir. Para quien
> visita es gratis, siempre. 🗺️
> #RutaDelCacao #TurismoTabasco #GuíaDelCacao

**Dom 8 · Comunidad** — `07-comunidad`
> Cuéntanos: ¿cuál es tu chocolate favorito? Etiqueta al negocio que lo hace y
> lo buscamos para la guía 👇💛
> #GuíaDelCacao #ChocolateMexicano #HechoEnMéxico

## Horarios sugeridos

Feed a las **13:00** y reel a las **19:00** (hora del centro), la historia del
mismo día a media mañana. El viernes del festival conviene repetir la historia
por la noche.

## Para la semana que sigue

1. Pide las ilustraciones a ChatGPT con el mismo arranque (estilo, paleta,
   1024×1536, **tercio superior vacío**, sin texto). En el chat
   «Generar ilustración cacao» ya está la serie de esta semana como referencia.
2. Guárdalas en `redes/semana-02/ilustraciones/` y copia este `piezas.json`
   cambiando textos e ilustraciones.
3. En `redes/herramientas/`:

   ```
   node render.mjs ../semana-02/piezas.json
   ```

   Con `--sin-video` solo hace las imágenes; con ids (`01 03`) solo esas
   piezas. `node hoja-de-contacto.mjs ../semana-02/piezas.json 01` pinta seis
   instantes del reel para revisarlo sin reproductor.
