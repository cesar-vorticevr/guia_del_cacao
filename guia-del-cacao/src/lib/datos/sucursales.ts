import { crearClienteServidor } from "@/lib/supabase/server";
import { productosDeSucursal } from "@/lib/datos/catalogo";
import type { Producto, Sucursal, Tier } from "@/lib/tipos";

const CAMPOS_SUCURSAL = `
  id, marca_id, nombre_sucursal, slug, logo, imagen_fondo, ubicacion_maps_url,
  acerca_de, whatsapp, facebook, instagram, youtube, tiktok, correo_contacto,
  telefono, tier_id, estado, motivo_rechazo, pausado_por_admin, fecha_publicacion, galeria,
  entidad, ciudad, tiers(puede_publicar_contenido)
`;

/**
 * Sucursales de un dueño.
 *
 * Se filtra por marca explícitamente. RLS deja ver además cualquier sucursal
 * publicada —el directorio la necesita—, así que apoyarse solo en la política
 * mezclaría aquí las sucursales de otros negocios.
 */
export async function misSucursales(perfilId: string) {
  const supabase = await crearClienteServidor();

  const { data: marcas } = await supabase
    .from("marcas")
    .select("id")
    .eq("perfil_id", perfilId);

  const ids = (marcas ?? []).map((m) => m.id);
  if (ids.length === 0) return [];

  const { data } = await supabase
    .from("sucursales")
    .select(CAMPOS_SUCURSAL)
    .in("marca_id", ids)
    .order("fecha_creacion");

  return (data ?? []) as unknown as Sucursal[];
}

/** Una sucursal, solo si es de quien la pide. Devuelve null si no lo es. */
export async function miSucursal(perfilId: string, sucursalId: string) {
  const todas = await misSucursales(perfilId);
  return todas.find((s) => s.id === sucursalId) ?? null;
}

/**
 * Los productos de una sucursal.
 *
 * Reenvía a `productosDeSucursal`, que va por la tabla puente: desde que el
 * catálogo es de la marca, "los productos de esta sucursal" son los que eligió
 * de ese catálogo, no unos suyos. Se conserva el nombre porque lo usan el
 * micrositio público y la pantalla de pedir monedas, y ahí la pregunta sigue
 * siendo la misma.
 */
export async function productosDe(sucursalId: string): Promise<Producto[]> {
  return productosDeSucursal(sucursalId);
}

export async function listarTiers() {
  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("tiers")
    .select("id, nombre, precio_mensual, puede_dar_puntos, puede_publicar_contenido, en_banner_principal, max_sucursales")
    .order("id");

  return (data ?? []) as Tier[];
}


export type PublicacionPropia = {
  id: string;
  titulo: string;
  imagenes: string[];
  fecha: string;
  sucursal: string;
  /** Solo en eventos: si la fecha ya pasó, dejó de salir en el micrositio. */
  paso?: boolean;
  /**
   * Solo en eventos: cuándo se canceló, o null si sigue en pie.
   *
   * Es el único estado que se guarda. "Activo" y "ya pasó" se deducen de la
   * fecha, y guardarlos sería tener dos versiones de la misma verdad: una que
   * se actualiza sola y otra que habría que ir a corregir todas las noches.
   */
  canceladoEn?: string | null;
  /** Lo que hace falta para poder editarlo sin otra consulta. */
  subtitulo?: string | null;
  contenido?: string;
  fechaEvento?: string;
};

/**
 * Los eventos y noticias que ya publicó un negocio.
 *
 * Existe porque hasta ahora solo se podían crear: una vez publicados no había
 * forma de verlos, de ponerles foto ni de borrarlos. El acotado por sucursal es
 * explícito aunque RLS ya limite la escritura, porque la lectura es tan ancha
 * como el público del micrositio.
 */
export async function misPublicaciones(sucursalIds: string[]) {
  if (sucursalIds.length === 0) return { eventos: [], noticias: [] };

  const supabase = await crearClienteServidor();
  const ahora = Date.now();

  const [eventos, noticias] = await Promise.all([
    supabase
      .from("eventos")
      .select("id, titulo, subtitulo, contenido, imagenes, fecha_evento, cancelado_en, sucursales(nombre_sucursal)")
      .in("sucursal_id", sucursalIds)
      .order("fecha_evento", { ascending: false }),
    supabase
      .from("noticias")
      .select("id, titulo, imagenes, fecha_publicacion, sucursales(nombre_sucursal)")
      .in("sucursal_id", sucursalIds)
      .order("fecha_publicacion", { ascending: false }),
  ]);

  type Fila = {
    id: string;
    titulo: string;
    imagenes: string[];
    fecha_evento?: string;
    fecha_publicacion?: string;
    cancelado_en?: string | null;
    subtitulo?: string | null;
    contenido?: string;
    sucursales: { nombre_sucursal: string } | null;
  };

  const armar = (filas: Fila[], esEvento: boolean): PublicacionPropia[] =>
    filas.map((fila) => {
      const fecha = (esEvento ? fila.fecha_evento : fila.fecha_publicacion)!;

      return {
        id: fila.id,
        titulo: fila.titulo,
        imagenes: fila.imagenes ?? [],
        fecha,
        sucursal: fila.sucursales?.nombre_sucursal ?? "",
        ...(esEvento
          ? {
              paso: new Date(fecha).getTime() < ahora,
              canceladoEn: fila.cancelado_en ?? null,
              subtitulo: fila.subtitulo ?? null,
              contenido: fila.contenido,
              fechaEvento: fila.fecha_evento,
            }
          : {}),
      };
    });

  return {
    eventos: armar((eventos.data ?? []) as unknown as Fila[], true),
    noticias: armar((noticias.data ?? []) as unknown as Fila[], false),
  };
}

