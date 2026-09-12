# Guía del Cacao — Especificación técnica para desarrollo (v2)

> **Corrección posterior a la v2 — el alcance es nacional, no Tabasco.**
>
> Esta spec dice "negocios de cacao en Tabasco" (§1 y §22). Queda anulado: el
> 8 de septiembre de 2026 César decidió mantener el alcance **nacional**, que
> ya está en producción desde la migración `20260821000035`. La plataforma dice
> "el cacao de México", `sucursales.entidad` es obligatoria con las 32 del
> INEGI, y el directorio filtra por estado.
>
> Turismo Tabasco sigue siendo el cliente ancla; lo que no es, es la frontera
> del directorio. Concuerda con el propio Anexo A, donde varios negocios
> preguntaron por el alcance geográfico porque venden fuera del estado.
>
> **Todo lo demás de esta spec sigue vigente y manda sobre la v1.**

Este documento sustituye a `spec-tecnica-guia-del-cacao.md` (v1) y está pensado para entregarse a Claude Code como punto de partida para construir la plataforma real, con base de datos, autenticación y lógica de servidor. Incorpora los cambios decididos tras analizar una encuesta a 19 negocios de cacao de Tabasco (ver Anexo A).

## Nota de versión — qué cambió respecto a v1

| Tema | v1 | v2 |
|---|---|---|
| Prueba gratuita | 3 meses (mencionado en conversación, no en spec) | **15 días**, automática al publicar, sin pedir tarjeta |
| Tier 1 ($99) | "Listado" (genérico) | Aparecer en el directorio + **catálogo** + **datos de contacto** |
| Tier 2 ($199) | Puede otorgar puntos | Todo lo de Tier 1 + **puede recibir comentarios y reseñas de clientes** |
| Tier 3 ($299) | Puntos + eventos/noticias + banner | Todo lo de Tier 2 + **eventos y noticias** + banner rotativo |
| Sistema de puntos ("mazorcas") | Módulo completo (solicitudes, rangos, QR) | **Eliminado del producto.** No se construye en el MVP ni en fases posteriores salvo decisión futura explícita |
| Reseñas | Abiertas a cualquier Cliente en cualquier micrositio | **Restringidas a sucursales Tier 2 y Tier 3** |

**Por qué se eliminan los puntos:** la encuesta mostró que el concepto generaba confusión real ("no entendí lo de las mazorcas con los cupones, ¿no es lo mismo?"), que el directorio/micrositio es lo que los negocios valoran primero (9 de 19 lo eligieron como la parte indispensable, muy por encima de cualquier mecanismo de fidelización), y que simplificar el producto a tres bloques claros (aparecer → que te puedan calificar → poder promocionarte) es más fácil de vender y de construir para el lanzamiento de noviembre. Ver Anexo A para el detalle.

---

## 1. Resumen del producto

Directorio + red social para negocios relacionados con el cacao en Tabasco (productoras, comercializadoras, chocolaterías, museos, artesanías y otros servicios). Cada negocio tiene un micrositio. El acceso a funciones (catálogo, reseñas, contenido) depende del tier contratado por sucursal. Turismo Tabasco es el cliente ancla y también participa como una marca más. Diseño mobile-first, tropical y divertido.

---

## 2. Roles

| Rol | Se registra como | Login |
|---|---|---|
| **Cliente** | Usuario final | Email + contraseña, o Google |
| **Negocio** | Dueño/representante de una marca | Email + contraseña, o Google |
| **Turismo** | Cuenta tipo Negocio con bandera especial (no aprueba altas, solo publica como marca) | Email + contraseña, o Google |
| **Administrador** | Cuenta interna, no autoregistrable | Email + contraseña (sin Google, por seguridad) |

---

## 3. Autenticación y registro

### 3.1 Pantalla de registro
Al registrarse, la persona elige uno de dos caminos — no hay una cuenta genérica:

