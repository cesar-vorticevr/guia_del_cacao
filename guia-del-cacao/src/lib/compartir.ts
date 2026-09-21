import type { Metadata } from "next";

/**
 * La tarjeta que sale al pegar un enlace en Facebook, WhatsApp o X.
 *
 * Son las etiquetas Open Graph. Sin ellas, compartir un micrositio deja el
 * enlace pelón —`guiadelcacao.com/marca/la-mazorca` y nada más— y el negocio
 * que lo compartió parece estar mandando un enlace roto. Con ellas sale el
 * nombre, una línea de qué es y la foto, que es lo que hace que alguien lo
 * abra.
 *
 * Vive en un solo sitio porque son tres páginas las que la necesitan —el
 * micrositio, el evento y la publicación— y las tres tienen que verse igual:
 * lo que se comparte de Guía del Cacao se reconoce como de Guía del Cacao.
 *
 * **La imagen es la del contenido, no una plantilla.** Quien comparte un evento
 * quiere que se vea su cartel. Solo cuando no hay ninguna se cae al logotipo,
 * que al menos dice de dónde salió el enlace.
 */

export const NOMBRE_DEL_SITIO = "Guía del Cacao";

/**
 * La imagen de respaldo.
 *
 * Es el logotipo, que es cuadrado; las redes prefieren 1200×630 y lo van a
 * encajar dentro con franjas a los lados. Se asume a sabiendas: una tarjeta con
 * el logotipo en medio se lee como de la plataforma, y lo que no se puede es
 * dejar sin imagen un enlace que alguien está compartiendo.
 */
export const IMAGEN_DE_RESPALDO = "/marca/logotipo.png";

/**
 * Cuánto texto cabe en la descripción de una tarjeta.
 *
 * Facebook enseña unos 200 caracteres y WhatsApp bastante menos. El contenido
 * de una publicación admite 3.000: mandarlos todos no hace la tarjeta más
 * larga, solo pone en la página 2.800 caracteres que nadie va a leer y que la
 * red corta por donde le toque, normalmente a media palabra.
 */
const TOPE_DESCRIPCION = 180;

/** El primer párrafo, en una línea y recortado con puntos suspensivos. */
function comoDescripcion(texto: string | null | undefined) {
  // Los saltos de línea se vuelven espacios: en una tarjeta todo va seguido, y
  // un salto crudo deja un hueco raro en medio de la frase.
  const limpio = texto?.replace(/\s+/g, " ").trim();
  if (!limpio) return undefined;
  if (limpio.length <= TOPE_DESCRIPCION) return limpio;

  // Se corta en el último espacio para no partir una palabra por la mitad.
  const recorte = limpio.slice(0, TOPE_DESCRIPCION);
  const hastaElEspacio = recorte.slice(0, recorte.lastIndexOf(" "));

  return `${(hastaElEspacio || recorte).trimEnd()}…`;
}

export function tarjetaSocial({
  titulo,
  descripcion,
  imagen,
  ruta,
  tipo = "website",
}: {
  /** Sin el sufijo del sitio: aquí se le pone. */
  titulo: string;
  descripcion?: string | null;
  /** URL absoluta de la foto, o null para caer al logotipo. */
  imagen?: string | null;
  /** Ruta dentro del sitio, con la barra del principio. */
  ruta: string;
  /** `article` para lo que tiene fecha y autor; `website` para lo demás. */
  tipo?: "website" | "article";
}): Metadata {
  const completo = `${titulo} · ${NOMBRE_DEL_SITIO}`;
  const texto = comoDescripcion(descripcion);
  const foto = imagen ?? IMAGEN_DE_RESPALDO;

  return {
    title: completo,
    description: texto,
    /*
      `alternates.canonical` además de `openGraph.url`: cuando alguien comparte
      el enlace con parámetros pegados —el `?nueva=1` del festejo, o lo que le
      añada la red social al pasar por su redirección— las dos apuntan a la
      misma dirección limpia y no se cuentan como páginas distintas.
    */
    alternates: { canonical: ruta },
    openGraph: {
      type: tipo,
      title: completo,
      description: texto,
      url: ruta,
      siteName: NOMBRE_DEL_SITIO,
      locale: "es_MX",
      images: [{ url: foto }],
    },
    /*
      `summary_large_image` y no `summary`: la primera enseña la foto a lo ancho
      y la segunda la deja en un cuadrito al lado del texto. Lo que se comparte
      aquí es casi siempre una foto —un cartel, un producto, una fachada— y en
      miniatura no se ve nada.
    */
    twitter: {
      card: "summary_large_image",
      title: completo,
      description: texto,
      images: [foto],
    },
  };
}
