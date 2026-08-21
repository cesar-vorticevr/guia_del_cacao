# Estructura de la plataforma — Guía del Cacao

Documento de trabajo para definir roles, contenido y datos antes de empezar a desarrollar. Todo aquí es editable — está pensado como punto de partida para discutir, no como decisión final.

---

## 1. Roles y permisos

| Rol | Quién es | Puede hacer |
|---|---|---|
| **Usuario** | Visitante registrado | Explorar directorio, dejar reseñas, escanear QR, acumular puntos, ver su nivel e historial |
| **Marca** | Negocio con micrositio | Editar su micrositio, publicar hasta 1 evento activo/semana, publicar noticias, aprobar solicitudes de puntos, responder reseñas |
| **Turismo** | Cliente ancla / operador de la feria | Es una marca más (mismos permisos que cualquier marca) + espacio de **banner publicitario preferente** mensual en zonas destacadas del sitio |
| **Administrador** | Designado por ustedes o por Turismo | Control total: aprueba altas de nuevas marcas, usuarios, tiers, moderación de contenido, configuración de puntos |

Turismo **no** aprueba altas de marca — eso es exclusivo del Administrador, para mantener un solo punto de control sobre quién entra a la plataforma.

---

## 2. Mapa del sitio

```
/                          Home (destacados, buscador, categorías)
/directorio                Directorio filtrable (categoría, tier, ubicación)
/marca/[slug]               Micrositio de la marca
/eventos                   Próximos y pasados
/noticias                  Feed cronológico
/mi-cuenta                 Perfil, puntos, nivel, historial, reseñas hechas
/marca/[slug]/panel        Dashboard de marca (privado)
/turismo/panel             Dashboard de Turismo (privado)
/admin                     Panel de administración (privado)
```

---

## 3. Categoría de negocio vs. tier comercial

Son dos ejes distintos — no confundirlos en el modelo de datos:

**Categoría (qué es el negocio):**
Productora/Finca · Comercializadora · Chocolatería · Museo · Artesanías · Otros servicios

**Tier (qué puede hacer en la plataforma, no solo qué tan visible es):**

| Tier | Puede dar puntos | Puede publicar eventos y noticias | Posicionamiento / publicidad |
|---|---|---|---|
| **Tier 1** | ❌ No | ❌ No | Listado estándar |
| **Tier 2** | ✅ Sí | ❌ No | Listado estándar |
| **Tier 3** | ✅ Sí | ✅ Sí | Publicidad principal + primeros lugares en el directorio |

Cualquier categoría puede estar en cualquier tier — una finca puede ser Tier 3 igual que una chocolatería. El tier ya no es solo "cuánto paga por visibilidad", sino que **desbloquea funciones reales de la plataforma**, lo que hace más fácil justificar el precio de cada nivel ante las marcas.

**Pendiente de decidir:** precio de cada tier, y si el Tier 1 tiene algún costo o es la puerta de entrada gratuita/básica para que todo negocio esté al menos listado.

---

## 4. Micrositio de marca — campos

| Campo | Tipo | Notas |
|---|---|---|
| Logo | Imagen cuadrada | Usado en tarjetas de directorio, buscador y como ícono de la marca |
| Imagen de fondo | Imagen | 1 por micrositio |
| Ubicación | Link a Google Maps | URL, no mapa embebido propio |
| Reseñas | Lista (usuario + texto + fecha) | Con opción de respuesta de la marca |
| Redes sociales | Botones | WhatsApp, Facebook, Instagram, YouTube, TikTok, correo, teléfono |
| Acerca de | Texto | — |
| Catálogo | Lista de productos/servicios | Precio opcional por ítem |
| Carrusel de fotos | Galería | Límite de imágenes según tier (a definir) |

---

## 5. Eventos y noticias

Ambos módulos comparten estructura de publicación:

