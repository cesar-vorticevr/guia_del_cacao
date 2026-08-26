# Prompts para las imágenes del parallax

Ramas, hojas y mazorcas de cacao que se mueven a distinta velocidad al hacer
scroll, detrás del contenido.

**El estilo, la paleta y el formato viven en `guia-de-estilo-ilustraciones.pdf`.**
Ese PDF se le adjunta a ChatGPT una sola vez, al principio; por eso los prompts
de abajo son cortos. Al final de este archivo está el respaldo por si el PDF no
se puede adjuntar.

## Cómo funciona el sistema de capas

El sitio es una columna de 1180 px centrada sobre fondo crema. Las ilustraciones
viven en los márgenes de esa columna y se meten un poco **debajo** de las
tarjetas, nunca encima. Cada capa se mueve a una fracción de la velocidad del
scroll: las ramas grandes casi no se mueven (se sienten lejos), las hojas
sueltas se mueven más rápido (se sienten cerca). Eso es todo el efecto.

En celular casi no hay márgenes, así que ahí solo aparecen los elementos
pequeños (hoja, flor, granos), muy tenues. Las ramas grandes son un efecto de
escritorio: en un teléfono no caben sin tapar el contenido.

| # | Archivo | Lienzo | Se ve a | Dónde | Velocidad |
|---|---|---|---|---|---|
| 1 | `rama-grande.png` | 1024×1536 vertical | 420 px de ancho | margen izquierdo, arriba | 0.15× (muy lenta) |
| 2 | `rama-mediana.png` | 1024×1536 vertical | 300 px | margen derecho, a media página | 0.25× |
| 3 | `rama-arco.png` | 1536×1024 horizontal | 700 px | cruzando arriba, detrás del banner | 0.12× |
| 4 | `hoja-a.png` | 1024×1024 | 150 px | suelta, varias veces | 0.55× (rápida) |
| 5 | `hoja-b.png` | 1024×1024 | 130 px | suelta, varias veces | 0.65× |
| 6 | `mazorca-mango.png` | 1024×1024 | 170 px | suelta | 0.40× |
| 7 | `mazorca-guayaba.png` | 1024×1024 | 160 px | suelta | 0.45× |
| 8 | `flor-cacao.png` | 1024×1024 | 100 px | suelta, también en celular | 0.70× |
| 9 | `granos.png` | 1024×1024 | 90 px | suelta, también en celular | 0.80× |

Guárdalas en `guia-del-cacao/public/parallax/` con esos nombres exactos.

---

# Los prompts

## Paso 0 — adjunta el PDF y pega esto

No pidas ninguna imagen todavía. Este mensaje solo sirve para que lea la guía.

```
Te adjunto la guía de estilo de un proyecto. Léela completa antes de dibujar
nada.

Vas a generar 9 ilustraciones, una por mensaje, siguiendo esa guía al pie de la
letra: paleta exclusiva de 7 colores, contorno café #4a2c1d grueso y de grosor
parejo, dibujo plano sin sombras ni degradados ni volumen 3D, fondo transparente
en PNG (o crema liso #fff7e8 si no puedes hacer transparencia), sin texto ni
marca de agua, y el objeto aislado sin escenario.

Las 9 tienen que verse como parte de la misma familia: mismo grosor de contorno,
misma paleta y mismo nivel de detalle.

No generes nada todavía. Dime en dos líneas cómo entendiste el estilo y espera
mi primer encargo.
```

Si su resumen menciona sombras, degradados, acuarela o "realista", corrígelo
antes de seguir. Es más barato arreglarlo ahí que a la séptima imagen.

---

## 1 — `rama-grande.png` · lienzo vertical 1024×1536

```
Imagen 1 de 9. Lienzo vertical 1024x1536.

Una rama de cacao grande y frondosa que entra desde el borde IZQUIERDO.

- Tallo leñoso y grueso, café cacao #4a2c1d, sale del borde izquierdo a media
  altura y se curva hacia arriba y hacia la derecha.
- 6 hojas grandes de cacao: largas, ovaladas, con la punta marcada y la
  nervadura central visible. En ángulos distintos, unas en verde selva #106b46
  y otras en verde lima #a8d94a.
- 2 mazorcas colgando del tallo, con los surcos verticales bien marcados: una
  amarillo mango #ffb703 y otra rosa guayaba #ff5d73.
- Composición asimétrica y natural, no un patrón repetido.

Encuadre: el tallo DEBE tocar el borde izquierdo del lienzo, como si la rama
continuara fuera de la imagen. Nada más toca los otros bordes; deja aire
alrededor de las hojas y las mazorcas.
```

