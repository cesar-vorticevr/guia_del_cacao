# Guía del Cacao — Especificación técnica para desarrollo

Este documento está pensado para entregarse a Claude Code (o a un equipo de desarrollo) como punto de partida para construir la plataforma real, con base de datos, autenticación y lógica de servidor. Consolida todas las decisiones tomadas hasta ahora.

---

## 1. Resumen del producto

Directorio + red social + programa de fidelización para negocios relacionados con el cacao en Tabasco (productoras, comercializadoras, chocolaterías, museos, artesanías y otros servicios). Cada negocio tiene un micrositio. Los usuarios acumulan puntos ("mazorcas", nombre por confirmar) escaneando el QR de cada negocio, y suben de rango dentro de un año calendario. Turismo Tabasco es el cliente ancla y también participa como una marca más. Diseño mobile-first, tropical y divertido.

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

### 3.3 Publicar el micrositio (aquí entra el pago)
Cuando el negocio decide que su micrositio sea visible al público:

1. Elige **tier** (1, 2 o 3) — ver precios en sección 6.
2. Elige **sucursal** a la que aplica ese tier (el cobro es por sucursal, no por marca completa — una marca con varias sucursales repite este flujo por cada una).
3. Pantalla de **pago** (ver sección 4).
4. Al completarse el pago, el micrositio pasa a estado **pendiente de aprobación**.
5. El **Administrador** revisa y aprueba (o rechaza con motivo). Turismo **no** interviene en esta aprobación.
6. Al aprobarse, el micrositio pasa a **publicado** y aparece en el directorio.

Un negocio puede tener varias sucursales en distintos estados a la vez (una publicada, otra en borrador, otra pendiente de pago).

---

## 4. Módulo de pago (importante: aún no hay cuenta de cobro conectada)

**No hay todavía una cuenta de pasarela de pagos activa.** Aun así, la pantalla y el flujo de pago deben construirse desde ahora, para que la lógica de estados (borrador → pendiente de pago → pendiente de aprobación → publicado) ya esté completa cuando se conecte la pasarela real. Mientras tanto:

- Construir la **UI completa de checkout**: selección de tier, resumen de precio mensual, formulario de método de pago (tarjeta), botón de confirmar.
- El **procesamiento real del cobro debe quedar como una función aislada / stub** (ej. `procesarPago()`) que hoy puede simular una respuesta exitosa, para no bloquear el resto del flujo — pero debe estar claramente marcada en el código como pendiente de conectar a un proveedor real.
- Sugerencia de proveedores para México (a decidir más adelante, no es bloqueante): **Stripe** (soporta México), **Conekta** o **Mercado Pago**. Cualquiera de los tres soporta cobro recurrente mensual, que es lo que se necesita aquí.
- El modelo de datos de Suscripción (sección 7) ya debe registrar: tier, monto, sucursal, estado (activo/vencido/cancelado), fecha de inicio y fecha de próximo cobro — independientemente de qué pasarela se conecte después.
- Cuando se conecte el proveedor real, solo debe reemplazarse la función stub, sin tener que rediseñar el flujo de estados.

---

## 5. Reglas de negocio (consolidado)

### 5.1 Tiers

| Tier | Precio/mes (por sucursal) | Puede dar puntos | Puede publicar eventos y noticias | Aparece en banner rotativo principal |
|---|---|---|---|---|
| Tier 1 | $99 MXN | ❌ | ❌ | ❌ |
| Tier 2 | $199 MXN | ✅ | ❌ | ❌ |
| Tier 3 | $299 MXN | ✅ | ✅ | ✅ |

El cobro es **por sucursal**. Una marca con 3 sucursales paga 3 suscripciones independientes, cada una con su propio tier.

### 5.2 Banner rotativo
Espacio compartido en el home donde aparecen **todas las marcas Tier 3**, con la publicidad **rotando automáticamente cada 3 segundos**. No requiere compra aparte — está incluido en el precio del Tier 3.

### 5.3 Eventos y noticias
Solo marcas **Tier 3** pueden publicarlos. Campos: título, subtítulo, contenido (con límite de caracteres — pendiente definir el número exacto), imágenes (con límite — pendiente definir cuántas), fecha, marca que publica.
- **Eventos:** máximo 1 evento activo por semana por marca. Se muestran como "próximos" o "pasados" según la fecha (automático). Pueden marcarse como exclusivos para usuarios de cierto rango (ej. solo Rango 4).
- **Noticias:** siempre ordenadas de más reciente a más antigua.

### 5.4 Sistema de puntos ("mazorcas" — nombre por confirmar)
Solo marcas Tier 2 y Tier 3 pueden otorgar puntos.

**Flujo:**
1. Usuario escanea el QR fijo de la marca.
2. La plataforma muestra el catálogo de esa sucursal para que el usuario seleccione qué compró.
3. Se crea una solicitud de puntos en estado **pendiente**.
4. El usuario no puede crear una nueva solicitud a esa misma marca hasta que la anterior se resuelva (aprobada o rechazada).
5. La marca, desde su panel, decide cuántos puntos otorgar: **1 a 3**, a su criterio.
6. Tope: **máximo 3 puntos por persona, por marca, por día.**
7. Al aprobarse, se acreditan los puntos y se recalcula el rango del usuario.

**Rangos:**

| Rango | Puntos acumulados |
|---|---|
| Rango 1 | 0–19 |
| Rango 2 | 20–49 |
| Rango 3 | 50–100 |
| Rango 4 | 100–200 |