| Campo | Eventos | Noticias |
|---|---|---|
| Título | ✅ | ✅ |
| Subtítulo | ✅ | ✅ |
| Contenido (texto, con límite de caracteres) | ✅ | ✅ |
| Imágenes (con límite) | ✅ | ✅ |
| Fecha | Fecha del evento | Fecha de publicación |
| Marca que publica | ✅ | ✅ |
| Estado | Próximo / Pasado (automático según fecha) | — (siempre ordenado por más reciente) |

**Reglas de negocio:**
- Solo marcas **Tier 3** pueden publicar eventos y noticias.
- Máximo 1 evento activo por semana por marca (evita que una sola marca sature el módulo).
- Turismo, al ser Tier 3 por definición (o su equivalente), puede publicar igual que cualquier otra marca de ese nivel — además de su banner mensual (ver sección 6.1).

**Pendiente de decidir:** los límites exactos de caracteres e imágenes por publicación.

---

## 6. Sistema de puntos (pasaporte digital)

Reemplaza el pasaporte físico sellado de la feria, y a diferencia del pasaporte físico, **funciona todo el año, no solo durante la semana de feria.**

Solo marcas **Tier 2 y Tier 3** pueden otorgar puntos (Tier 1 no).

**Nombre del punto:** decidido — se llaman **monedas de chocolate**, para reforzar la identidad tropical y lúdica de la plataforma. En la interfaz se usa el nombre completo la primera vez y "monedas" a secas después.

**Flujo:**
1. El usuario escanea el QR fijo de la marca (impreso o en pantalla).
2. La plataforma le muestra los productos/servicios de esa marca (ya registrados en su catálogo) para que **seleccione qué compró**.
3. Se genera una **solicitud de puntos**, en estado pendiente.
4. El usuario **no puede generar una nueva solicitud a esa marca hasta que la anterior sea aceptada o rechazada** — evita que acumule solicitudes sin resolver.
5. La marca, desde su panel, revisa la solicitud y **decide cuántos puntos otorgar (1 a 3)**, sin importar si fue por producto o por evento — el criterio queda a discreción de la marca según el monto o tipo de compra.
6. Tope: **máximo 3 puntos por persona, por marca, por día.**
7. Al aprobarse, se acreditan los puntos y se recalcula el rango del usuario.

**Rangos:**

| Rango | Nombre | Monedas acumuladas |
|---|---|---|
| 1 | **Curioso** | 0 – 19 |
| 2 | **Catador** | 20 – 49 |
| 3 | **Conocedor** | 50 – 99 |
| 4 | **Maestro cacaotero** | 100 o más |

Cada rango no tiene un premio fijo definido centralmente — **cada marca decide qué le ofrece a un usuario según el rango en el que se encuentre**. Como guía sugerida para las marcas (no obligatoria): Rango 1-2 sin beneficio o beneficio mínimo, Rango 3 descuento especial, Rango 4 descuento mayor o premio/regalo. La plataforma solo certifica el rango del usuario; el beneficio concreto lo define cada negocio.

**Eventos exclusivos por rango:** se pueden programar eventos abiertos solo a usuarios en cierto rango (ej. un evento solo para Rango 4), como incentivo adicional para subir de nivel.

**Reinicio:** los puntos se reinician cada **1 de enero** (a partir del 1 de enero de 2026), para que el rango refleje actividad reciente y no se estanque indefinidamente.

**Entidades necesarias:** `Usuario`, `Marca`, `Producto/Servicio` (para la selección al escanear), `SolicitudDePuntos` (usuario, marca, productos seleccionados, puntos otorgados 1-3, estado: pendiente/aprobada/rechazada, fecha), `Rango` (calculado por año, no editable directamente).

**Pendiente de decidir:**
- ~~Nombre final del punto~~ → decidido: **monedas de chocolate**
- Mecanismo anti-abuso adicional si una marca y un usuario intentan generar solicitudes falsas repetidamente

---

## 6.1 Precio por tier (mensual, por sucursal)