## 2 — `rama-mediana.png` · lienzo vertical 1024×1536

```
Imagen 2 de 9. Lienzo vertical 1024x1536. Mismo estilo, mismo grosor de
contorno y misma paleta que la anterior.

Una rama de cacao más ligera y delgada que la primera, que entra desde el borde
IZQUIERDO.

- Tallo delgado café cacao #4a2c1d, entra por el borde izquierdo en la parte
  baja y sube en diagonal hacia la esquina superior derecha.
- 4 hojas nada más, más pequeñas que las de la rama grande, en verde lima
  #a8d94a y verde oscuro #0c5236.
- 1 sola mazorca colgando cerca del centro, en verde lima #a8d94a con los
  surcos en verde oscuro #0c5236.
- Se ve claramente más despejada que la primera: aquí hay más aire vacío que
  hoja.

Encuadre: el tallo DEBE tocar el borde izquierdo. Nada más toca los otros
bordes.
```

## 3 — `rama-arco.png` · lienzo horizontal 1536×1024

```
Imagen 3 de 9. Lienzo horizontal 1536x1024. Mismo estilo y misma paleta.

Una rama de cacao larga y horizontal, SIN mazorcas, solo con hojas.

- El tallo entra por el borde IZQUIERDO en la parte superior, cruza toda la
  imagen a lo ancho y describe un arco suave que baja hacia el centro y vuelve
  a subir hacia la derecha.
- 8 hojas colgando hacia abajo a lo largo del tallo, de tamaños distintos,
  alternando verde selva #106b46, verde lima #a8d94a y verde oscuro #0c5236.
- Nada de mazorcas y nada de flores. Solo tallo y hojas.

Encuadre: el tallo toca el borde izquierdo Y el borde derecho, como si la rama
atravesara la imagen de lado a lado. Las hojas cuelgan sin tocar el borde
inferior.
```

## 4 — `hoja-a.png` · lienzo cuadrado 1024×1024

```
Imagen 4 de 9. Lienzo cuadrado 1024x1024. Mismo estilo y misma paleta.

UNA sola hoja de cacao suelta, sin tallo ni rama.

- Alargada y ovalada, con la punta bien marcada.
- Nervadura central gruesa y unas 5 nervaduras laterales, en verde oscuro
  #0c5236.
- Cuerpo de la hoja en verde selva #106b46.
- Inclinada unos 30 grados hacia la DERECHA, ni vertical ni horizontal.
- Asimétrica: un lado de la hoja más ancho que el otro. Esto importa, la hoja
  se va a voltear y repetir.

Encuadre: centrada, completa, sin tocar ningún borde, con bastante aire
alrededor.
```

## 5 — `hoja-b.png` · lienzo cuadrado 1024×1024

```
Imagen 5 de 9. Lienzo cuadrado 1024x1024. Mismo estilo y misma paleta.

UNA sola hoja de cacao suelta, claramente distinta a la anterior.

- Alargada, con una curva en S: está algo doblada sobre sí misma, así que se ve
  la cara de arriba en verde lima #a8d94a y un pedazo de la cara de abajo en
  verde selva #106b46.
- La punta se enrosca ligeramente.
- Nervadura central en verde oscuro #0c5236.
- Inclinada hacia la IZQUIERDA, al revés que la hoja anterior.

Encuadre: centrada, completa, sin tocar ningún borde, con aire alrededor.
```

## 6 — `mazorca-mango.png` · lienzo cuadrado 1024×1024

```
Imagen 6 de 9. Lienzo cuadrado 1024x1024. Mismo estilo y misma paleta.

UNA sola mazorca de cacao madura, suelta.

- Forma de balón de rugby con las dos puntas marcadas, algo más gorda de un
  lado.
- 8 o 10 surcos verticales bien visibles que la recorren de punta a punta.
- Cuerpo en amarillo mango #ffb703, surcos y contorno en café cacao #4a2c1d.
- Un pedacito de tallo corto en café cacao #4a2c1d en la punta de arriba.
- Inclinada unos 20 grados.

Encuadre: centrada, completa, sin tocar ningún borde, con aire alrededor.
```

## 7 — `mazorca-guayaba.png` · lienzo cuadrado 1024×1024

```
Imagen 7 de 9. Lienzo cuadrado 1024x1024. Mismo estilo y misma paleta.

UNA sola mazorca de cacao suelta, hermana de la anterior pero distinta.

- Misma forma de balón de rugby con puntas marcadas y surcos verticales.
- Cuerpo en rosa guayaba #ff5d73, surcos y contorno en café cacao #4a2c1d.
- Del tallo de arriba sale UNA hoja pequeña de cacao en verde lima #a8d94a.
- Inclinada unos 20 grados hacia el lado CONTRARIO que la mazorca amarilla.

Encuadre: centrada, completa, sin tocar ningún borde, con aire alrededor.
```

