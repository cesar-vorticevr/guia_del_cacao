/**
 * El encuadre de una foto: cuánto se acercó y hacia dónde se movió.
 *
 * Hasta ahora la plataforma recortaba sola, centrando: lo que sobresalía del
 * marco se perdía por los lados o por arriba, y la única salida que se le daba
 * a quien subía un cartel vertical era «recórtala antes de subirla». Eso es
 * pedirle a alguien que abra otra aplicación para poder usar esta.
 *
 * Aquí vive la aritmética de ese encuadre, aparte de la pantalla que lo mueve,
 * porque son dos cosas distintas: una se comprueba con números y la otra se
 * comprueba con el dedo.
 *
 * **Todo se mide en unidades de marco, no en píxeles.** `x` es el
 * desplazamiento del centro de la foto respecto del centro del marco, contado
 * en anchos de marco; `y` lo mismo en altos. Así el encuadre significa lo mismo
 * en un teléfono de 360 px que en un escritorio de 1400, y girar la pantalla a
 * media faena no lo descuadra. Los píxeles solo aparecen al final, cuando hay
 * que decirle al lienzo qué trozo copiar.
 */
export type Encuadre = { escala: number; x: number; y: number };

/** Ancho y alto de algo, en las unidades que toque. */
export type Medidas = { ancho: number; alto: number };

/** Como llega: cubriendo el marco, centrada, sin acercar. */
export const ENCUADRE_CENTRADO: Encuadre = { escala: 1, x: 0, y: 0 };

/**
 * Lo más que se deja acercar.
 *
 * Cuatro veces es donde una foto de celular todavía tiene píxeles que enseñar.
 * Más allá se ve el pixelado y el recorte sale peor que la foto entera, así que
 * el tope no es un capricho: es lo que impide entregar algo borroso.
 */
export const ACERCAMIENTO_MAXIMO = 4;

/**
 * Lo más largo que puede salir el recorte, en píxeles.
 *
 * El recorte se vuelve a codificar de todos modos, así que de paso se baja de
 * tamaño: una foto de celular son 4000 px y varios megas que rozan el tope del
 * bucket, y en la pantalla más grande donde esto se ve no se pintan ni 1600. Lo
 * que se ahorra en la subida lo agradece quien está con datos móviles en una
 * feria.
 */
export const LADO_MAXIMO = 1600;

/**
 * Cuánto ocupa la foto dentro del marco, en unidades de marco.
 *
 * Con escala 1 la foto **cubre** el marco: el lado que sobra se sale y el otro
 * encaja justo. Es la misma regla que `object-fit: cover`, escrita en números
 * para poder recortar después por donde se ve.
 */
export function medidasEnMarco(
  imagen: Medidas,
  proporcion: number,
  escala = 1,
): Medidas {
  const suya = imagen.ancho / imagen.alto;

  return suya > proporcion
    ? { ancho: (suya / proporcion) * escala, alto: escala }
    : { ancho: escala, alto: (proporcion / suya) * escala };
}

/**
 * Devuelve el encuadre metido en sus límites.
 *
 * **Nunca se deja un hueco.** Si se pudiera arrastrar libremente aparecería
 * fondo vacío en una esquina, y ese hueco no existe en el muro: allá la foto
 * cubre. Enseñar aquí algo que allá no se puede dar sería la misma mentira que
 * la vista previa cuadrada que esto vino a arreglar.
 */
export function limitar(
  encuadre: Encuadre,
  imagen: Medidas,
  proporcion: number,
): Encuadre {
  const escala = Math.min(ACERCAMIENTO_MAXIMO, Math.max(1, encuadre.escala));

  const { ancho, alto } = medidasEnMarco(imagen, proporcion, escala);

  const topeX = Math.max(0, (ancho - 1) / 2);
  const topeY = Math.max(0, (alto - 1) / 2);

  return {
    escala,
    x: Math.min(topeX, Math.max(-topeX, encuadre.x)),
    y: Math.min(topeY, Math.max(-topeY, encuadre.y)),
  };
}

/** Mueve el encuadre, en unidades de marco, y lo deja dentro de sus límites. */
export function mover(
  encuadre: Encuadre,
  paso: { x: number; y: number },
  imagen: Medidas,
  proporcion: number,
): Encuadre {
  return limitar(
    { escala: encuadre.escala, x: encuadre.x + paso.x, y: encuadre.y + paso.y },
    imagen,
    proporcion,
  );
}

/**
 * Acerca o aleja **sujetando un punto**: el que está bajo los dedos, o bajo el
 * puntero, se queda donde está.
 *
 * Sin esto el zoom sale siempre del centro del marco, y quien está afinando una
 * cara que quedó en una esquina la ve escaparse a cada pellizco. `foco` viene
 * en unidades de marco medidas desde el centro, igual que `x` e `y`.
 *
 * La escala se recorta **antes** de calcular el desplazamiento: si se hiciera
 * después, al llegar al tope el punto sujetado se movería solo.
 */
