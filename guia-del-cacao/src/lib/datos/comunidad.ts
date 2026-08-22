import { crearClienteServidor } from "@/lib/supabase/server";
import { listarTemas } from "@/lib/datos/foro";
import { listarEventos, listarNoticias, nombrarNegocio } from "@/lib/datos/publico";
import { urlImagen } from "@/lib/imagenes";

/**
 * Un solo muro para todo lo que pasa fuera de los micrositios: los temas del
 * foro, los eventos y las noticias.
 *
 * Estaban en tres pantallas distintas y ninguna se visitaba: para enterarte de
 * algo tenías que acordarte de ir a buscarlo. Juntarlas en un muro ordenado por
 * fecha, con un filtro arriba, convierte tres destinos olvidados en uno solo
 * que sí vale la pena abrir.
 *
 * Las tres clases se aplanan a la misma forma para poder mezclarlas y
 * ordenarlas. Lo que las distingue —a dónde llevan, quién las firma, si tienen
 * apoyos— viaja en los campos, no en tres componentes distintos.
 */

export type Clase = "tema" | "evento" | "noticia";

export type Entrada = {
  clase: Clase;
  id: string;
  href: string;
  titulo: string;
  resumen: string;
  /** ISO, solo para ordenar. Lo que se enseña es `fechaTexto`. */
  fecha: string;
  fechaTexto: string;
  /** Quién lo firma: la marca, o la persona en el caso de un tema. */
  autor: string;
  /** La sucursal, cuando la hay. Va debajo y en chico. */
  detalle: string | null;
  imagen: string | null;
  comentarios: number;
  /** Solo en temas. */
  apoyos: number | null;
  /** Solo en eventos: el rango al que está reservado, si lo está. */
  rangoExclusivo: number | null;
};

const CUANDO = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** Cuántos comentarios tiene cada evento o noticia, de un jalón. */
async function comentariosPorPublicacion(
  columna: "evento_id" | "noticia_id",
  ids: string[],
) {
  if (ids.length === 0) return new Map<string, number>();

  const supabase = await crearClienteServidor();

  // Se traen los renglones y se cuentan aquí porque PostgREST no agrupa. Son
  // los comentarios de lo que cabe en un muro, no de toda la historia.
  const { data } = await supabase
    .from("comentarios_publicacion")
    .select(columna)
    .in(columna, ids);

  const cuenta = new Map<string, number>();

  for (const fila of data ?? []) {
    const id = (fila as Record<string, string>)[columna];
    cuenta.set(id, (cuenta.get(id) ?? 0) + 1);
  }

  return cuenta;
}

export async function muroDeComunidad(): Promise<Entrada[]> {
  const [temas, eventos, noticias] = await Promise.all([
    listarTemas(),
    listarEventos(),
    listarNoticias(),
  ]);

  // Los eventos que ya pasaron no entran al muro: es lo que está por venir.
  const proximos = eventos.proximos;

  const [comentariosDeEventos, comentariosDeNoticias] = await Promise.all([
    comentariosPorPublicacion(
      "evento_id",
      proximos.map((e) => e.id),
    ),
    comentariosPorPublicacion(
      "noticia_id",
      noticias.map((n) => n.id),
    ),
  ]);

  const entradas: Entrada[] = [
    ...temas.map((tema) => ({
      clase: "tema" as const,
      id: tema.id,
      href: `/comunidad/tema/${tema.id}`,
      titulo: tema.titulo,
      resumen: tema.contenido,
      fecha: tema.fecha,
      fechaTexto: CUANDO.format(new Date(tema.fecha)),
      autor: tema.perfiles_publicos?.nombre ?? "Alguien",
      detalle: null,
      imagen: null,
      comentarios: tema.comentarios,
      apoyos: tema.apoyos,
      rangoExclusivo: null,
    })),

    ...proximos.map((evento) => {
      const { marca, sucursal } = nombrarNegocio(evento.sucursales);

      return {
        clase: "evento" as const,
        id: evento.id,
        href: `/eventos/${evento.id}`,
        titulo: evento.titulo,
        resumen: evento.subtitulo ?? evento.contenido,
        // Un evento se ordena por cuándo ocurre, no por cuándo se anunció.
        fecha: evento.fecha_evento!,
        fechaTexto: CUANDO.format(new Date(evento.fecha_evento!)),
        autor: marca ?? "Un negocio",
        detalle: sucursal,
        imagen: urlImagen(evento.imagenes?.[0]),
        comentarios: comentariosDeEventos.get(evento.id) ?? 0,
        apoyos: null,
        rangoExclusivo: evento.rango_exclusivo ?? null,
      };
    }),

    ...noticias.map((noticia) => {
      const { marca, sucursal } = nombrarNegocio(noticia.sucursales);

      return {
        clase: "noticia" as const,
        id: noticia.id,
        href: `/noticias/${noticia.id}`,
        titulo: noticia.titulo,
        resumen: noticia.subtitulo ?? noticia.contenido,
        fecha: noticia.fecha_publicacion,
        fechaTexto: CUANDO.format(new Date(noticia.fecha_publicacion)),
        autor: marca ?? "Un negocio",
        detalle: sucursal,
        imagen: urlImagen(noticia.imagenes?.[0]),
        comentarios: comentariosDeNoticias.get(noticia.id) ?? 0,
        apoyos: null,
        rangoExclusivo: null,
      };
    }),
  ];

  return entradas.sort(
    (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime(),
  );
}