- **"Soy cliente"** → formulario de Usuario (nombre, correo, contraseña) **o botón "Continuar con Google"**.
- **"Soy negocio"** → formulario de Negocio (nombre del representante, correo, contraseña, nombre comercial de la marca, categoría) **o botón "Continuar con Google"**, y luego completa los datos de la marca.

**Login con Google:** aplica para Cliente y Negocio. Requiere integrar OAuth de Google (ej. vía Auth.js/NextAuth, Firebase Auth, o Supabase Auth — decisión libre para Code según el stack elegido). Si es la primera vez que esa cuenta de Google entra, debe preguntarse si es Cliente o Negocio antes de crear el registro (Google solo resuelve identidad, no el rol).

### 3.2 Cuenta de Negocio — qué puede hacer sin pagar
Una cuenta de Negocio recién registrada **puede crear y editar su micrositio libremente sin costo**: logo, imagen de fondo, ubicación, redes sociales, "Acerca de", catálogo, galería. Mientras no publique, el micrositio existe en estado **borrador** y no aparece en el directorio público ni es visible para nadie más que el propio negocio.

### 3.3 Publicar el micrositio → trial de 15 días → cobro

Cuando el negocio decide que su micrositio sea visible al público:

1. Elige **tier** (1, 2 o 3) — ver funciones y precios en sección 5.1.
2. Elige **sucursal** a la que aplica ese tier (el cobro es por sucursal, no por marca completa — una marca con varias sucursales repite este flujo por cada una).
3. **No se pide método de pago en este paso.** El sistema activa directamente un periodo de **prueba gratuita de 15 días** en el tier elegido.
4. El micrositio pasa a estado **pendiente de aprobación**.
5. El **Administrador** revisa y aprueba (o rechaza con motivo). Turismo **no** interviene en esta aprobación.
6. Al aprobarse, el micrositio pasa a **publicado (en trial)** y aparece en el directorio con todas las funciones de su tier activas. El conteo de los 15 días **inicia en el momento de la aprobación**, no en el momento en que el negocio eligió el tier (para no penalizar tiempos de revisión del Administrador).
7. **Durante el trial**, el negocio puede cambiar de tier libremente sin costo (el trial se aplica al tier vigente en cada momento).
8. **Al vencer el trial (día 15):**
   - Si el negocio ya cargó un método de pago → se cobra automáticamente y la sucursal pasa a **publicado (activo)**.
   - Si no hay método de pago cargado → la sucursal pasa a **pausado por pago pendiente**: el micrositio deja de aparecer en el directorio público, pero el negocio conserva su contenido guardado y puede reactivar en cualquier momento agregando método de pago.
9. Un negocio puede tener varias sucursales en distintos estados a la vez (una publicada y pagando, otra en trial, otra en borrador, otra pausada).

**Nota para Code:** el trial es *por sucursal*, no por cuenta de Negocio. Si una marca da de alta una segunda sucursal seis meses después, esa sucursal nueva también recibe sus propios 15 días de prueba, independientemente del historial de las demás sucursales de la misma marca.

---

## 4. Módulo de pago (importante: aún no hay cuenta de cobro conectada)

**No hay todavía una cuenta de pasarela de pagos activa.** Aun así, la pantalla y el flujo de pago deben construirse desde ahora, para que la lógica de estados (borrador → pendiente de aprobación → publicado/trial → publicado/activo → pausado por pago) ya esté completa cuando se conecte la pasarela real. Mientras tanto:

- Construir la **UI completa de checkout**: selección de tier, resumen de precio mensual, formulario de método de pago (tarjeta), botón de confirmar. Esta pantalla se muestra de forma **opcional durante el trial** ("agrega tu método de pago para que no se interrumpa tu publicación") y de forma **obligatoria al vencer el trial** si el negocio quiere seguir activo.
- El **procesamiento real del cobro debe quedar como una función aislada / stub** (ej. `procesarPago()`) que hoy puede simular una respuesta exitosa, para no bloquear el resto del flujo — pero debe estar claramente marcada en el código como pendiente de conectar a un proveedor real.
- Sugerencia de proveedores para México (a decidir más adelante, no es bloqueante): **Stripe** (soporta México), **Conekta** o **Mercado Pago**. Cualquiera de los tres soporta cobro recurrente mensual, que es lo que se necesita aquí.
- El modelo de datos de Suscripción (sección 6) ya debe registrar: tier, monto, sucursal, estado (trial / activo / pausado_por_pago / cancelado), fecha de inicio de trial, fecha de fin de trial, fecha de próximo cobro — independientemente de qué pasarela se conecte después.
- Cuando se conecte el proveedor real, solo debe reemplazarse la función stub, sin tener que rediseñar el flujo de estados.

---

## 5. Reglas de negocio (consolidado)

### 5.1 Tiers

| Tier | Precio/mes (por sucursal) | Incluye |
|---|---|---|
| **Tier 1** | $99 MXN | Aparece en el directorio · micrositio con catálogo de productos/servicios · datos de contacto (WhatsApp, redes, ubicación) |
| **Tier 2** | $199 MXN | Todo lo de Tier 1 + **puede recibir comentarios y reseñas** de Clientes en su micrositio, y responder públicamente |
| **Tier 3** | $299 MXN | Todo lo de Tier 2 + **puede publicar eventos y noticias** + aparece en el **banner rotativo principal** del home |

El cobro es **por sucursal**. Una marca con 3 sucursales paga 3 suscripciones independientes, cada una con su propio tier. Todas empiezan con 15 días de prueba gratuita (sección 3.3).

### 5.2 Banner rotativo
Espacio compartido en el home donde aparecen **todas las marcas Tier 3**, con la publicidad **rotando automáticamente cada 3 segundos**. No requiere compra aparte — está incluido en el precio del Tier 3.

### 5.3 Eventos y noticias
Solo marcas **Tier 3** pueden publicarlos. Campos: título, subtítulo, contenido (con límite de caracteres — pendiente definir el número exacto), imágenes (con límite — pendiente definir cuántas), fecha, marca que publica.
- **Eventos:** máximo 1 evento activo por semana por marca. Se muestran como "próximos" o "pasados" según la fecha (automático).
- **Noticias:** siempre ordenadas de más reciente a más antigua.

### 5.4 Reseñas y comentarios
- Solo sucursales **Tier 2 y Tier 3** tienen habilitada la sección de reseñas en su micrositio.
- En una sucursal **Tier 1**, cualquier Cliente puede ver el micrositio (catálogo, contacto), pero **no ve ni puede usar** la función de reseñas — no se muestra el formulario ni el listado de comentarios.
- Cualquier Cliente puede dejar una reseña en el micrositio de una marca Tier 2/3. La marca puede responder públicamente.
- **Nota para Code:** si una sucursal baja de Tier 2/3 a Tier 1 (o se pausa y luego reactiva en Tier 1), las reseñas ya existentes deben conservarse en la base de datos pero dejar de mostrarse públicamente hasta que la sucursal vuelva a Tier 2 o 3. No se borran.

---

## 6. Modelo de datos

