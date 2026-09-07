export type EstadoSucursal =
  | "borrador"
  | "pendiente_pago"
  | "pendiente_aprobacion"
  | "publicado"
  | "rechazado"
  | "pausado";

export type Tier = {
  id: number;
  nombre: string;
  precio_mensual: number;
  puede_dar_puntos: boolean;
  puede_publicar_contenido: boolean;
  en_banner_principal: boolean;
  /** Cuántas sucursales caben en total con este plan. */
  max_sucursales: number;
};

export type Producto = {
  id: string;
  nombre: string;
  /** Clave interna del negocio, para cruzarlo con su inventario. */
  sku: string | null;
  descripcion: string | null;
  precio: number | null;
  imagen: string | null;
};

export type Sucursal = {
  id: string;
  marca_id: string;
  nombre_sucursal: string;
  slug: string;
  logo: string | null;
  imagen_fondo: string | null;
  /** Entidad federativa; obligatoria desde el alcance nacional. */
  entidad: string;
  /** Ciudad o municipio; opcional, las anteriores al alcance nacional no la tienen. */
  ciudad: string | null;
  ubicacion_maps_url: string | null;
  acerca_de: string | null;
  whatsapp: string | null;
  facebook: string | null;
  instagram: string | null;
  youtube: string | null;
  tiktok: string | null;
  correo_contacto: string | null;
  telefono: string | null;
  tier_id: number | null;
  /**
   * Las banderas de su plan. Vienen del join y no se deducen de `tier_id`:
   * qué incluye cada plan es un dato de la tabla `tiers`, y escribir el número
   * a mano obliga a acordarse de cada sitio el día que los planes cambien.
   */
  tiers: { puede_publicar_contenido: boolean } | null;
  estado: EstadoSucursal;
  motivo_rechazo: string | null;
  /** Una pausa puesta por moderación solo la levanta quien la puso. */
  pausado_por_admin: boolean;
  galeria: string[];
  fecha_publicacion: string | null;
};

/** Cómo se le explica cada estado al negocio, en su idioma y no en el de la base. */
export const ESTADO: Record<
  EstadoSucursal,
  { texto: string; explicacion: string; tono: string }
> = {
  borrador: {
    texto: "Borrador",
    explicacion: "Solo tú lo ves. Publícalo cuando esté listo.",
    tono: "bg-crema-2 text-cacao",
  },
  pendiente_pago: {
    texto: "Falta el pago",
    explicacion: "Elegiste un plan pero el cobro no se completó.",
    tono: "bg-mango/25 text-cacao",
  },
  pendiente_aprobacion: {
    texto: "En revisión",
    explicacion: "Ya pagaste. Un administrador lo está revisando.",
    tono: "bg-turquesa/20 text-selva-2",
  },
  publicado: {
    texto: "Publicado",
    explicacion: "Visible en el directorio.",
    tono: "bg-lima/35 text-selva-2",
  },
  rechazado: {
    texto: "Rechazado",
    explicacion: "Un administrador lo rechazó. Corrige y vuelve a enviarlo.",
    tono: "bg-guayaba/20 text-cacao",
  },
  pausado: {
    // "Oculto" dice lo que pasa; "Pausado" no. El valor del enum sigue igual:
    // renombrarlo obligaria a recrear el tipo por un cambio de etiqueta.
    texto: "Oculto",
    explicacion: "Fuera del directorio. Solo tu lo ves, y vuelve con un toque.",
    tono: "bg-crema-2 text-cacao",
  },
};

/** Slug legible para la URL del micrositio: /marca/chocolateria-la-mazorca. */
export function generarSlug(texto: string) {
  return texto
    .normalize("NFD")
    // Quita los acentos que NFD acaba de separar del caracter base.
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function pesos(monto: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 0,
  }).format(monto);
}