/**
 * Qué le falta a un micrositio para poder publicarse, en palabras.
 *
 * La regla vive en la base (`que_le_falta_al_micrositio`) y se pregunta desde
 * aquí en vez de reimplementarla: si la pantalla tuviera su propia versión,
 * tarde o temprano diría que está listo algo que el trigger rechaza, o al
 * revés. Devuelve null cuando no le falta nada.
 */
export async function queLeFalta(sucursalId: string): Promise<string | null> {
  const supabase = await crearClienteServidor();

  const { data } = await supabase.rpc("que_le_falta_al_micrositio", {
    p_sucursal: sucursalId,
  });

  return (data as string | null) ?? null;
}

/**
 * Lo mismo, pero en renglones sueltos para poder pintarlo como una lista de
 * pendientes.
 *
 * Parte la respuesta de la base en vez de preguntar campo por campo desde
 * aquí, y es a propósito: la regla de qué hace falta sigue viviendo en un solo
 * lugar. `que_le_falta_al_micrositio` arma su texto con `string_agg(…, ', ')`,
 * así que la coma es el separador que ella misma eligió.
 */
export async function queLeFaltaPorPartes(sucursalId: string): Promise<string[]> {
  const falta = await queLeFalta(sucursalId);
  return falta ? falta.split(", ") : [];
}

/**
 * El plan vivo de una marca, o null si no tiene.
 *
 * El plan es de la cuenta desde la migración 000024: una marca con cuatro
 * locales tenía cuatro cobros al mismo plan y cuatro sitios donde cancelarlo.
 *
 * Filtra por `estado = 'activo'` a propósito: cancelar no borra la fila, la
 * marca. Quedarse con la más reciente daría por viva una que ya se dio de baja.
 */
export async function suscripcionDeMarca(marcaId: string) {
  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("suscripciones")
    .select("id, tier_id, monto_mensual, fecha_proximo_cobro")
    .eq("marca_id", marcaId)
    .eq("estado", "activo")
    .maybeSingle();

  return data;
}

/**
 * Cuántas sucursales caben con el plan que la marca tiene pagado.
 *
 * Lo contesta la base, con la misma función que usa el trigger al insertar: si
 * la pantalla llevara su propia cuenta, un día diría que cabe una más y el
 * insert la rechazaría.
 */
export async function topeDeSucursales(marcaId: string): Promise<number> {
  const supabase = await crearClienteServidor();

  const { data } = await supabase.rpc("tope_de_sucursales", { p_marca: marcaId });

  return (data as number | null) ?? 1;
}

export type EventoPropio = {
  id: string;
  titulo: string;
  subtitulo: string | null;
  contenido: string;
  imagenes: string[];
  fechaEvento: string;
  sucursal: string;
  /** Se dedujo de la fecha, no está guardado. */
  paso: boolean;
  cancelado: boolean;
};

/**
 * Un evento del negocio, para editarlo.
 *
 * El "ya pasó" se calcula aquí y no en la pantalla: mirar el reloj durante el
 * render hace que dos pintadas del mismo componente den resultados distintos, y
 * React lo prohíbe con razón. La capa de datos sí puede.
 *
 * El acotado por dueño es explícito aunque RLS ya lo cubra: la política de
 * lectura de eventos es tan ancha como el público de un micrositio publicado,
 * así que sin este filtro se abriría el editor de un evento ajeno sabiendo su id.
 */
export async function miEvento(
  perfilId: string,
  eventoId: string,
): Promise<EventoPropio | null> {
  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("eventos")
    .select(
      "id, titulo, subtitulo, contenido, imagenes, fecha_evento, cancelado_en, sucursales!inner(nombre_sucursal, marcas!inner(perfil_id))",
    )
    .eq("id", eventoId)
    .eq("sucursales.marcas.perfil_id", perfilId)
    .maybeSingle();

  if (!data) return null;

  const fila = data as unknown as {
    id: string;
    titulo: string;
    subtitulo: string | null;
    contenido: string;
    imagenes: string[] | null;
    fecha_evento: string;
    cancelado_en: string | null;
    sucursales: { nombre_sucursal: string };
  };

  return {
    id: fila.id,
    titulo: fila.titulo,
    subtitulo: fila.subtitulo,
    contenido: fila.contenido,
    imagenes: fila.imagenes ?? [],
    fechaEvento: fila.fecha_evento,
    sucursal: fila.sucursales.nombre_sucursal,
    paso: new Date(fila.fecha_evento).getTime() < Date.now(),
    cancelado: fila.cancelado_en !== null,
  };
}