```
Usuario
  id, nombre, correo, password_hash (nullable), google_id (nullable),
  foto_perfil, fecha_registro

Negocio
  id, nombre_representante, correo, password_hash (nullable), google_id (nullable),
  fecha_registro

Marca
  id, negocio_id (FK), nombre_comercial, categoria_id (FK)

Categoria
  id, nombre   # Productora/Finca, Comercializadora, Chocolatería, Museo, Artesanías, Otros servicios

Sucursal (= Micrositio, unidad de cobro)
  id, marca_id (FK), nombre_sucursal, logo, imagen_fondo,
  ubicacion_maps_url, acerca_de,
  whatsapp, facebook, instagram, youtube, tiktok, correo_contacto, telefono,
  tier_id (FK),
  estado (borrador | pendiente_aprobacion | publicado_trial | publicado_activo | pausado_por_pago | rechazado),
  fecha_creacion, fecha_aprobacion, fecha_publicacion

Tier
  id, nombre, precio_mensual, permite_resenas (bool), permite_publicar_contenido (bool), en_banner_principal (bool)

ProductoServicio
  id, sucursal_id (FK), nombre, descripcion, precio (nullable), imagen

Evento
  id, sucursal_id (FK), titulo, subtitulo, contenido, imagenes[],
  fecha_evento, fecha_publicacion

Noticia
  id, sucursal_id (FK), titulo, subtitulo, contenido, imagenes[], fecha_publicacion

Reseña
  id, usuario_id (FK), sucursal_id (FK), texto, fecha, respuesta_marca (nullable)
  # Solo debe permitirse crear si sucursal.tier tiene permite_resenas = true

Suscripcion
  id, sucursal_id (FK), tier_id (FK), monto_mensual,
  estado (trial | activo | pausado_por_pago | cancelado),
  fecha_inicio_trial, fecha_fin_trial, fecha_inicio_cobro, fecha_proximo_cobro,
  metodo_pago_stub

Administrador
  id, nombre, correo, password_hash
```

**Eliminado respecto a v1:** `SolicitudDePuntos`, `RangoUsuario`, `Banner` (el banner ahora se calcula dinámicamente a partir de `Sucursal.tier.en_banner_principal = true`, no necesita tabla propia salvo que se quiera controlar el orden manualmente — a decidir), y el campo `rango_exclusivo` en `Evento`.

---

## 7. Mapa de rutas

```
/                              Home: banner rotativo, categorías, directorio
/directorio                    Directorio filtrable
/marca/[slug]                  Micrositio público (catálogo siempre; reseñas solo si Tier 2/3; eventos/noticias solo si Tier 3)
/eventos                       Próximos y pasados (solo contenido de marcas Tier 3)
/noticias                      Feed cronológico (solo contenido de marcas Tier 3)
/registro                      Elegir Cliente o Negocio, + Google
/login                         Email/contraseña + Google
/cuenta                        Perfil de Cliente: reseñas hechas, favoritos
/negocio/panel                 Dashboard del Negocio: editar sucursales, ver estado y días de trial restantes de cada una
/negocio/panel/sucursal/[id]   Editor de micrositio de una sucursal específica
/negocio/panel/sucursal/[id]/publicar   Selección de tier + inicio de trial
/negocio/panel/sucursal/[id]/pago       Agregar método de pago (opcional en trial, obligatorio al vencer)
/negocio/panel/resenas         Ver y responder reseñas (solo visible si la sucursal es Tier 2/3)
/negocio/panel/contenido       Publicar eventos y noticias (solo Tier 3)
/admin                         Panel de administración: aprobar altas, moderar contenido
```

**Eliminado respecto a v1:** `/negocio/panel/puntos`.

---

## 8. Identidad visual (ya validada en prototipo — mantener)

- **Paleta:** selva `#106b46` (primario), lima `#a8d94a`, mango `#ffb703`, guayaba `#ff5d73`, turquesa `#12b8ac`, cacao `#4a2c1d`, fondo crema `#fff7e8`.
- **Tipografía:** Fredoka (títulos/display), Nunito (cuerpo), Space Mono (cifras, precios, datos).
- **Principio:** diseño mobile-first — la versión de escritorio se adapta de la base móvil, no al revés. Componentes grandes y táctiles (pensando en el escaneo desde el celular en la feria).
- Existe un prototipo visual estático de referencia (`app-prototipo.html`) — usarlo como referencia de layout y tono, no como código final. **Nota:** si ese prototipo aún muestra el widget de pasaporte de puntos, ignorarlo — ese módulo queda fuera del producto.

---

