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

## Cuatro funciones están apagadas

`src/lib/funciones.ts` decide qué está encendido. Hoy están en `false` las
**mazorcas**, los **cupones**, la **comunidad** y los **rangos** del cliente.

Buena parte de este documento describe cómo funcionan esas cuatro cosas, y
sigue siendo cierto: el código, las tablas, los triggers y las políticas están
completos y probados. Lo que no está es encendido. Antes de tocar algo de
mazorcas, cupones o comunidad conviene saber que hoy no se ve en pantalla.

**El porqué**, para que nadie lo revierta por parecerle una poda arbitraria: en
el sondeo a chocolateras de septiembre de 2026, de cinco negocios ninguno tenía
problema de clientes que no vuelven —tres dijeron tener clientela fija— y dos
señalaron las mazorcas como la parte que no entendían. Cuatro de cinco
eligieron visibilidad (directorio, micrositio, agenda) cuando se les pidió
quedarse con una sola función. Se apagó lo que nadie pidió para lanzar con lo
que sí.

Apagar una función toca tres sitios: la navegación del cliente
(`barra-inferior`), las pestañas del panel (`pestanas-del-panel`) y la página
de la función, que redirige cuando su bandera está en `false`.

## La guía es de México, no de Tabasco

`sucursales.entidad` es obligatoria y sale de las 32 del INEGI, con el mismo
listado en el check de la base (migración 000035) y en `lib/entidades.ts`: si se
toca una lista hay que tocar la otra. `ciudad` es opcional, porque las
sucursales anteriores al alcance nacional no la tenían.

**La columna no se puede llamar `estado`**: ese nombre lo ocupa el enum de
publicación (`borrador` / `publicado` / `pausado`) desde la migración 000001. En
la URL del directorio sí se llama `?estado=`, que es la palabra que usa quien
busca.

El filtro por entidad solo aparece cuando hay negocios publicados en más de una:
una lista donde 31 opciones llevan a "no hay nada aquí" no es un filtro.

## Puertos locales

Este proyecto convive con otro Supabase local en la misma máquina, así que usa
un rango propio: API `54421`, base `54422`, Studio `54423`, correo `54424`.

## Cómo se llaman las cosas

La unidad se llama **mazorcas de cacao** y los cuatro rangos son
**Curioso · Catador · Conocedor · Maestro cacaotero**. Todo eso vive en
`src/lib/vocabulario.ts`, no repartido por la interfaz.

Fueron *monedas de chocolate* hasta que se cambiaron: la mazorca fue moneda de
verdad en Mesoamérica, así que juntarlas cuenta una historia que la moneda
genérica no contaba. Y lo que era el **pasaporte** ahora es **tu cuenta**:
nadie que entraba por primera vez sabía qué iba a encontrar detrás de esa
palabra.

El símbolo es la **mazorca ilustrada** (`public/marca/mazorca.png`, 5 KB), la
misma del logotipo, y no un emoji: el 🪙 dejó de tener sentido y el 🫘 se lee
como un frijol. Aparece en el botón que se pulsa, en la lluvia del festejo y en
la campanita de cada sucursal.

Los cortes de la escalera (20, 50, 100) están dos veces: en
`public.calcular_rango` y en `RANGOS`. La base es la que manda; el vocabulario
solo los explica y dice cuánto falta para el siguiente. Si cambian, cambian en
los dos lados.

Los rangos van en masculino genérico a propósito, es una decisión tomada: no se
pregunta el género al registrarse y se prefirió eso antes que buscar nombres
neutros. No hace falta volver a plantearlo.

**El código y la base siguen diciendo `monedas` y `puntos_*`,** y es a propósito:
ahí se guarda la unidad, en el vocabulario se le pone nombre comercial. Por eso
el cambio a mazorcas no tocó ni una migración ni un identificador — solo los
textos y cuatro cadenas del vocabulario. Las rutas tampoco cambiaron:
**`/monedas/{slug}` es la que llevan los QR ya impresos** y renombrarla dejaría
carteles muertos en los mostradores.

## Imágenes

Todo lo que se suba pasa por `src/lib/imagenes.ts`: tope de **5 MB**, formatos
JPG/PNG/WebP/AVIF y las medidas recomendadas de cada campo. Las medidas son
sugerencias —la plataforma recorta lo que le den—, pero se muestran para que
nadie tenga que adivinar por qué su logo salió cortado.

Dos límites tienen que coincidir o el resultado es un error sin explicación:
el del bucket (`file_size_limit` en la migración de storage) y el de Next.js
(`serverActions.bodySizeLimit` en `next.config.ts`, que por defecto es **1 MB**
y cortaba cualquier foto de celular con un 500 mudo).

## Pedir monedas: qué vale cada solicitud

El QR sigue siendo la puerta — a `/monedas/{slug}` no se llega de otro modo — y
la foto del ticket es **opcional**: ayuda a que le crean, no es requisito.

| Trae | Vale |
|---|---|
| La compra | 1 moneda |
| Compra + reseña | 2 monedas |
| Lo anterior + cortesía del negocio | 3 monedas |