| Tier | Precio/mes |
|---|---|
| Tier 1 | $99 |
| Tier 2 | $199 |
| Tier 3 | $299 |

**Regla:** el cobro es **por sucursal**, no por marca — una marca con 3 sucursales paga 3 suscripciones (una por cada micrositio/ubicación), aunque puedan compartir el mismo tier o tener tiers distintos por sucursal según convenga al negocio.

## 6.2 Publicidad — banner rotativo Tier 3

El banner principal del sitio **no es exclusivo de Turismo**: es un espacio compartido donde aparecen **todas las marcas Tier 3**, con la publicidad **rotando cada 3 segundos** entre ellas. Turismo aparece ahí como una marca Tier 3 más, no como dueño exclusivo del espacio.

**Entidad necesaria:** `Banner` (marca asociada, imagen, link destino, orden de rotación). Todas las marcas Tier 3 entran automáticamente al carrusel — no requiere compra aparte, ya está incluido en el precio del tier.

---

## 7. Modelo de datos (entidades principales)

```
Usuario ──< SolicitudDePuntos >── Marca
Usuario ──< Reseña >── Marca
Usuario >── Rango (calculado, se reinicia cada 1 de enero)
Marca ──< Producto/Servicio
Marca ──< Evento          (solo Tier 3)
Marca ──< Noticia         (solo Tier 3)
Marca ──< Banner          (Turismo, mensual)
Marca >── Categoría (Productora, Chocolatería, Museo, etc.)
Marca >── Tier (1: sin puntos · 2: da puntos · 3: da puntos + eventos/noticias + publicidad principal)
Turismo = Marca (mismos permisos que cualquier marca de su tier) + banners
Administrador = aprueba altas de marca, no Turismo
```

---

## 8. Fases sugeridas

| Fase | Qué incluye | Objetivo |
|---|---|---|
| **Fase 0 — Feria (MVP)** | Directorio básico, micrositios, pasaporte digital de puntos (activo todo el año desde el lanzamiento, no solo la semana de feria). Vendido en bundle por Turismo junto al stand físico. | Validar la plataforma con volumen real de la feria, cero fricción de cobro |
| **Fase 1 — Apertura** | Registro abierto todo el año, suscripción mensual por tier | Ingreso recurrente, crecimiento fuera de temporada de feria |
| **Fase 2 — Transaccional** | Catálogo con checkout real, comisión por venta | Solo si el catálogo evoluciona de informativo a venta real |
| **Fase 3 — Replicable** | Arquitectura multi-tenant para otras ferias/estados | Escalar el modelo fuera de Tabasco |

---

## 9. Dirección visual

Definida por ustedes: la plataforma debe sentirse **tropical, divertida y colorida** — no corporativa ni minimalista — y estar **diseñada primero para celular**, con la versión de escritorio como adaptación de esa base (no al revés). Esto afecta directamente el trabajo de diseño de UI que sigue después de este documento: paleta vibrante inspirada en fruta de cacao/trópico, componentes grandes y táctiles (pensando en el escaneo de QR y las solicitudes de puntos desde el celular en pleno stand de la feria), y jerarquía visual simple para pantallas pequeñas.

---

## 10. Decisiones pendientes (resumen)

- [x] ~~Nombre final del punto y de cada rango~~ → **monedas de chocolate**; Curioso, Catador, Conocedor, Maestro cacaotero.
- [ ] Límites de caracteres/imágenes en eventos y noticias
- [ ] Mecanismo anti-abuso en solicitudes de puntos — **abierto, a definir**. Algunas ideas para cuando se retome: límite de solicitudes rechazadas antes de suspender temporalmente al usuario, revisión aleatoria por el Administrador, o requerir foto del ticket de compra como respaldo opcional. No es bloqueante para empezar a construir: se puede lanzar con el tope de 3/día por marca como única barrera inicial y ajustar según se vean patrones reales de abuso.