export function acercar(
  encuadre: Encuadre,
  factor: number,
  foco: { x: number; y: number },
  imagen: Medidas,
  proporcion: number,
): Encuadre {
  const escala = Math.min(
    ACERCAMIENTO_MAXIMO,
    Math.max(1, encuadre.escala * factor),
  );

  const real = escala / encuadre.escala;

  return limitar(
    {
      escala,
      x: foco.x * (1 - real) + real * encuadre.x,
      y: foco.y * (1 - real) + real * encuadre.y,
    },
    imagen,
    proporcion,
  );
}

/**
 * Qué trozo de la foto original queda dentro del marco, en píxeles de la foto.
 *
 * Es la traducción final: hasta aquí todo iba en unidades de marco, y el lienzo
 * solo entiende píxeles del archivo.
 */
export function region(imagen: Medidas, encuadre: Encuadre, proporcion: number) {
  const { ancho, alto } = medidasEnMarco(imagen, proporcion, encuadre.escala);

  return {
    x: (imagen.ancho * (ancho / 2 - 0.5 - encuadre.x)) / ancho,
    y: (imagen.alto * (alto / 2 - 0.5 - encuadre.y)) / alto,
    ancho: imagen.ancho / ancho,
    alto: imagen.alto / alto,
  };
}

/**
 * El nombre con la extensión que le toca al formato que salió del lienzo.
 *
 * Hace falta porque las acciones del servidor arman la ruta del bucket con la
 * extensión del nombre (`archivo.name.split(".").pop()`). Un recorte en WebP
 * guardado como `.jpg` se sube igual y se ve igual, pero deja el bucket
 * mintiendo sobre lo que tiene dentro — y `esVideo()`, que también mira la
 * extensión, se guía por esos mismos nombres.
 */
function conExtension(nombre: string, tipo: string) {
  const extensiones: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };

  const extension = extensiones[tipo] ?? "jpg";
  const sinExtension = nombre.replace(/\.[^.]+$/, "") || "foto";

  return `${sinExtension}.${extension}`;
}

/**
 * Corta la foto por donde dice el encuadre y devuelve un archivo nuevo.
 *
 * Sale en WebP salvo que entrara en JPG, y no al revés: convertir un PNG a JPG
 * le quita la transparencia, y el PNG transparente es justo lo que sube quien
 * tiene un logo bien hecho. WebP conserva el canal alfa y pesa menos que los
 * dos.
 *
 * Si algo falla —un lienzo que el navegador no da, un `toBlob` que vuelve
 * vacío— se devuelve el archivo original tal cual. Quedarse sin foto por no
 * haber podido recortarla sería cambiar una molestia por una pérdida: el
 * servidor la recortará centrada, que es exactamente lo que hacía antes.
 */
export async function recortar(
  foto: HTMLImageElement,
  encuadre: Encuadre,
  proporcion: number,
  archivo: File,
  ladoMaximo = LADO_MAXIMO,
): Promise<File> {
  const imagen = { ancho: foto.naturalWidth, alto: foto.naturalHeight };

  if (!imagen.ancho || !imagen.alto) return archivo;

  const recorte = region(imagen, encuadre, proporcion);

  const factor = Math.min(1, ladoMaximo / Math.max(recorte.ancho, recorte.alto));

  const ancho = Math.max(1, Math.round(recorte.ancho * factor));
  const alto = Math.max(1, Math.round(ancho / proporcion));

  const lienzo = document.createElement("canvas");
  lienzo.width = ancho;
  lienzo.height = alto;

  const pincel = lienzo.getContext("2d");
  if (!pincel) return archivo;

  pincel.imageSmoothingQuality = "high";
  pincel.drawImage(
    foto,
    recorte.x,
    recorte.y,
    recorte.ancho,
    recorte.alto,
    0,
    0,
    ancho,
    alto,
  );

  const tipo = archivo.type === "image/jpeg" ? "image/jpeg" : "image/webp";

  const trozo = await new Promise<Blob | null>((listo) =>
    lienzo.toBlob(listo, tipo, tipo === "image/jpeg" ? 0.9 : 0.92),
  );

  if (!trozo) return archivo;

  return new File([trozo], conExtension(archivo.name, trozo.type), {
    type: trozo.type,
    lastModified: Date.now(),
  });
}

/**
 * Deja estos archivos dentro de un `<input type="file">`.
 *
 * Un campo de archivo no se puede rellenar escribiéndole el valor —lo prohíbe
 * el navegador, y con razón—, pero sí aceptando una `FileList` armada con
 * `DataTransfer`. Es la única forma de que el recorte viaje en el envío normal
 * del formulario, sin montar una subida aparte por detrás.
 */
export function ponerEnCampo(campo: HTMLInputElement, archivos: File[]) {
  const deposito = new DataTransfer();
  archivos.forEach((archivo) => deposito.items.add(archivo));
  campo.files = deposito.files;
}

/** Una foto se puede encuadrar; un video no, aquí no hay nada que lo recorte. */
export function sePuedeEncuadrar(archivo: File) {
  return archivo.type.startsWith("image/");
}
