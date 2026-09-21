import { crearClienteServidor } from "@/lib/supabase/server";
import { comoSeLlama, nombrarNegocio } from "@/lib/nombres";
import { urlDePublicacion, urlImagen } from "@/lib/imagenes";
import { enDiasYSemanas } from "@/lib/tiempo";

/**
 * El muro de la comunidad: publicaciones, y nada más.
 *
 * Tenía tres formatos —temas, eventos y noticias— con su filtro por clase, y
 * desde fuera eran lo mismo: alguien cuenta algo y los demás comentan. Lo único
 * distinto de verdad era el evento, que tiene fecha y caduca, así que se quedó
 * en su agenda. Aquí solo hay publicaciones.
 *
 * Los filtros de ahora no son por tipo sino por lo que le toca a quien mira:
 * todo, lo suyo, o lo que tiene respuestas sin leer.
 */
export type Filtro = "todo" | "mias" | "nuevos";

export type Entrada = {
  id: string;
  href: string;
  titulo: string;
  resumen: string;
  /** ISO, solo para ordenar. Lo que se enseña es `fechaTexto`. */
  fecha: string;
  fechaTexto: string;
/** Cuánto lleva publicada, en dos caracteres: "3d", "22s". */
  hace: string;
  /** Quién la firma: la marca si publica un negocio, la persona si no. */
  autor: string;
  /** La sucursal, cuando la firma un negocio. Va debajo y en chico. */
  detalle: string | null;
  /**
   * La cara de quien firma, para el renglón de arriba de la publicación.
   *
   * Hoy es el logo del negocio, o null. La foto de una persona no entra aquí
   * todavía: `perfiles.foto_perfil` existe en el esquema y se pide en media
   * docena de consultas, pero no hay un solo sitio en la interfaz que la pinte
   * y está vacía en 36 de 37 cuentas, así que no hay cómo saber si guarda una
   * ruta del bucket o la URL que devuelve Google. Sin eso, el respaldo es la
   * inicial del nombre, que nunca falta.
   */
  avatar: string | null;
  imagen: string | null;
  /** Las rutas guardadas, para poder editarlas una por una. */
  rutas: string[];
  /** De cada ruta a su URL: el editor pinta lo que ya está subido. */
  urlDeFoto: Record<string, string>;
  comentarios: number;
  apoyos: number;
  /** Si quien mira ya le dio corazón, para pintarlo lleno sin preguntar otra vez. */
  miApoyo: boolean;
  /** Cuántos comentarios no ha visto quien mira. Cero si no hay sesión. */
  sinVer: number;
  /**
   * Si quien mira la tiene guardada. Siempre false sin sesión.
   *
   * No hay un contador al lado como con los corazones, y es a propósito:
   * guardar es un apartado personal, no una señal pública. Nadie ve cuántos
   * guardaron algo.
   */
  guardada: boolean;
  /** Si la escribió quien mira. */
  mia: boolean;
  /** El autor la escondió: solo él la ve, y con este aviso. */
  oculta: boolean;
};

const CUANDO = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const CAMPOS = `
  id, titulo, contenido, fecha, imagenes, oculta_en, autor_id,
  perfiles_publicos!publicaciones_autor_id_fkey(nombre),
  sucursales(nombre_sucursal, logo, marcas(nombre_comercial))
`;

type Fila = {
  id: string;
  /** Opcional desde la migración 000050: una publicación ya no se titula. */
  titulo: string | null;
  contenido: string;
  fecha: string;
  imagenes: string[] | null;
  oculta_en: string | null;
  autor_id: string;
  perfiles_publicos: { nombre: string } | null;
  sucursales: {
    nombre_sucursal: string;
    logo: string | null;
    marcas: { nombre_comercial: string } | null;
  } | null;
};

/** Cuántas publicaciones trae cada tirón del scroll. */
export const POR_TIRON = 10;

export type Pagina = {
  entradas: Entrada[];
  /** El cursor para el siguiente tirón, o null si ya no hay más. */
  siguiente: string | null;
};