`public.monedas_sugeridas()` lo calcula en la base porque lo lee el panel del
negocio para marcar el botón que toca. El tope de 3 por persona, por marca y por
día (spec §5.4.6) es el que hace que 3 sea el máximo de una solicitud.

Si la reseña topa con su propio límite de una al día, **la solicitud sigue
adelante valiendo una**: sería absurdo tirar toda la compra por un comentario de
más.

**`comprobantes` es el único bucket privado.** Un ticket puede traer el nombre
de quien pagó o una tarjeta terminada en. Ruta `{usuario_id}/{sucursal_id}/…`:
las dos primeras carpetas son la llave, una por cada lado del mostrador, y el
panel del negocio lo ve con URL firmada de diez minutos.

## Comunidad: un muro, no tres pestañas

`/comunidad` junta temas del foro, eventos y noticias en una sola lista
ordenada por fecha, con filtro por clase. Reemplazó a Noticias en la barra de
abajo. **Eventos conserva su pestaña propia** porque es lo único con fecha de
caducidad: quien busca qué hacer el sábado no debería filtrar para llegar.

Los temas viven en `/comunidad/tema/[id]`.

## Reseñas: una por negocio, y se actualiza

Desde la migración **000017** cada quien tiene **una** reseña y **una**
calificación por negocio, y las dos **se corrigen** en vez de acumularse. Lo
que se lee en un micrositio es lo que la gente piensa hoy, no un historial de
visitas de la misma persona.

Cambiar cualquiera de las dos cuesta el mismo tope que pedir monedas: **una vez
al día**, en hora de Tabasco (`limitar_cambio_de_resena` y
`limitar_cambio_de_calificacion`). Los triggers se saltan solos cuando la marca
responde: eso toca otra columna.

Esto **revierte** la regla de la migración 000011, donde calificar era para
siempre y no había política de UPDATE. Ahora sí la hay, a propósito.

Estrellas y texto se piden **juntos**, en el mismo formulario, tanto en el
micrositio como en el paso 3 de pedir monedas.

Y desde la migración **000031** no es solo una costumbre del formulario: **no hay
reseña sin estrellas**. Lo impone `exigir_calificacion`, un trigger de insert en
`resenas`.

Hacía falta porque el paso 3 del QR guardaba el texto y la nota por separado,
cada uno con su `if`: quien escribía el comentario sin tocar las estrellas dejaba
una reseña huérfana, que salía sin nota en el micrositio mientras el promedio la
ignoraba. Nueve acabaron así antes de cerrarlo.

El trigger **es solo de insert**, a propósito: las reseñas viejas sin nota se
escribieron cuando esto se permitía, y bloquear su edición dejaría a su autor sin
poder corregir ni una falta por algo que no hizo mal. La reseña **sigue siendo
opcional** —lo que no cabe es dejarla suelta, sin nota que sume al promedio.

## Foto o video

Las reseñas y los comprobantes aceptan las dos cosas: 20 MB, y
`serverActions.bodySizeLimit` en 22mb para que quepan con las cabeceras del
multipart. El tipo se deduce de la extensión (`esVideo()`), no de una columna:
el nombre del archivo lo pone la aplicación al subirlo, así que guardarlo dos
veces sería tener dos versiones de la misma verdad.

El video se pinta con `<video controls>` y sin `autoPlay`. Los controles del
navegador ya traen play, pausa, volumen y barra, funcionan con teclado y en
celular abren el reproductor que la persona ya sabe usar.

## Comentarios: dos tablas, reglas opuestas

- **`comentarios_publicacion`** — en un evento o una noticia se comenta **una
  vez**. Es "qué me parece esto", no una conversación; quien quiera decir más,
  edita el suyo. Lo imponen dos índices únicos parciales, uno por columna.
- **`comentarios_foro`** — en un tema se puede ir y venir **hasta cinco veces**.

Las dos se **ocultan, no se borran** por quien modera (el negocio en su
publicación, el autor en su tema). Un comentario oculto **lo sigue viendo quien
lo escribió**: borrarlo en silencio se lee como censura y además confunde, la
persona lo vuelve a escribir. Quien lo escribió no puede desocultarse solo.

Ambas se leen y moderan igual, y eso vive en `lib/datos/comentarios.ts` y
`lib/comentarios/acciones.ts`, con un `contexto` de tres valores.

## El foro (histórico)

Lo que sigue describe cómo funcionaba **antes de la migración 000029**, cuando
el foro era una cosa aparte y la comunidad tenía tres formatos. Se conserva
porque explica de dónde vienen los apoyos, que siguen vigentes.

Abrir un tema **se ganaba**: un cliente con 50 monedas abría uno y con 100 hasta
tres; un negocio lo desbloquea con el plan **Barra**, y tambien son tres. Quien
puede lo resuelve `public.temas_permitidos_de()`, que despacha por rol. Los
cortes de la escalera no se escriben otra vez — `public.temas_permitidos` se
apoya en `calcular_rango`, y `temasPermitidos()` en `RANGOS`. Si cambian,
cambian en los dos lados.