El beneficio por rango (descuento, premio, etc.) lo define cada marca a su criterio — la plataforma solo certifica el rango, no lo canjea directamente.

**Reinicio:** los puntos se reinician cada 1 de enero (a partir del 1 de enero de 2026).

**Anti-abuso:** aún no definido más allá del tope de 3/día por marca. No es bloqueante para el MVP — dejar el modelo de datos preparado para agregar reglas después (ej. campo de `intentos_rechazados` por usuario-marca, o revisión aleatoria del Administrador).

### 5.5 Reseñas
Cualquier Cliente puede dejar una reseña en el micrositio de una marca. La marca puede responder públicamente.

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
  tier_id (FK), estado (borrador | pendiente_pago | pendiente_aprobacion | publicado | rechazado | pausado),
  fecha_creacion, fecha_publicacion

Tier
  id, nombre, precio_mensual, puede_dar_puntos (bool),
  puede_publicar_contenido (bool), en_banner_principal (bool)

ProductoServicio
  id, sucursal_id (FK), nombre, descripcion, precio (nullable), imagen

Evento
  id, sucursal_id (FK), titulo, subtitulo, contenido, imagenes[],
  fecha_evento, fecha_publicacion, rango_exclusivo (nullable, FK a Rango)

Noticia
  id, sucursal_id (FK), titulo, subtitulo, contenido, imagenes[], fecha_publicacion

Reseña
  id, usuario_id (FK), sucursal_id (FK), texto, fecha, respuesta_marca (nullable)

SolicitudDePuntos
  id, usuario_id (FK), sucursal_id (FK), productos_seleccionados[] (FK ProductoServicio),
  puntos_otorgados (1-3, nullable hasta resolverse),
  estado (pendiente | aprobada | rechazada), fecha_solicitud, fecha_resolucion

RangoUsuario (calculado, uno por usuario por año)
  usuario_id (FK), anio, puntos_acumulados, rango_actual

Banner
  id, sucursal_id (FK, debe ser Tier 3), imagen, texto, orden_rotacion

Suscripcion
  id, sucursal_id (FK), tier_id (FK), monto_mensual, estado (activo | vencido | cancelado),
  fecha_inicio, fecha_proximo_cobro, metodo_pago_stub

Administrador
  id, nombre, correo, password_hash
```

---

## 7. Mapa de rutas

```
/                              Home: banner rotativo, categorías, directorio
/directorio                    Directorio filtrable
/marca/[slug]                  Micrositio público
/eventos                       Próximos y pasados
/noticias                      Feed cronológico
/registro                      Elegir Cliente o Negocio, + Google
/login                         Email/contraseña + Google
/cuenta                        Perfil de Cliente: rango, puntos, historial, reseñas hechas
/negocio/panel                 Dashboard del Negocio: editar sucursales, ver estado de cada una
/negocio/panel/sucursal/[id]   Editor de micrositio de una sucursal específica
/negocio/panel/sucursal/[id]/publicar   Selección de tier + checkout
/negocio/panel/puntos          Aprobar/rechazar solicitudes de puntos pendientes
/negocio/panel/contenido       Publicar eventos y noticias (solo Tier 3)
/admin                         Panel de administración: aprobar altas, moderar contenido
```

---

## 8. Identidad visual (ya validada en prototipo — mantener)

- **Paleta:** selva `#106b46` (primario), lima `#a8d94a`, mango `#ffb703`, guayaba `#ff5d73`, turquesa `#12b8ac`, cacao `#4a2c1d`, fondo crema `#fff7e8`.
- **Tipografía:** Fredoka (títulos/display), Nunito (cuerpo), Space Mono (cifras, precios, datos).
- **Principio:** diseño mobile-first — la versión de escritorio se adapta de la base móvil, no al revés. Componentes grandes y táctiles (pensando en el escaneo de QR desde el celular en la feria).
- Existe un prototipo visual estático de referencia (`app-prototipo.html`) que ya implementa el banner rotativo, el directorio con pills de tier, un micrositio de ejemplo y el widget de pasaporte de puntos — usarlo como referencia de layout y tono, no como código final.

---

## 9. Alcance sugerido para el primer entregable (MVP)

1. Registro/login de Cliente y Negocio, con Google OAuth.
2. Negocio puede crear sucursal(es) y editar micrositio en modo borrador, sin costo.
3. Flujo de publicar → selección de tier → checkout (con pago simulado/stub) → pendiente de aprobación.
4. Panel de Administrador para aprobar/rechazar sucursales.
5. Directorio y micrositios públicos, con banner rotativo Tier 3.
6. Sistema de puntos: escaneo de QR (puede simularse con un código manual mientras no haya lector físico integrado), solicitud, aprobación por la marca, cálculo de rango.
7. Eventos y noticias (solo Tier 3).
8. Reseñas.

**Fuera del MVP (fase 2 en adelante):** pasarela de pago real conectada, comisión por venta, apertura de registro sin intervención de Turismo/feria, réplica multi-tenant para otras ferias.

---

## 10. Pendientes que no bloquean el desarrollo, pero conviene resolver pronto

- Nombre final del punto ("mazorcas" / "monedas de chocolate" / otro) y nombre de cada rango.
- Límite exacto de caracteres e imágenes en eventos y noticias.
- Proveedor de pasarela de pago definitivo (Stripe / Conekta / Mercado Pago).
- Mecanismo anti-abuso adicional para solicitudes de puntos.
