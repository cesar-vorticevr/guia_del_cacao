import { crearClienteServidor } from "@/lib/supabase/server";
import { nombrarNegocio } from "@/lib/nombres";
import { urlDePublicacion } from "@/lib/imagenes";

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
  /** Quién la firma: la marca si publica un negocio, la persona si no. */
  autor: string;
  /** La sucursal, cuando la firma un negocio. Va debajo y en chico. */
  detalle: string | null;
  imagen: string | null;
  /** Las rutas guardadas, para poder editarlas una por una. */
  rutas: string[];
  /** De cada ruta a su URL: el editor pinta lo que ya está subido. */
  urlDeFoto: Record<string, string>;
  comentarios: number;
  apoyos: number;
  /** Cuántos comentarios no ha visto quien mira. Cero si no hay sesión. */
  sinVer: number;
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
  sucursales(nombre_sucursal, marcas(nombre_comercial))
`;

type Fila = {
  id: string;
  titulo: string;
  contenido: string;
  fecha: string;
  imagenes: string[] | null;
  oculta_en: string | null;
  autor_id: string;
  perfiles_publicos: { nombre: string } | null;
  sucursales: {
    nombre_sucursal: string;
    marcas: { nombre_comercial: string } | null;
  } | null;
};

/**
 * El muro, ya con lo que necesita cada filtro.
 *
 * Los comentarios y los apoyos se cuentan de un jalón y no publicación por
 * publicación: PostgREST no agrupa, así que se traen los renglones de lo que
 * cabe en un muro y se cuentan aquí, que es una consulta en vez de cuarenta.
 */
export async function muroDeComunidad(perfilId?: string): Promise<Entrada[]> {
  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("publicaciones")
    .select(CAMPOS)
    .order("fecha", { ascending: false })
    .limit(100);

  const filas = (data ?? []) as unknown as Fila[];
  if (filas.length === 0) return [];

  const ids = filas.map((f) => f.id);

  const [comentarios, apoyos, vistas] = await Promise.all([
    supabase
      .from("comentarios")
      .select("publicacion_id, fecha, oculto")
      .in("publicacion_id", ids),
    supabase.from("apoyos").select("publicacion_id").in("publicacion_id", ids),
    perfilId
      ? supabase
          .from("vistas_publicacion")
          .select("publicacion_id, visto_en")
          .eq("perfil_id", perfilId)
          .in("publicacion_id", ids)
      : Promise.resolve({ data: [] }),
  ]);

  const cuantosApoyos = new Map<string, number>();
  for (const fila of apoyos.data ?? []) {
    cuantosApoyos.set(
      fila.publicacion_id,
      (cuantosApoyos.get(fila.publicacion_id) ?? 0) + 1,
    );
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

  return filas.map((fila) => {
    const { marca, sucursal } = nombrarNegocio(fila.sucursales);

    return {
      id: fila.id,
      href: `/comunidad/${fila.id}`,
      titulo: fila.titulo,
      resumen: fila.contenido,
      fecha: fila.fecha,
      fechaTexto: CUANDO.format(new Date(fila.fecha)),
      autor: marca ?? fila.perfiles_publicos?.nombre ?? "Alguien",
      detalle: sucursal,
      imagen: urlDePublicacion(fila.imagenes?.[0]),
      rutas: fila.imagenes ?? [],
      urlDeFoto: Object.fromEntries(
        (fila.imagenes ?? [])
          .map((ruta) => [ruta, urlDePublicacion(ruta)])
          .filter((par): par is [string, string] => par[1] !== null),
      ),
      comentarios: cuantosComentarios.get(fila.id) ?? 0,
      apoyos: cuantosApoyos.get(fila.id) ?? 0,
      sinVer: cuantosSinVer.get(fila.id) ?? 0,
      mia: fila.autor_id === perfilId,
      oculta: fila.oculta_en !== null,
    };
  });
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

/**
 * Lo que hace falta para pintar los botones de regalar en una pantalla.
 *
 * Se pregunta de una vez y no botón por botón: en una publicación con quince
 * comentarios serían quince consultas para saber quince veces lo mismo.
 */
export async function bolsaDeRegalos(perfilId: string | undefined) {
  if (!perfilId) return { quedan: 0, yaLesDi: new Set<string>() };

  const supabase = await crearClienteServidor();

  const hoy = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Mexico_City",
  });

  const [{ data: quedan }, { data: dados }] = await Promise.all([
    supabase.rpc("regalos_que_me_quedan", { p_perfil: perfilId }),
    supabase
      .from("regalos_mazorca")
      .select("a_perfil")
      .eq("de_perfil", perfilId)
      .eq("dia", hoy),
  ]);

  return {
    quedan: Number(quedan ?? 0),
    yaLesDi: new Set((dados ?? []).map((fila) => fila.a_perfil as string)),
  };
}