**Apoyar mueve una moneda de verdad**: quien apoya se queda con una menos y el
autor con una más, en una sola transacción (`mover_moneda_de_apoyo`), con los
dos rangos recalculados. Es a propósito que no sea una moneda nueva: si el
sistema las regalara, un tema con cien apoyos crearía cien monedas de la nada y
el rango dejaría de significar "cuánto visitaste". Una por persona y por tema, y
sin política de DELETE: una moneda regalada no se devuelve.

**Cuidado con `perfiles_publicos` desde `temas_foro`**: hay dos caminos —el
autor y la tabla de apoyos— y PostgREST responde `PGRST201` si no se dice cuál.
Por eso la consulta pide `perfiles_publicos!temas_foro_autor_id_fkey`. El error
llega como data vacía, así que se ve igual que "no hay temas".

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

## Los planes

Se llaman **Mazorca**, **Grano** y **Barra** — la cadena del cacao, para que el
orden se lea sin mirar los precios. Antes eran "Tier 1/2/3", que no es palabra de
nadie y no dice que se gana al subir. No chocan con los rangos del pasaporte
(Curioso, Catador, Conocedor, Maestro cacaotero): esos son de quien visita.

El nombre vive en la tabla `tiers`, no en `vocabulario.ts`: es un dato de negocio
con su precio al lado, y el codigo sigue hablando de `tier_id`.

**Publicar eventos lo tienen los tres planes** desde la migración 000035.
`puede_publicar_contenido` gobernaba dos cosas con una bandera —publicar en la
comunidad y anunciar eventos— y al apagarse la comunidad solo le quedó la
segunda; dejarla en Premier era cobrar $399 por publicar una cata. En el sondeo,
el único negocio que eligió "anunciar mis catas y talleres" como su única
función dijo que pagaría entre $150 y $300.

Quien puede publicar se pregunta por la bandera del plan, **nunca por
`tier_id === 3`**. Ese número escrito a mano ya hizo que la agenda escondiera un
formulario que la base sí aceptaba.

Cada plan trae su **tope de sucursales** (`tiers.max_sucursales`): 1, 3 y 20. El
tope de una marca lo da su plan mas alto **pagado**, no la suma de sus planes —
cada sucursal se cobra aparte, y sumar convertiria "tres sucursales" en "tres por
cada una que ya tengas". Sin ninguna suscripcion activa el tope es 1: esa primera
es la que se arma sin pagar, para que un negocio recien llegado tenga por donde
empezar. Lo exige `exigir_tope_de_sucursales` al insertar, y la pantalla lo
consulta con la misma funcion (`tope_de_sucursales`) en vez de contar por su
cuenta.

## «¿Qué andas buscando?»: las palabras salen del catálogo

Los atajos del directorio no son una lista escrita a mano ni los nombres de los
productos: son el **trozo que se repite** entre negocios, y los saca
`palabrasQueSeRepiten()` en `lib/datos/busqueda-de-productos.ts`.

Fueron los nombres completos y salía «Cacao en polvo 500 g» — el texto de una
etiqueta, que nadie escribe al buscar. Hoy sale «cacao en polvo», y de «Barra
70% cacao» sale «barra».

Dos reglas de esa extracción no son de adorno:

- **La medida corta el nombre en tramos, no se cae.** Si solo se quitara, «barra
  70% cacao» dejaría pegadas dos palabras que nunca estuvieron juntas y el atajo
  sería «barra cacao».
- **De cada tramo valen las palabras solas y las frases que acaban donde acaba
  el tramo.** En español el sustantivo va delante y lo que lo matiza detrás: de
  «barra con chile amashito» se busca «barra» o «chile amashito», nunca «barra
  con chile».

Y solo entran las que están en **dos o más** negocios publicados: un atajo a un
solo resultado es un enlace a ese negocio, y para eso ya está el directorio.

## En el directorio se ve quién da mazorcas (apagado)

Con `FUNCIONES.mazorcas` en `false` la mazorca de la tarjeta no se pinta. Lo que
sí lleva cada tarjeta es **dónde está** —ciudad y entidad, debajo del nombre—,
que en una guía nacional es la primera pregunta de quien mira la lista.

Cada tarjeta del directorio lleva la mazorca ilustrada cuando su plan las
incluye. Al explorar, lo primero que se busca es dónde vale la pena entrar con
el pasaporte a medias, y sin la marca había que abrir los negocios uno por uno
para averiguarlo.

Sale de `tiers.puede_dar_puntos`, **no de comparar `tier_id >= 2`**: cuál es el
primer plan que las incluye es un dato de la tabla, y escribir el número en la
tarjeta obligaría a acordarse de ese sitio el día que cambien los planes.


## Canjear un cupón, y los tres avisos

El canje (migración **000033**) cierra el circulo de las mazorcas: visito,
junto, canjeo, vuelvo. El cliente lo canjea en /cupones y lo presenta en la
sucursal; el negocio lo ve en su panel y marca «ya se lo di».

Tres decisiones que no son de adorno:

- **El precio lo pone el cupón, no el formulario.** El trigger `cobrar_canje`
  sobrescribe `costo_mazorcas` con el de la tabla: mandarlo desde fuera dejaría
  elegir cuánto pagar. El cobro y el aviso van en la misma transacción que el
  canje — si el cobro fallara después, habría un cupón regalado.
- **`on delete restrict` en el cupón.** Si alguien lo canjeó, el negocio ya no
  puede borrarlo y dejar a esa persona con un vale que no apunta a nada.
- **No hay DELETE en `canjes`**: un canje es un recibo. Borrarlo dejaría a
  alguien sin lo que pagó y sin rastro de haberlo pagado. Y quien marca el vale
  como usado es el negocio, no quien lo canjeó: es el que lo tiene delante.

`notificaciones` acepta ahora tres tipos: **resena**, **solicitud** y **canje**.
El de solicitudes llevaba declarado en la restricción desde el principio sin que
nadie lo escribiera —el negocio se enteraba de una petición nueva solo si entraba
a mirar—; ahora le llega como le llega una reseña. Los tres los escriben
triggers: en `notificaciones` **sigue sin haber política de INSERT**, y eso no
cambia.

## Cupones: se crean y se borran, no se editan

Un negocio ofrece hasta **10 cupones vigentes** a cambio de mazorcas, desde la
pestaña Cupones de su panel (migración **000032**). Es lo que le da a las
mazorcas un sitio donde gastarse: hasta ahora solo se juntaban visitando y se
regalaban en la comunidad.

**Un cupón no se edita, y eso es una regla, no un olvido.** No hay política de
UPDATE en la tabla — igual que en `calificaciones`, la ausencia *es* la regla, y
quien agregue una la rompe sin darse cuenta. El motivo: alguien pudo canjearlo
ya pagando sus mazorcas, y cambiarle después el precio, la letra chica o la
fecha sería cambiarle el trato a quien pagó. Se borra y se hace otro; el
formulario lo avisa **antes** de publicar, no cuando ya es tarde.

Dos cosas se derivan y no se guardan:

- **Caducado** se compara con la fecha de hoy en Tabasco. Una columna habría que
  apagarla cada noche, y el día que fallara el proceso el cupón seguiría vivo
  sin serlo.
- **El tope cuenta solo los vigentes**, y es de la marca, no de la sucursal: son
  diez ofertas del negocio, no diez por local. Si contara los caducados, un
  negocio con dos años de historia no podría publicar nunca más sin ponerse a
  borrar lo viejo, que es justo lo que no queremos — el historial sirve para
  saber qué se ofreció y para repetir lo que funcionó.

Los cupones cuelgan de una **sucursal publicada**: en borrador no la ve nadie,
así que ofrecer desde ahí sería publicar a un escaparate cerrado.

## Las fotos se editan, no se reemplazan

Editar dejaba **cambiar la portada** y nada más: mandar una foto nueva borraba
las demás, y quitar una sola era imposible. Quien subía cuatro y quería tirar la
borrosa tenía que volver a subir las otras tres.

`EditarFotos` manda las que se conservan en campos ocultos —uno por ruta— y las
nuevas en el mismo `imagenes` de siempre. El servidor recompone la lista con lo
que llega, sin comparar con lo que había: **si no viene ningún `conservar` ni
ninguna foto nueva, no se toca la columna**, que es lo que permite corregir una
falta de ortografía sin quedarse sin portada.

Se usa igual en una publicación de la comunidad y en un evento. La diferencia
está en el mínimo: una publicación **exige al menos una** (lo pide la acción y lo
exige el `check` de la base), y un evento puede quedarse sin ninguna — por eso
`obligatoria={false}` allí, para no reprochar algo que está permitido.

Y ojo con el bucket: las fotos de la comunidad viven en `comunidad/` y las de
eventos en `micrositios/`. Las rutas de la comunidad se guardan **con el bucket
escrito delante** (`urlDePublicacion` lo lee) porque las dos empiezan por un uuid
y no hay forma de distinguirlas mirándolas.

## La comunidad: un solo formato

Había tres —temas del foro, noticias de negocio y eventos— con su tabla, su
formulario y su regla de quién podía escribir. Desde fuera eran lo mismo:
alguien cuenta algo y los demás comentan. Desde la migración **000029** todo
eso es **`publicaciones`**: título, contenido y comentarios.

Los **eventos se quedaron fuera** porque son lo único distinto de verdad: tienen
fecha y caducan, y se ordenan por cuándo ocurren. Viven en `/eventos`.

No se creó una tabla nueva: **`temas_foro` se renombró**. Ya era exactamente
esto —autor, título, contenido— y renombrar conservó los 25 comentarios, los
apoyos y sus llaves. Las 4 noticias se migraron dentro con sus comentarios, y
`noticias` quedó **en desuso** (como `productos_servicios.sucursal_id`): sigue
ahí para poder mirar atrás, pero nadie la lee — leerla enseñaría cada una dos
veces.

### Publicar cuesta una mazorca

