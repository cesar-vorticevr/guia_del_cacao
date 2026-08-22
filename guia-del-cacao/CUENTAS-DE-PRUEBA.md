# Cuentas de prueba

Todas con la contraseña **`cacao12345`**.

Las crea `supabase/seed-demo.sql`, así que un `npm run db:reset` las vuelve a
dejar igual. Las imágenes van aparte: después de un reset hay que correr
`node scripts/imagenes-de-demo.mjs` o los micrositios salen sin fotos.

> Los saldos de monedas de aquí abajo son los que deja la semilla **después de
> los apoyos del foro**, que mueven monedas de verdad: quien apoya un tema baja
> una y el autor sube una. Por eso no son números redondos.

---

## Las tres de siempre

| Rol | Correo | A dónde entra |
|---|---|---|
| Cliente | `cliente@guiadelcacao.mx` | `/cuenta` |
| Negocio | `negocio@guiadelcacao.mx` | `/negocio/panel` |
| Administrador | `admin@guiadelcacao.mx` | `/admin` |

---

## Clientes

El reparto de monedas no es al azar: hace falta gente en cada escalón para ver
la escalera funcionando. Abrir temas se desbloquea a las 50 monedas (1 tema) y
a las 100 (hasta 3).

| Correo | Nombre | Monedas | Rango | Temas que puede | Temas abiertos |
|---|---|---|---|---|---|
| `cliente01@guiadelcacao.mx` | Cliente 01 | 125 | Maestro cacaotero | 3 | 3 |
| `cliente02@guiadelcacao.mx` | Cliente 02 | 69 | Conocedor | 1 | 1 |
| `cliente03@guiadelcacao.mx` | Cliente 03 | 56 | Conocedor | 1 | 1 |
| `cliente04@guiadelcacao.mx` | Cliente 04 | 44 | Catador | 0 | 0 |
| `cliente05@guiadelcacao.mx` | Cliente 05 | 29 | Catador | 0 | 0 |
| `cliente06@guiadelcacao.mx` | Cliente 06 | 21 | Catador | 0 | 0 |
| `cliente07@guiadelcacao.mx` | Cliente 07 | 14 | Curioso | 0 | 0 |
| `cliente08@guiadelcacao.mx` | Cliente 08 | 7 | Curioso | 0 | 0 |
| `cliente09@guiadelcacao.mx` | Cliente 09 | 3 | Curioso | 0 | 0 |
| `cliente10@guiadelcacao.mx` | Cliente 10 | 0 | Curioso | 0 | 0 |

**Para probar rápido:**

- **Ver el aviso de "te faltan N monedas"** → `cliente04`, que va en 44 y
  necesita 6 más.
- **Abrir un tema** → los tres que pueden ya usaron su cupo. Borra un tema de
  `cliente01` desde su propia pantalla, o súbele monedas a otro:

  ```bash
  docker exec supabase_db_guia-del-cacao psql -U postgres -d postgres -c "update public.rangos_usuario set puntos_acumulados = 100, rango_actual = public.calcular_rango(100) where usuario_id = (select id from public.perfiles where correo = 'cliente04@guiadelcacao.mx');"
  ```

- **Apoyar un tema con una moneda** → cualquiera con saldo, por ejemplo
  `cliente06`.
- **Toparse con "no tienes monedas para apoyar"** → `cliente10`, que tiene cero.

---

## Negocios

Cada uno con un micrositio publicado, logo, imagen de fondo, dos fotos de
galería y cinco productos con foto. Los **Tier 3** son los únicos que publican
eventos y noticias, y desde ahora también los únicos que abren temas en el foro
(hasta 3).

| Correo | Marca | Categoría | Tier | Sucursal | Temas que puede |
|---|---|---|---|---|---|
| `negocio01@guiadelcacao.mx` | Hacienda La Luz | Productora / Finca | **3** | Finca Comalcalco | 3 |
| `negocio02@guiadelcacao.mx` | Chocolate Wolter | Chocolatería | **3** | Taller Villahermosa | 3 |
| `negocio03@guiadelcacao.mx` | Cacao Grijalva | Comercializadora | 2 | Bodega Centro | 0 |
| `negocio04@guiadelcacao.mx` | Museo del Cacao | Museo | **3** | Sede Comalcalco | 3 |
| `negocio05@guiadelcacao.mx` | Chocolatería Zurita | Chocolatería | 1 | Local Galerías | 0 |
| `negocio06@guiadelcacao.mx` | Finca Chontalpa | Productora / Finca | 2 | Casa Grande | 0 |
| `negocio07@guiadelcacao.mx` | Artesanías Cacao Vivo | Artesanías | 1 | Taller Nacajuca | 0 |
| `negocio08@guiadelcacao.mx` | Ruta del Cacao | Otros servicios | 2 | Oficina Villahermosa | 0 |
| `negocio09@guiadelcacao.mx` | Chocolates Comalcalco | Chocolatería | **3** | Matriz Comalcalco | 3 |
| `negocio10@guiadelcacao.mx` | Finca Jalapa | Productora / Finca | 1 | Casa Jalapa | 0 |

**Para probar rápido:**

- **Publicar evento o noticia, y abrir temas** → cualquier Tier 3
  (`negocio01`, `02`, `04`, `09`).
- **Toparse con el límite del plan** → `negocio05` (Tier 1): no puede publicar
  contenido ni dar monedas.
- **Dar monedas pero no publicar** → `negocio03`, `06` u `08` (Tier 2).
- **Moderar comentarios de su micrositio** → `negocio01` o `negocio02`, que ya
  tienen eventos con conversación.

### Precios de los planes

| Plan | Mensual | Da monedas | Publica eventos y noticias | Banner | Temas en el foro |
|---|---|---|---|---|---|
| Tier 1 | $199 | no | no | no | no |
| Tier 2 | $299 | sí | no | no | no |
| Tier 3 | $399 | sí | sí | sí | hasta 3 |

---

## Qué más deja puesto la semilla

- **12 micrositios publicados** con catálogo, fotos y reseñas.
- **8 temas de foro** con 21 comentarios y 7 apoyos, de clientes y de negocios
  Tier 3.
- **7 eventos** (uno reservado a Maestros cacaoteros) y **5 noticias**.
- **27 calificaciones** repartidas, para que el directorio no salga sin
  estrellas.