## 8 — `flor-cacao.png` · lienzo cuadrado 1024×1024

```
Imagen 8 de 9. Lienzo cuadrado 1024x1024. Mismo estilo y misma paleta.

Un ramillete pequeño de 3 flores de cacao.

- Las flores de cacao son diminutas, con forma de estrella de 5 pétalos, y
  brotan directamente del tronco, no de una rama con hojas.
- Pétalos en rosa guayaba #ff5d73, centro en amarillo mango #ffb703.
- Las 3 brotan de un pedazo corto de corteza en café cacao #4a2c1d, con tallos
  muy cortos.
- Las 3 en tamaños ligeramente distintos y apuntando en direcciones distintas.

Encuadre: centrado, completo, sin tocar ningún borde, con bastante aire
alrededor.
```

## 9 — `granos.png` · lienzo cuadrado 1024×1024

```
Imagen 9 de 9. Lienzo cuadrado 1024x1024. Mismo estilo y misma paleta.

3 granos de cacao sueltos.

- Cada grano con forma de almendra gruesa y redondeada, con una hendidura
  central marcada a lo largo.
- Contorno y hendidura en café cacao #4a2c1d; el cuerpo del grano en un café
  más claro, cálido, sin tirar a gris ni a rosa. Esta es la ÚNICA excepción a
  la paleta.
- Los 3 separados entre sí, cada uno en un ángulo distinto, sin encimarse y sin
  formar un triángulo perfecto.

Encuadre: el grupo va centrado, sin tocar ningún borde, con aire alrededor.
```

---

## Qué rechazar y volver a pedir

- **Fondo blanco puro, gris o con degradado.** Blanco `#ffffff` sobre crema
  `#fff7e8` se nota como un recuadro sucio. Tiene que ser transparente o crema
  exacto.
- **Colores fuera de la paleta**: azul cielo, morado, beige, terracota, verde
  olivo. Es lo que más se le escapa.
- **Sombra o degradado dentro del dibujo.** El sitio tiene una sola sombra, dura
  y sin difuminar, y la pone el CSS. Una sombra pintada en la imagen se pelea
  con ella.
- **Perspectiva o volumen 3D**, brillos, reflejos, acuarela, textura de papel.
- **Contorno delgado o desigual.** El grosor parejo es la mitad de la identidad.
- **La rama sin tocar el borde izquierdo**: si flota en medio del lienzo, en
  pantalla se va a ver una rama cortada en el aire en vez de una que entra desde
  fuera.

Si a la mitad de la serie empieza a derivar, no discutas: vuelve a adjuntar el
PDF y sigue desde donde ibas.

---

## Apéndice — respaldo sin PDF

Si no puedes adjuntar el PDF, pega este bloque **al principio de cada uno** de
los nueve prompts. Es la misma información, en texto.

```
Ilustración plana en 2D, estilo vectorial moderno y amigable, para un sitio web
sobre el cacao de Tabasco, México.

Estilo obligatorio:
- Plana: sin degradados, sin sombras, sin texturas, sin ruido, sin realismo.
- Contorno grueso y de grosor parejo, color café oscuro #4a2c1d, en todo el
  dibujo.
- Formas redondeadas, gruesas y amables. Nada afilado, nada delgado, nada
  quebradizo.
- Máximo 3 tonos por elemento.
- Vista frontal y plana, sin perspectiva, sin volumen 3D, sin brillos.
- Paleta EXCLUSIVA, no uses ningún otro color: verde selva #106b46, verde
  oscuro #0c5236, verde lima #a8d94a, amarillo mango #ffb703, rosa guayaba
  #ff5d73, turquesa #12b8ac, café cacao #4a2c1d.
- Fondo TRANSPARENTE, formato PNG. Si no puedes hacer el fondo transparente,
  usa un fondo liso y perfectamente uniforme de color crema #fff7e8, sin
  degradado y sin sombra.
- Sin texto, sin letras, sin números, sin logotipo, sin marca de agua, sin
  firma.
- Sin marco, sin viñeta, sin encuadre decorativo, sin escenario: únicamente el
  objeto que se describe abajo, aislado.
```

## Cuando las tengas

Déjalas en `guia-del-cacao/public/parallax/` y avísame. Yo armo el componente
que las coloca, les da la velocidad de cada capa, las espeja para el lado
derecho y las apaga en `prefers-reduced-motion` — el sistema de diseño ya
respeta esa preferencia y el parallax tiene que respetarla también.
