/**
 * Lo que comparten las cosas que se arman en el navegador y se bajan.
 *
 * Son dos: el cartel del mostrador (`cartel-qr`) y el catálogo en PDF
 * (`catalogo-pdf`). Las dos cargan imágenes ajenas para dibujarlas, las dos
 * tienen que ponerle nombre a un archivo y las dos terminan igual, empujando
 * un blob por un enlace invisible. Estaba escrito una vez y al escribir el
 * segundo iba a quedar escrito dos, así que vive aquí.
 *
 * Nada de esto funciona en el servidor: `Image`, `canvas` y `URL.createObjectURL`
 * son del navegador. Se importa desde componentes `"use client"`.
 */

/**
 * Carga una imagen para dibujarla en el lienzo.
 *
 * `crossOrigin` es obligatorio aunque el bucket ya mande `Access-Control-Allow-Origin`:
 * sin el atributo el navegador no pide permiso, marca el lienzo como contaminado
 * y `toBlob` falla al final, cuando ya no se puede hacer nada. Si la imagen no
 * carga se devuelve `null`, y a quien la pidió le toca decidir qué poner en su
 * lugar: casi siempre salir sin ella es mejor que no salir.
 */
export function cargarImagen(src: string): Promise<HTMLImageElement | null> {
  return new Promise((listo) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => listo(img);
    img.onerror = () => listo(null);
    img.src = src;
  });
}

/**
 * Un texto convertido en algo que Windows y macOS acepten como nombre de archivo.
 *
 * Los acentos se separan de su letra (NFD) y se quitan como marca aparte, en vez
 * de mantener una tabla de equivalencias que siempre olvida alguna.
 */
export function enNombreDeArchivo(texto: string) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Baja un blob con el nombre que se le dé.
 *
 * La URL se libera en el siguiente turno y no de inmediato: revocarla al salir
 * de la función cancela la descarga en algunos navegadores, que todavía no han
 * terminado de leer el blob.
 */
export function bajarBlob(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();

  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Una foto recortada al cuadro y lista para meterse en un PDF.
 *
 * Recorta por el lado largo en vez de deformar —lo mismo que hace `object-cover`
 * en la cuadrícula del micrositio, para que el PDF enseñe el mismo encuadre que
 * la pantalla— y sale en JPEG: un catálogo de treinta productos con las fotos
 * tal como se subieron pesa lo que nadie manda por WhatsApp.
 *
 * El fondo se pinta antes de dibujar porque JPEG no tiene transparencia: sin
 * esto, un PNG recortado sale sobre negro.
 */
export function enCuadroJpeg(
  img: HTMLImageElement,
  lado: number,
  fondo: string,
  calidad = 0.7,
): string | null {
  const lienzo = document.createElement("canvas");
  lienzo.width = lado;
  lienzo.height = lado;

  const ctx = lienzo.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = fondo;
  ctx.fillRect(0, 0, lado, lado);

  const corte = Math.min(img.width, img.height);
  ctx.drawImage(
    img,
    (img.width - corte) / 2,
    (img.height - corte) / 2,
    corte,
    corte,
    0,
    0,
    lado,
    lado,
  );

  return lienzo.toDataURL("image/jpeg", calidad);
}

/**
 * Una imagen encogida, conservando su forma y su transparencia.
 *
 * Es para los logotipos: el de Guía del Cacao pesa 1 MB y el del negocio puede
 * pesar los 5 MB que admite la plataforma. Incrustarlos tal cual haría un PDF
 * de varios megas por dos imágenes que se ven a dos centímetros.
 *
 * Sale en PNG, no en JPEG como las fotos: un logo se recorta contra el fondo
 * que le toque, y aplanarlo contra un color lo deja con un recuadro visible en
 * cuanto ese fondo cambie.
 */
export function encogida(img: HTMLImageElement, lado: number): string | null {
  const escala = Math.min(lado / img.width, lado / img.height, 1);
  const ancho = Math.round(img.width * escala);
  const alto = Math.round(img.height * escala);

  const lienzo = document.createElement("canvas");
  lienzo.width = ancho;
  lienzo.height = alto;

  const ctx = lienzo.getContext("2d");
  if (!ctx) return null;

  ctx.drawImage(img, 0, 0, ancho, alto);

  return lienzo.toDataURL("image/png");
}