Se acabó la escalera de rangos para abrir un tema. Publica quien quiera, pero a
una persona **le cuesta una mazorca** (`cobrar_publicacion`), la misma que
recupera si alguien le apoya la publicación. Es lo que sostiene que las mazorcas
signifiquen algo: si publicar fuera gratis, el muro se llenaría sin que nadie
visitara un negocio, que es de donde salen.

Un negocio no junta mazorcas, así que para él sigue siendo cosa del plan:
publicar viene con **Premier**, igual que los eventos.

### Comentarios nuevos

`vistas_publicacion` guarda **cuándo abrió cada quien cada publicación**. «Hay
comentarios nuevos» es que alguno es posterior a esa hora — no un contador
guardado. Un contador habría que corregirlo al comentar, al visitar y al borrar,
y basta con que falle una vez para que el aviso mienta para siempre.

La visita se anota **al entrar** y no al salir: quien abre y cierra sin bajar ya
vio lo que había, y la hora de salida dependería de un evento del navegador que
no siempre llega.

### Ocultar no es borrar

`oculta_en` saca la publicación del muro pero **su autor la sigue viendo**, con
su etiqueta, y puede devolverla. Es lo mismo que ya se hacía con los comentarios
ocultos: esconderla en silencio de quien la escribió se lee como que se borró.
Eliminar existe aparte, detrás de un despliegue, porque es la única de las tres
que no tiene vuelta atrás.

## Publicar es del plan, y se apaga solo al bajar

Eventos y noticias los incluye **Premier** (`tiers.puede_publicar_contenido`).
Hasta la migración **000028** esa columna no la comprobaba nadie: la política de
escritura solo pedía ser dueño de la sucursal, así que un plan Básico publicaba
lo mismo que uno Premier.

**Lo que se ve no se copia a una columna «oculto»: se deriva del plan de hoy**
(`public.marca_publica_contenido`). Con una columna habría que acordarse de
apagarla al bajar y de encenderla al volver, y el día que alguien olvide una de
las dos quedan eventos visibles sin plan o eventos pagados sin ver. Derivándolo,
bajar oculta y subir devuelve, sin proceso que mantener y sin borrar nada.

- La política de lectura pide `sucursal_publicada AND marca_publica_contenido`,
  **pero deja pasar a `posee_sucursal`**: eso es lo que permite que el negocio
  vea sus propias publicaciones marcadas como ocultas en vez de perderlas.
- Crear y editar los frena `exigir_plan_de_contenido`, un trigger y no solo el
  `WITH CHECK` de la política: un WITH CHECK que falla llega como *«new row
  violates row-level security policy»*, que no dice que falta un plan.
- **Borrar sí se puede sin plan.** Son sus publicaciones, y cobrarle por tirar
  algo que ya no se ve sería cobrarle por limpiar. Por eso el trigger es solo
  de insert y update.

En la interfaz, lo propio que está oculto **no sale en el muro ni en la agenda**
aunque su dueño lo vea por RLS: ahí, entre lo de los demás, se leería como
publicado. Sale en su sección —«Tus eventos», «Tus noticias»— y con su aviso.

## El panel se ve como el sitio público

Sucursales, Catálogo y «Tus eventos» usan la **misma tarjeta vertical** que el
explorador, el catálogo del micrositio y la agenda: foto arriba en su caja de
proporción fija, el texto debajo y los botones en una franja al pie.

Eran tres listas de renglones con miniaturas de 64 a 80 px. El problema no era
que se vieran distintas: era que el negocio **nunca veía en su panel la imagen
con la que la gente decide si entra**, y para comprobar una foto tenía que
abrir el micrositio publicado.

Las columnas no son las mismas en las tres, y es a propósito:

- **Catálogo**, 2/3/4 — igual que el del micrositio, que es lo que se está
  editando.
- **Tus eventos**, 2/3/4 — igual que la agenda pública, por lo mismo.
- **Sucursales**, 1/2/3. Esta tarjeta lleva además el estado, la lista de lo que
  falta para publicar y hasta cuatro botones; a cuatro por fila esa lista sale
  en una columna donde cada renglón se parte en dos.

Dos cosas que llevan la información en el sitio donde se busca, no en el texto:
el **estado** va sobre la foto (esquina superior derecha, en las dos), y un
producto **que no maneja ninguna sucursal** lo avisa una etiqueta sobre su foto
— es lo que hay que notar de un golpe al repasar el catálogo, porque significa
que ese producto no lo ve nadie.

En «Tus eventos» los que ya ocurrieron bajan solos a **«Ya pasaron»**, atenuados,
y sin el botón de cancelar: cancelar algo que ya pasó no le avisa a nadie.

Y **la acción va arriba, plegada**: «Agregar un producto» y «Nuevo evento» son
un botón antes de la lista, no un formulario al final. Con quince productos, el
formulario del catálogo quedaba a tres pantallas de retícula: agregar algo
obligaba a recorrer todo lo ya hecho para llegar a donde se hace lo nuevo.
Plegado y no abierto porque quien entra a mirar su catálogo no pidió un
formulario en blanco — en celular ocupaba más pantalla que los productos.

