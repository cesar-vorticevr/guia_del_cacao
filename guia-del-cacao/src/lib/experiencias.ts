/**
 * Experiencias de realidad aumentada (migración 000066), powered by Vórtice VR.
 *
 * El editor y el visor son los de vorticevr.mx portados: los elementos se
 * guardan con el mismo formato que `public/ra/escena.js` sabe pintar, así que
 * lo que se acomoda en el panel es lo que se ve en el celular.
 *
 * Esto es lo que comparten el servidor y el navegador: nombres, límites y
 * rutas. Se puede importar desde los dos lados.
 */

/** El bucket donde viven la imagen, el objetivo (.mind) y lo que va encima. */
export const BUCKET_EXPERIENCIAS = "experiencias";

/** Precio de una experiencia más, de un solo pago. La mensualidad no cambia. */
export const PRECIO_EXPERIENCIA_EXTRA = 499;

/** Límites del editor (los mismos que el plan Pro de Vórtice VR). */
export const LIMITES = {
  elementos: 12,
  videos: 2,
  videoMB: 50,
  imagenMB: 5,
  /** La imagen que se enfoca se reduce a este lado mayor antes de compilarla. */
  imagenLado: 1000,
} as const;

/** La plataforma que hace la realidad aumentada, para el «Powered by». */
export const VORTICE_VR = {
  nombre: "Vórtice VR",
  url: "https://vorticevr.mx/?utm_source=guia-del-cacao&utm_medium=panel",
};

export type TipoDeElemento = "video" | "image" | "text";

/**
 * Un elemento sobre la imagen. Las unidades son las de la imagen: mide 1 de
 * ancho y está centrada en 0,0 (ver la cabecera de `public/ra/escena.js`).
 * Las claves con `_` solo viven en el navegador mientras se edita.
 */
export type Elemento = {
  id: string;
  type: TipoDeElemento;
  x: number;
  y: number;
  z: number;
  s: number;
  rx: number;
  ry: number;
  rz: number;
  in: string;
  scene: number;
  name?: string;
  /** Nombre del archivo dentro de la carpeta de la experiencia. */
  file?: string;
  bytes?: number;
  w?: number;
  h?: number;
  link?: string;
  // video
  sound?: boolean;
  chroma?: { color: string; tol: number } | null;
  // texto
  text?: string;
  font?: string;
  color?: string;
  stroke?: string;
};

export type Botones = Partial<Record<"whatsapp" | "facebook" | "instagram" | "tiktok" | "web", string>>;

export type Experiencia = {
  id: string;
  marcaId: string;
  codigo: string;
  titulo: string;
  estado: "borrador" | "publicada";
  imagen: string | null;
  objetivo: string | null;
  imagenAncho: number | null;
  imagenAlto: number | null;
  elementos: Elemento[];
  botones: Botones;
  vistas: number;
  publicadaEn: string | null;
  actualizadaEn: string;
};

