/**
 * Las redes de un negocio: cómo se piden y cómo se convierten en enlace.
 *
 * El formulario acepta **lo que la gente tiene a mano**, que es el usuario
 * (`@lamazorca`) y no la dirección completa. Nadie se sabe de memoria
 * `https://www.instagram.com/lamazorca/`; se copia del navegador cuando se
 * acuerda, y si no, se escribe el arroba.
 *
 * Eso obliga a armar el enlace aquí. Antes el micrositio usaba el valor tal
 * cual como `href`: quien ponía `@lamazorca` quedaba con un enlace a
 * `guiadelcacao.mx/marca/la-mazorca/@lamazorca`, una página que no existe, y el
 * negocio no tenía forma de saber por qué su Instagram no llevaba a ningún
 * sitio.
 *
 * Y de paso cierra un agujero: un `href` copiado del formulario sin mirar
 * acepta `javascript:…`. Aquí solo salen enlaces `https:`, así que lo que se
 * escriba en ese campo no puede ejecutarse en el navegador de quien visita.
 */

/** La columna de `sucursales` donde vive cada red. */
export type CampoDeRed =
  | "whatsapp"
  | "facebook"
  | "instagram"
  | "youtube"
  | "tiktok";

type Red = {
  campo: CampoDeRed;
  texto: string;
  /** Lo que se enseña en gris dentro del campo vacío. */
  marcador: string;
  ayuda?: string;
  /** Sin dominio es WhatsApp, que no lleva usuario sino número. */
  dominio?: string;
  /** El usuario va con arroba en la dirección (YouTube y TikTok). */
  arroba?: boolean;
};

/** Lo que hay que saber de cada red para pedirla y para armar su enlace. */
export const REDES: readonly Red[] = [
  {
    campo: "whatsapp",
    texto: "WhatsApp",
    marcador: "993 123 4567",
    ayuda: "Solo el número. Si es de México no hace falta la lada del país.",
  },
  { campo: "facebook", texto: "Facebook", dominio: "facebook.com", marcador: "@lamazorca" },
  { campo: "instagram", texto: "Instagram", dominio: "instagram.com", marcador: "@lamazorca" },
  {
    campo: "youtube",
    texto: "YouTube",
    dominio: "youtube.com",
    // YouTube reparte los canales entre `/@nombre`, `/c/nombre` y
    // `/channel/UC…`, así que el arroba se pone solo cuando no viene ya una
    // ruta armada.
    arroba: true,
    marcador: "@lamazorca",
  },
  { campo: "tiktok", texto: "TikTok", dominio: "tiktok.com", arroba: true, marcador: "@lamazorca" },
];

/**
 * El número de WhatsApp, listo para `wa.me`.
 *
 * `wa.me` exige el número internacional completo, sin signos. Diez dígitos es
 * un número mexicano escrito como se escribe aquí, así que se le pone el 52
 * delante: sin eso, `wa.me/9931234567` abre una conversación con nadie, y el
 * negocio ve el botón funcionando.
 */
function paraWhatsApp(valor: string) {
  const digitos = valor.replace(/\D/g, "");
  if (digitos.length < 10) return null;
  return digitos.length === 10 ? `52${digitos}` : digitos;
}

/** La red cuyo `campo` es este, o `undefined` si no es una red. */
function redDe(campo: string) {
  return REDES.find((red) => red.campo === campo);
}

/**
 * El enlace de una red a partir de lo que el negocio escribió, o `null` si de
 * ahí no sale nada que se pueda abrir.
 *
 * Aguanta las cuatro formas en que llega lo mismo: `@lamazorca`, `lamazorca`,
 * `instagram.com/lamazorca` y la dirección completa con `https` y barra final.
 */
export function enlaceDeRed(campo: string, valor: string | null | undefined) {
  const limpio = valor?.trim();
  if (!limpio) return null;

  const red = redDe(campo);
  if (!red) return null;

  if (!red.dominio) {
    const numero = paraWhatsApp(limpio);
    return numero && `https://wa.me/${numero}`;
  }

  // Una dirección completa se respeta tal cual —puede apuntar a una página con
  // su propia ruta—, pero solo si es web: `javascript:` y `data:` no pasan.
  if (/^https?:\/\//i.test(limpio)) return limpio;

  /*
    Lo que queda es un usuario, con o sin adornos. Se le quita el arroba, el
    dominio si lo trajo pegado y las barras de los extremos, y lo que sobrevive
    es el nombre. Si no sobrevive nada —alguien dejó un "@" solo— no hay enlace
    que dar.
  */
  const usuario = limpio
    .replace(/^@/, "")
    .replace(/^(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+\.[a-z.]+\//i, "")
    .replace(/^\/+|\/+$/g, "")
    .trim();

  if (!usuario) return null;

  const arroba = red.arroba && !usuario.includes("/") ? "@" : "";

  return `https://${red.dominio}/${arroba}${usuario}`;
}