La excepción es el catálogo vacío: ahí arranca **abierto y sin «Cerrar»**, porque
no hay nada que mirar y el único paso posible es el que el formulario hace.

## Lo que se publica se maneja donde se lee

Eventos y Foro **dejaron de ser pestañas del panel**. Editar en un cuarto aparte
obligaba a salir del sitio público para escribir sobre él, y comprobar cómo
había quedado algo era navegar a otra pantalla.

- **`/eventos`** trae, para quien tiene negocio, «Tus eventos» arriba —próximos
  y ya pasados, con su buscador— y debajo la agenda de todos, también buscable.
  El editor vive en `/eventos/[id]/editar`.
- **`/comunidad`** es donde se publica: un solo botón «Publicar algo» con
  noticia y evento en pestañas, porque desde fuera es la misma decisión y lo
  único que cambia es si tiene fecha. Los dos formularios se montan a la vez y
  se esconde el que no toca: cambiar de pestaña a media redacción no debe borrar
  lo escrito.
- `/negocio/panel/eventos` y `/negocio/panel/foro` se quedan como **redirecciones**
  para los enlaces que alguien tuviera guardados.

`SubeAPremier` va donde el negocio se topa con el límite y no en la página de
planes: es el único momento en que la ventaja se entiende sola. Dice qué gana,
no qué le falta.

## La bandeja de solicitudes

Veinte solicitudes en una columna eran ocho pantallas de scroll y la de abajo no
la veía nadie. Hoy la lista se **filtra por sucursal**, va **de dos en dos** y se
**pagina de seis en seis** (`POR_PAGINA` en `components/negocio/solicitudes.tsx`).

- Las que **traen reseña ocupan la fila entera** (`sm:col-span-2`): la reseña es
  un párrafo que en media columna sale en ocho renglones, y además es la que hay
  que leer con calma antes de decidir.
- Es **paginación y no «ver más»**: lo que molestaba era bajar, y cargar más
  debajo de lo que ya hay alarga justo eso.
- El filtro cuenta sobre **todas** las pendientes, no sobre las filtradas; si no,
  al elegir una sucursal las demás saldrían en cero.
- Los comprobantes se firman **solo para lo que se pinta**: antes se pedía una URL
  al storage por cada solicitud de la lista y casi ninguna se abría.

En la tarjeta **no hay precio por renglón, hay un total al final**. Al resolver no
se cobra nada —eso pasó en la caja—, así que la columna de precios era ruido; lo
que ayuda a decidir cuántas mazorcas dar es cuánto gastó en total.

La cantidad que le toca **no lleva letrero**: va en verde con su mazorca y un aro
de color. «Le tocan» en letra chica explicaba lo que el color ya dice y hacía ese
botón más alto que los otros dos.

## Dar mazorcas se celebra, y el aviso vive fuera de la tarjeta

Al resolver una solicitud, `revalidatePath` recarga la lista y esa tarjeta
desaparece — y con ella desaparecía el aviso de «listo» que llevaba dentro. Dar
monedas se sentía como si la solicitud se hubiera esfumado.

Por eso `AvisosDeMonedas` va suelto en la página, no dentro de la lista, y se
entera por un evento del `window` (`festejarMonedas()`). Es la única forma de
que sobreviva a la recarga.

**Rechazar tiene el mismo problema y no el mismo remedio.** También deja rastro
—`avisarRechazo()`—, pero en una nota pequeña en una esquina: es una decisión que
se toma y se olvida, no algo que celebrar.

Y por eso **se festeja al pulsar, no al confirmar**: al confirmar, los botones
que lo dispararían ya no existen. El precio es desdecirse si la base rechaza —
`cancelarFestejo()` lo retira y el error se queda escrito en la tarjeta, que en
ese caso sigue ahí.

Las tres animaciones (`brinca`, `late`, `cae`) están en `@theme`, no en el
componente: son de marca, y si algún día se celebra otra cosa se celebra igual.
La lluvia de monedas lleva posiciones fijas y no `Math.random()`, que en render
daría una pintada en el servidor y otra en el navegador.

## El panel del negocio: un layout, cinco pestañas

Sucursales, Catálogo, Monedas, Eventos y Foro son **cinco rutas** bajo
`/negocio/panel`, y la fila de pestañas que las une vive en el **layout**
(`app/negocio/panel/layout.tsx`), no en cada página. Antes cada una la pintaba
por su cuenta y las que tenían ruta propia se quedaban sin menú: entrar en
Eventos era perder las pestañas y volver era el botón de atrás.

La sección activa la deduce de la ruta un componente de cliente
(`PestanasDelPanel`), porque el layout no sabe qué página está pintando. En las
pantallas de detalle —editar una sucursal, un producto, un evento— se queda
marcada su sección.

Tres cosas que se rompen si alguien las toca sin saber:

- **El layout no protege nada.** Las comprobaciones de sesión y rol se repiten
  en cada página a propósito: Next puede pintar la página sin volver a pasar por
  el layout en una navegación de cliente.