/** La URL pública de un archivo del bucket. */
export function urlDeArchivo(ruta: string | null | undefined) {
  if (!ruta) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET_EXPERIENCIAS}/${ruta}`;
}

/** La carpeta de una experiencia dentro del bucket: `{marca}/{experiencia}`. */
export function carpetaDe(marcaId: string, experienciaId: string) {
  return `${marcaId}/${experienciaId}`;
}

/** El link que se comparte y lleva el QR. */
export function linkDe(origen: string, codigo: string) {
  return `${origen}/ra/${codigo}`;
}

/** Un código corto y difícil de adivinar: 8 letras y números sin los que se confunden. */
export function codigoNuevo() {
  const letras = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => letras[b % letras.length]).join("");
}

/** De la fila de la base al tipo de la aplicación. */
export function experienciaDeFila(fila: Record<string, unknown>): Experiencia {
  return {
    id: fila.id as string,
    marcaId: fila.marca_id as string,
    codigo: fila.codigo as string,
    titulo: (fila.titulo as string) ?? "",
    estado: fila.estado as Experiencia["estado"],
    imagen: (fila.imagen as string | null) ?? null,
    objetivo: (fila.objetivo as string | null) ?? null,
    imagenAncho: (fila.imagen_ancho as number | null) ?? null,
    imagenAlto: (fila.imagen_alto as number | null) ?? null,
    elementos: (fila.elementos as Elemento[]) ?? [],
    botones: (fila.botones as Botones) ?? {},
    vistas: Number(fila.vistas ?? 0),
    publicadaEn: (fila.publicada_en as string | null) ?? null,
    actualizadaEn: fila.actualizada_en as string,
  };
}

/**
 * Lo que se guarda de un elemento: sin las claves de trabajo del navegador
 * (`_file`, `_url`…) y con los números redondeados.
 */
export function limpiarElementos(lista: unknown): Elemento[] {
  if (!Array.isArray(lista)) return [];
  const num = (v: unknown, def = 0, min = -10, max = 10) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n * 1000) / 1000)) : def;
  };
  const texto = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : undefined);

  return lista
    .filter((it): it is Record<string, unknown> => Boolean(it) && typeof it === "object")
    .filter((it) => it.type === "video" || it.type === "image" || it.type === "text")
    .slice(0, LIMITES.elementos)
    .map((it) => {
      const base: Elemento = {
        id: String(it.id ?? "").replace(/[^a-z0-9]/gi, "").slice(0, 20) || codigoNuevo(),
        type: it.type as TipoDeElemento,
        x: num(it.x, 0, -2, 2),
        y: num(it.y, 0, -2, 2),
        z: num(it.z, 0, -1, 2),
        s: num(it.s, 0.6, 0.02, 4),
        rx: num(it.rx, 0, -180, 180),
        ry: num(it.ry, 0, -180, 180),
        rz: num(it.rz, 0, -180, 180),
        in: ["aparecer", "crecer", "rebote", "girar", "subir", "ninguna"].includes(String(it.in))
          ? String(it.in)
          : "aparecer",
        scene: 0,
      };
      const link = texto(it.link, 300);
      if (link && /^https:\/\//.test(link)) base.link = link;
      if (it.type === "text") {
        base.text = texto(it.text, 200) ?? "Tu texto";
        base.font = texto(it.font, 40);
        base.color = /^#[0-9a-f]{6}$/i.test(String(it.color)) ? String(it.color) : "#ffffff";
        if (/^#[0-9a-f]{6}$/i.test(String(it.stroke))) base.stroke = String(it.stroke);
      } else {
        base.file = texto(it.file, 80)?.replace(/[^a-z0-9._-]/gi, "");
        base.name = texto(it.name, 80);
        base.bytes = num(it.bytes, 0, 0, 1e9);
        base.w = num(it.w, 0, 0, 10000);
        base.h = num(it.h, 0, 0, 10000);
      }
      if (it.type === "video") {
        base.sound = Boolean(it.sound);
        const chroma = it.chroma as { color?: unknown; tol?: unknown } | null;
        base.chroma =
          chroma && /^#[0-9a-f]{6}$/i.test(String(chroma.color))
            ? { color: String(chroma.color), tol: num(chroma.tol, 0.3, 0.05, 0.9) }
            : null;
      }
      return base;
    })
    .filter((it) => it.type === "text" || it.file);
}

/** Los botones que se guardan: solo los que tienen algo y con su forma. */
export function limpiarBotones(datos: Record<string, unknown>): Botones {
  const botones: Botones = {};
  const wa = String(datos.whatsapp ?? "").replace(/\D/g, "");
  if (wa.length >= 10) botones.whatsapp = wa.length === 10 ? `52${wa}` : wa.slice(0, 15);
  // Una red se puede escribir como usuario («@cacao») o como dirección.
  const dominio = { facebook: "facebook.com/", instagram: "instagram.com/", tiktok: "tiktok.com/@", web: "" };
  for (const red of ["facebook", "instagram", "tiktok", "web"] as const) {
    const v = String(datos[red] ?? "").trim();
    if (!v) continue;
    const url = /^https?:\/\//.test(v)
      ? v
      : red !== "web" && !v.includes(".")
        ? `https://${dominio[red]}${v.replace(/^@/, "")}`
        : `https://${v.replace(/^@/, "")}`;
    try {
      botones[red] = new URL(url).toString().slice(0, 300);
    } catch {
      // Lo que no es una dirección se ignora: el botón no llevaría a nada.
    }
  }
  return botones;
}