## 9. Alcance sugerido para el primer entregable (MVP)

1. Registro/login de Cliente y Negocio, con Google OAuth.
2. Negocio puede crear sucursal(es) y editar micrositio en modo borrador, sin costo.
3. Flujo de publicar → selección de tier → **trial automático de 15 días** → pendiente de aprobación.
4. Panel de Administrador para aprobar/rechazar sucursales.
5. Directorio y micrositios públicos, con catálogo (todos los tiers), reseñas (Tier 2/3) y banner rotativo (Tier 3).
6. Checkout con pago simulado/stub, disparado al vencer el trial (u opcionalmente antes).
7. Eventos y noticias (solo Tier 3).
8. Reseñas y respuesta pública de la marca (Tier 2/3).

**Fuera del MVP:** pasarela de pago real conectada, sistema de puntos/fidelización (eliminado, no se retoma salvo decisión futura explícita), apertura de registro sin intervención de Turismo/feria, réplica multi-tenant para otras ferias.

---

## 10. Pendientes que no bloquean el desarrollo, pero conviene resolver pronto

- Límite exacto de caracteres e imágenes en eventos y noticias.
- Proveedor de pasarela de pago definitivo (Stripe / Conekta / Mercado Pago).
- Qué pasa exactamente con una sucursal `pausado_por_pago`: ¿se le avisa por correo antes de pausar? ¿cuántos recordatorios?
- Si el trial de 15 días aplica también a sucursales que se dan de alta *después* del festival (fase 2), o si en el lanzamiento se hace una excepción con un trial más largo para los primeros negocios que se registren durante el Festival del Chocolate.
- Moderación de reseñas: ¿el Administrador puede ocultar una reseña, o solo la marca puede responder sin poder eliminarla?

---

## Anexo A — Hallazgos de la encuesta a 19 negocios de cacao (septiembre 2026)

Encuesta propia de César a negocios de cacao de Tabasco. Muestra pequeña (19 respuestas), no estadísticamente robusta, pero con señales consistentes que ya se incorporaron a esta versión de la spec.

**Perfil de los encuestados**
- 63% no tiene punto de venta fijo o tiene solo uno (venden en ferias, por encargo o en línea).
- 68% lleva más de 3 años operando — son negocios con trayectoria, no improvisados.
- 63% no tiene página web propia, solo redes sociales; 2 no tienen nada en internet.

**Qué valoran más del producto**
- 9 de 19 eligieron "aparecer en el directorio para que me encuentren" como lo indispensable, muy por encima de eventos, comunidad o el antiguo sistema de puntos. Esto confirma que el directorio/micrositio es el producto núcleo.

**Señales de precio**
- 37% (7/19) solo usaría la plataforma si es gratis; su techo de "esto ya es caro" está en $200/mes.
- 47% (9/19) considera razonable pagar entre $150 y $500/mes, con techo de "caro" entre $400 y $1,000.
- Hay dos segmentos claros, no un gradiente — el Tier 1 a $99 es el punto de entrada crítico para convertir al primer grupo, y el trial (ahora de 15 días) es la palanca para que prueben antes de comprometerse.

**Confusión detectada (ya resuelta en esta versión)**
- Varios negocios no entendieron el sistema de puntos ("mazorcas"), lo confundieron con cupones, o dudaron de si aplicaba a su tipo de cliente (ej. turismo internacional). Fue la causa directa de eliminarlo del alcance.

**Otras señales a tener en cuenta más adelante**
- Varios negocios preguntaron o dudaron sobre el alcance geográfico (venden fuera de Tabasco, o su cacao es de Tabasco pero su punto de venta no). El mensaje de lanzamiento debe ser explícito sobre qué cubre la plataforma hoy.
- La confianza institucional importa: al menos una respuesta mencionó directamente la necesidad de generar credibilidad — el respaldo de Turismo Tabasco funciona también como argumento de confianza hacia los negocios, no solo como cliente ancla.