- **El h1 lo pone cada pestaña**, no el layout. Arriba solo va la tira que dice
  de quién es el panel (categoría y marca), y por eso no es un encabezado.
- **Empezando —sin ninguna sucursal— no hay pestañas**, serían cinco caminos a
  listas vacías; en su lugar queda «Volver a los primeros pasos», porque el
  recorrido de alta manda al catálogo y sin eso se llega y no se sale.

Las cuatro pantallas de pestaña arrancan **pegadas al borde izquierdo**, sin
`mx-auto`: centradas en una columna estrecha quedaban descolgadas de las
pestañas, y cambiar de pestaña movía el título de sitio. Lo que se acota es la
línea de texto (`max-w-prose`) y los formularios, no la pantalla.

## Un negocio, varias categorías — y el embed que se rompió

Desde la migración **000042** una marca puede ser chocolatería *y* museo: las
demás cuelgan de la tabla puente **`marcas_categorias`**, y `marcas.categoria_id`
se queda como la **principal**, la que encabeza el panel y la tarjeta.

Eso creó **dos caminos de `marcas` a `categorias`**, y con dos caminos PostgREST
ya no elige: `categorias(nombre)` responde `PGRST201`. El error llega como `data`
en **null**, que es exactamente lo que se lee como "este negocio no tiene
marca" — así que el panel entero rebotaba a `/negocio/completar-marca` con la
marca ahí, intacta. Se encontró intentando abrir el editor de un micrositio,
no leyendo el código.

Toda consulta que baje de `marcas` a `categorias` tiene que decir por dónde:

- `categorias!marcas_categoria_id_fkey(nombre)` para la principal.
- `marcas_categorias(categorias(id, nombre))` para todas, que es lo que pide el
  directorio y lo que aplana `aplanarCategorias`.

Es el mismo tropiezo que ya estaba documentado con `perfiles_publicos` desde
`temas_foro`. Cada vez que una migración agregue un segundo camino entre dos
tablas, hay que repasar los embeds de las dos.

## Las redes se piden como usuario, no como dirección

`lib/redes.ts` tiene la lista de redes (`REDES`) y `enlaceDeRed()`, que convierte
lo que el negocio escribió en un enlace. El formulario del micrositio pinta los
campos desde esa lista y el micrositio arma los botones con esa función: si se
agrega una red, se agrega en un sitio.

El campo acepta `@lamazorca`, `lamazorca`, `instagram.com/lamazorca` y la
dirección completa, porque las cuatro llegan. Antes el valor se usaba **tal cual
como `href`**, así que quien ponía su usuario se quedaba con un enlace relativo
dentro de su propio micrositio — una página que no existe. Y `wa.me` exige el
número internacional: diez dígitos se toman como mexicanos y se les pone el 52
delante, que es lo que hacía falta para que el botón de WhatsApp abriera algo.

De paso, de ahí solo salen enlaces `https:`. Un `href` copiado del formulario sin
mirar acepta `javascript:`.

## El catálogo es de la marca

Desde la migración **000022** los productos cuelgan de `marcas`, no de
`sucursales`. Una chocolatería con tres locales cargaba la misma barra tres
veces y al cambiar el precio tenía que acordarse de las tres.

Qué maneja cada sucursal vive en la tabla puente **`productos_sucursal`**. No hay
copias: hay una fila del producto y varias sucursales apuntando a ella, así que
editar o borrar en el catálogo se ve en todas sin tocar nada más.

- `catalogoDeMarca()` da el catálogo; `productosDeSucursal()` (y su alias
  `productosDe()`) dan lo que una sucursal eligió.
- **Sin catálogo no hay sucursal**: `exigir_catalogo` pide al menos un producto
  de la marca antes del primer insert.
- Publicar ya no exige "tener productos" sino **haber elegido** al menos uno para
  esa sucursal — lo dice `que_le_falta_al_micrositio`.
- `productos_servicios.sucursal_id` quedó **en desuso**: sigue ahí para poder
  mirar atrás, pero nadie lo lee.
- Las fotos del catálogo van a `catalogo/{marca_id}/…` y no bajo una sucursal:
  borrar una sucursal no puede llevarse la foto de un producto que las demás
  siguen usando.

Los tres triggers del alta van numerados (`al_crear_sucursal_1_correo`,
`_2_catalogo`, `_3_tope`) porque corren en orden alfabético: primero lo que se
resuelve sin pagar y al final el tope del plan.

## Publicar lo autoriza el pago

**Y exige micrositio completo** (migración 000018): nombre, "acerca de", logo
y al menos un producto. Desde que nadie revisa antes, era lo único que impedía
que saliera al directorio una ficha vacía con suscripción activa.

Qué falta lo dice `public.que_le_falta_al_micrositio()`, que devuelve **texto y
no un booleano**: el trigger lo usa para explicar el rechazo y la pantalla de
pago para poner la lista de pendientes antes de cobrar. Con un booleano, la
pantalla tendría que reimplementar la regla para decir cuál falta, y las dos
versiones se separarían.

## Avisos