/**
 * Un tramo del muro, ya con lo que necesita cada filtro.
 *
 * **Pagina con cursor y no con `offset`.** El muro crece por arriba: con
 * `offset`, una publicación nueva mientras alguien va bajando corre la lista un
 * lugar, y el siguiente tirón repite una que ya vio o se salta otra. Un cursor
 * por fecha no se mueve.
 *
 * **Y el filtro va en la consulta, no en el navegador.** Filtrar solo lo que ya
 * se cargó dejaría fuera lo viejo sin decirlo: alguien con veinte publicaciones
 * vería tres en "mis publicaciones" y creería que perdió las demás.
 *
 * Los comentarios y los apoyos se cuentan de un jalón y no publicación por
 * publicación: PostgREST no agrupa, así que se traen los renglones del tramo y
 * se cuentan aquí, que es una consulta en vez de cuarenta.
 */
export async function muroDeComunidad(
  perfilId?: string,
  filtro: Filtro = "todo",
  /** Fecha ISO de la última que ya se vio. Sin ella, el muro empieza arriba. */
  cursor?: string,
): Promise<Pagina> {
  const supabase = await crearClienteServidor();

  let consulta = supabase
    .from("publicaciones")
    .select(CAMPOS)
    .order("fecha", { ascending: false });

  /*
    "Mis publicaciones" se acota en la base. "Comentarios nuevos" no se puede
    —depende de comparar cada comentario con la última visita, dos tablas y una
    resta que PostgREST no hace— así que ese se resuelve más abajo, sobre el
    tramo ya traído.
  */
  if (filtro === "mias" && perfilId) consulta = consulta.eq("autor_id", perfilId);
  if (cursor) consulta = consulta.lt("fecha", cursor);

  // Se pide uno más de los que se van a enseñar: si vuelve, hay otra página, y
  // así no hace falta una consulta aparte solo para contar.
  const { data } = await consulta.limit(POR_TIRON + 1);

  const traidas = (data ?? []) as unknown as Fila[];
  const hayMas = traidas.length > POR_TIRON;
  const filas = hayMas ? traidas.slice(0, POR_TIRON) : traidas;

  if (filas.length === 0) return { entradas: [], siguiente: null };

  const ids = filas.map((f) => f.id);

  const [comentarios, apoyos, vistas, guardados] = await Promise.all([
    supabase
      .from("comentarios")
      .select("publicacion_id, fecha, oculto")
      .in("publicacion_id", ids),
    supabase
      .from("apoyos")
      .select("publicacion_id, usuario_id")
      .in("publicacion_id", ids),
    perfilId
      ? supabase
          .from("vistas_publicacion")
          .select("publicacion_id, visto_en")
          .eq("perfil_id", perfilId)
          .in("publicacion_id", ids)
      : Promise.resolve({ data: [] }),
    /*
      Cuáles tiene guardadas quien mira. Sin sesión no se pregunta: la política
      de `guardados` solo deja ver las propias, así que sin cuenta la consulta
      volvería vacía de todos modos y es un viaje de menos.
    */
    perfilId
      ? supabase
          .from("guardados")
          .select("publicacion_id")
          .eq("usuario_id", perfilId)
          .in("publicacion_id", ids)
      : Promise.resolve({ data: [] }),
  ]);

  const guardadas = new Set(
    ((guardados.data ?? []) as { publicacion_id: string }[]).map(
      (fila) => fila.publicacion_id,
    ),
  );

  const cuantosApoyos = new Map<string, number>();
  const mios = new Set<string>();

  for (const fila of (apoyos.data ?? []) as {
    publicacion_id: string;
    usuario_id: string;
  }[]) {
    cuantosApoyos.set(
      fila.publicacion_id,
      (cuantosApoyos.get(fila.publicacion_id) ?? 0) + 1,
    );

    // Se saca del mismo lote: preguntar aparte "cuáles son míos" sería una
    // segunda consulta por la mitad de los datos que ya están aquí.
    if (fila.usuario_id === perfilId) mios.add(fila.publicacion_id);
  }

  const visto = new Map<string, number>();
  for (const fila of (vistas.data ?? []) as {
    publicacion_id: string;
    visto_en: string;
  }[]) {
    visto.set(fila.publicacion_id, new Date(fila.visto_en).getTime());
  }

  const cuantosComentarios = new Map<string, number>();
  const cuantosSinVer = new Map<string, number>();

  for (const fila of (comentarios.data ?? []) as {
    publicacion_id: string;
    fecha: string;
    oculto: boolean;
  }[]) {
    if (fila.oculto) continue;

    cuantosComentarios.set(
      fila.publicacion_id,
      (cuantosComentarios.get(fila.publicacion_id) ?? 0) + 1,
    );

    /*
      "Sin ver" es que el comentario llegó después de la última vez que abriste
      la publicación. No es un contador guardado: uno guardado habría que
      corregirlo en cada comentario nuevo, en cada visita y en cada borrado, y
      basta con que falle una vez para que el aviso mienta para siempre.

      Sin sesión no hay nada sin ver: a quien pasa por aquí sin cuenta no se le
      puede deber una respuesta.
    */
    if (!perfilId) continue;

    const cuando = visto.get(fila.publicacion_id);
    if (cuando !== undefined && new Date(fila.fecha).getTime() > cuando) {
      cuantosSinVer.set(
        fila.publicacion_id,
        (cuantosSinVer.get(fila.publicacion_id) ?? 0) + 1,
      );
    }
  }

  const entradas = filas.map((fila) => {
    const { marca, sucursal } = nombrarNegocio(fila.sucursales);

    return {
      id: fila.id,
      href: `/comunidad/${fila.id}`,
      titulo: comoSeLlama(fila.titulo, fila.contenido),
      resumen: fila.contenido,
      fecha: fila.fecha,
      fechaTexto: CUANDO.format(new Date(fila.fecha)),
      hace: enDiasYSemanas(fila.fecha),
      autor: marca ?? fila.perfiles_publicos?.nombre ?? "Alguien",
      detalle: sucursal,
      avatar: urlImagen(fila.sucursales?.logo),
      imagen: urlDePublicacion(fila.imagenes?.[0]),
      rutas: fila.imagenes ?? [],
      urlDeFoto: Object.fromEntries(
        (fila.imagenes ?? [])
          .map((ruta) => [ruta, urlDePublicacion(ruta)])
          .filter((par): par is [string, string] => par[1] !== null),
      ),
      comentarios: cuantosComentarios.get(fila.id) ?? 0,
      apoyos: cuantosApoyos.get(fila.id) ?? 0,
      miApoyo: mios.has(fila.id),
      sinVer: cuantosSinVer.get(fila.id) ?? 0,
      guardada: guardadas.has(fila.id),
      mia: fila.autor_id === perfilId,
      oculta: fila.oculta_en !== null,
    };
  });

  /*
    El filtro de "comentarios nuevos" se aplica aquí porque depende de comparar
    la fecha de cada comentario con la de la última visita.

    Eso hace que un tirón pueda quedarse corto o vacío aunque haya más adelante,
    y por eso el cursor sale de la **última fila traída** y no de la última
    enseñada: si saliera de la enseñada, el muro se pararía en el primer tramo
    sin novedades y parecería que ya no hay nada.
  */
  const visibles =
    filtro === "nuevos" ? entradas.filter((e) => e.sinVer > 0) : entradas;

  return {
    entradas: visibles,
    siguiente: hayMas ? filas[filas.length - 1].fecha : null,
  };
}

