/**
 * Adjuntos del buzón (migración 000072): una imagen, un video o un PDF por
 * mensaje, en el bucket privado `buzon`.
 *
 * Los topes están dos veces: aquí, para decirlo antes de subir, y en
 * `public.tope_de_adjunto`, que es la que manda. Si cambia uno, cambian los dos.
 */
export const BUCKET_BUZON = "buzon";

export type TipoDeAdjunto = "imagen" | "video" | "pdf";

const MB = 1024 * 1024;

export const TOPES_DE_ADJUNTO: Record<TipoDeAdjunto, number> = {
  imagen: 5 * MB,
  pdf: 10 * MB,
  video: 20 * MB,
};

/** Lo que acepta el campo de archivo, igual que `allowed_mime_types` del bucket. */
export const ACEPTA_ADJUNTO = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "application/pdf",
].join(",");

export const AYUDA_DE_ADJUNTO = "Imagen hasta 5 MB, PDF hasta 10 MB, video hasta 20 MB.";

export function tipoDeAdjunto(mime: string): TipoDeAdjunto | null {
  if (!ACEPTA_ADJUNTO.split(",").includes(mime)) return null;
  if (mime.startsWith("image/")) return "imagen";
  if (mime.startsWith("video/")) return "video";
  return "pdf";
}

/** «1.4 MB», «320 KB». */
export function pesoLegible(bytes: number) {
  return bytes >= MB ? `${(bytes / MB).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Qué está mal con este archivo, o null si se puede mandar. */
export function revisarAdjunto(archivo: File): string | null {
  const tipo = tipoDeAdjunto(archivo.type);
  if (!tipo) return "Solo se mandan imágenes, videos o PDF.";

  if (archivo.size > TOPES_DE_ADJUNTO[tipo]) {
    const nombre = tipo === "imagen" ? "Una imagen" : tipo === "pdf" ? "Un PDF" : "Un video";
    return `${nombre} va hasta ${pesoLegible(TOPES_DE_ADJUNTO[tipo])} y este pesa ${pesoLegible(archivo.size)}.`;
  }

  return null;
}