`notificaciones` los escribe **un trigger**, nunca la aplicación: no hay
política de INSERT. Lo único que puede hacer quien los recibe es marcarlos
leídos, y eso lo acota `proteger_notificacion` — la política sola dejaría
reescribir el texto del aviso.

Hoy solo avisa de reseñas nuevas, y solo al crearlas: como la reseña se
actualiza (000017), avisar de cada corrección volvería el panel un ruido. El
tipo `solicitud` ya está declarado en la restricción para cuando se conecte.

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

El código está completo: botón, `entrarConGoogle`, el callback y `/elegir-rol`
—Google resuelve identidad, no rol, así que una cuenta nueva nace sin confirmar
y elige después. `manejar_nuevo_usuario` ya contempla ese caso y toma de Google
el `full_name` y el `avatar_url`.

**En producción ya está encendido** con sus credenciales en el dashboard. Lo que
hay que tener puesto ahí:

- `site_url` = el dominio real. Ojo, viene en `http://localhost:3000` por
  defecto, y con eso Supabase arma los enlaces apuntando a la máquina de quien
  lo configuró: rompe el retorno de Google **y** los correos de confirmación y de
  recuperar contraseña.
- `uri_allow_list` con `<dominio>/**`. Con la ruta exacta (`/auth/callback`) sin
  comodín, un retorno que lleve query —`?siguiente=/cupones`— puede rechazarse.
- `NEXT_PUBLIC_SITE_URL` en Vercel: detrás de un proxy la cabecera host no es el
  dominio real y la URL de retorno saldría mal.

**En local queda apagado** (`enabled = false`) hasta que `.env.local` traiga
`SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` y `..._SECRET`. Encenderlo con los
valores vacíos **no arranca GoTrue**: se queda sin contenedor y el login local
entero deja de responder. El orden está escrito en el propio `config.toml`.

El botón lleva a dónde ibas: `/login?volver=/cupones` viaja como
`?siguiente=` en el callback, validado en los dos lados —se exige una ruta que
empiece por `/` y no por `//`— para que un enlace preparado no use nuestro
dominio para mandar a alguien afuera justo después de identificarse.

## El fondo de cacao

Ramas, hojas y mazorcas que se desplazan a distinta velocidad al hacer scroll.
Viven en `components/publico/fondo-cacao.tsx` (mira qué PNG existen en
`public/parallax/`) y `fondo-cacao-capas.tsx` (el movimiento). El encargo de las
ilustraciones está en la raíz del repo: `guia-de-estilo-ilustraciones.pdf` y
`prompts-imagenes-parallax.md`.

**Ya no acompaña a todo el sitio.** Estuvo detrás de cada página pública y se
quitó del layout: competía con lo que se venía a leer, y la portada se apoya en
el aire. Hoy se pide donde hace falta, y eso es **una sola franja** — la sección
"En el directorio" de la portada.

De ahí la prop `variante`:

- `pantalla` (por omisión) cuelga del viewport, como estaba.
- `franja` lo encierra en la sección que lo contenga, que **tiene que ser
  `relative` y recortar el desborde**. Sin el recorte las piezas se pasean por
  el resto de la página. El recorrido se mide contra esa caja y no contra la
  pantalla: con el alto del viewport dentro de una franja más baja, casi todas
  las piezas caen fuera del recorte y no se ve nada.

**Mientras un PNG no exista, su capa se pinta con un marcador de color.** Es
para poder ajustar tamaños y velocidades sin tener el arte. Basta con dejar el
archivo con su nombre exacto en `public/parallax/` y recargar; no hay lista que
actualizar a mano.

No es una posición fija en el documento sino **una cinta infinita**: cada pieza
entra por abajo, sube a su velocidad y al salir por arriba reaparece abajo. Se
eligió así porque no depende del alto de la página — el directorio mide tres
pantallas y un micrositio quince, y con posiciones absolutas la mitad de abajo
del sitio se quedaba pelona. El salto del módulo no se ve porque ocurre fuera
de la pantalla.

Dos cosas que se rompen solas si alguien las toca sin saber:

- **El `main` del layout público lleva `relative z-10`,** y lo que va encima de
  una franja con fondo necesita su propio `relative z-10`. Las capas viven en
  `z-0`; sin un contexto de apilamiento propio, el contenido —que no está
  posicionado— se pinta por debajo de las hojas.
- **La columna interior de `fondo-cacao-capas` repite el ancho del `main`**
  (`w-[92vw] max-w-[1180px]`). Las piezas se cuelgan de sus bordes hacia afuera,
  no de los de la pantalla, para que el margen que ocupan crezca con el monitor.
  Anclado a la pantalla, en 1280 la mitad de la rama caía sobre el texto. Si
  cambia el ancho del `main`, cambia con él.

Las opacidades son bajas a propósito: esto pasa por detrás de párrafos sobre
fondo crema. Y todo se apaga con `motion-reduce:hidden` — es decoración, quien
pidió menos movimiento no se pierde nada.

## Antes de cerrar trabajo

```
npm run typecheck && npm run lint && npm run build
```