/** Una publicación, con todo lo suyo, para su propia página. */
export async function publicacion(id: string, perfilId?: string) {
  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("publicaciones")
    .select(CAMPOS)
    .eq("id", id)
    .maybeSingle();

  if (!data) return null;

  const fila = data as unknown as Fila;
  const { marca, sucursal } = nombrarNegocio(fila.sucursales);

  return {
    id: fila.id,
    titulo: fila.titulo,
    contenido: fila.contenido,
    fecha: fila.fecha,
    fechaTexto: CUANDO.format(new Date(fila.fecha)),
    autor: marca ?? fila.perfiles_publicos?.nombre ?? "Alguien",
    detalle: sucursal,
    imagen: urlDePublicacion(fila.imagenes?.[0]),
    autorId: fila.autor_id,
    mia: fila.autor_id === perfilId,
    oculta: fila.oculta_en !== null,
    /** Para el editor: lo que hay que devolverle tal cual al formulario. */
    imagenes: fila.imagenes ?? [],
    sucursalId: null as string | null,
  };
}

/**
 * Deja constancia de que alguien abrió una publicación.
 *
 * Es lo que apaga el aviso de "comentarios nuevos". Se escribe al entrar y no
 * al salir: quien abre y cierra sin bajar ya vio lo que había, y guardar la
 * hora de salida obligaría a un evento del navegador que no siempre llega.
 */
export async function anotarVisita(perfilId: string, publicacionId: string) {
  const supabase = await crearClienteServidor();

  await supabase.from("vistas_publicacion").upsert(
    {
      perfil_id: perfilId,
      publicacion_id: publicacionId,
      visto_en: new Date().toISOString(),
    },
    { onConflict: "perfil_id,publicacion_id" },
  );
}
