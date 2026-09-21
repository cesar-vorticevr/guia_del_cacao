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

/**
 * Un dato de contacto: cómo se llama, qué dice y a dónde lleva.
 *
 * El `texto` es **el dato**, no una invitación a pulsarlo. Un botón que dice
 * "Correo" esconde justo lo que se viene a buscar: quien mira el micrositio en
 * la computadora quiere copiar la dirección para escribirle desde su correo de
 * siempre, y quien lo imprime necesita algo que se pueda teclear. `mailto:` no
 * sirve para ninguna de las dos.
 */
export type DatoDeContacto = {
  /** Cuál es, para quien quiera tratarlos distinto. `maps` no tiene dato legible. */
  clave: "maps" | "telefono" | "correo" | CampoDeRed;
  etiqueta: string;
  /** El dato como lo escribiría una persona: el número, el correo, `@lamazorca`. */
  texto: string;
  /** A dónde lleva al pulsarlo. */
  enlace: string;
};

/** Una dirección sin `https://` ni `www.` ni barra final: lo que se teclea. */
function legible(url: string) {
  return url.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, "");
}

/**
 * Cómo se enseña una red: `@lamazorca` cuando se puede, la dirección cuando no.
 *
 * Son dos cosas distintas: `instagram.com/lamazorca` es a dónde va el botón, y
 * `@lamazorca` es como se llama esa cuenta en boca de cualquiera. Lo segundo se
 * lee de un vistazo, se dicta por teléfono y cabe en una tarjeta.
 *
 * Sale del **enlace ya armado** y no de lo que el negocio escribió, para que
 * los cuatro modos de poner lo mismo —`@lamazorca`, `lamazorca`,
 * `instagram.com/lamazorca` y la dirección entera— se lean igual. Escrito
 * sobre el campo crudo, quien tecleó el dominio se quedaba viendo el dominio y
 * su vecino veía el arroba, por haber escrito distinto la misma cuenta.
 *
 * Una ruta más honda (`facebook.com/pages/la-mazorca/123`) o un dominio ajeno
 * (`fb.me/…`) se enseñan tal cual: ahí no hay un usuario que sacar, y recortarlo
 * a un arroba inventaría una cuenta que no existe.
 */
function comoSeLee(valor: string, enlace: string, dominio: string | undefined) {
  // Sin dominio es WhatsApp, que no lleva usuario sino número. Se enseña el
  // número tal como lo escribió el negocio: `wa.me/5299311000002` no se lo
  // dicta nadie a nadie, y el 52 que le pone `enlaceDeRed` es del enlace, no
  // de cómo se llama ese teléfono en Tabasco.
  if (!dominio) return valor.trim();

  const prefijo = `https://${dominio}/`;
  if (!enlace.startsWith(prefijo)) return legible(enlace);

  const resto = enlace.slice(prefijo.length);
  if (!resto || resto.includes("/")) return legible(enlace);

  return `@${resto.replace(/^@/, "")}`;
}

/**
 * Los datos de contacto de una sucursal, en el orden en que se enseñan.
 *
 * Una sola lista para las dos salidas —la sección del micrositio y el bloque
 * del PDF— para que no puedan discrepar. Antes la pantalla armaba sus botones
 * a mano y acabó enseñando el teléfono pero no el correo ni el número de
 * WhatsApp: cada uno se había escrito por separado y nadie los vio juntos.
 *
 * Los enlaces salen de `enlaceDeRed`, así que lo que no dé una dirección que se
 * pueda abrir tampoco sale aquí: un campo con "@" a secas no deja un renglón
 * vacío con su etiqueta.
 */
export function listaDeContacto(sucursal: {
  ubicacion_maps_url?: string | null;
  telefono?: string | null;
  correo_contacto?: string | null;
  whatsapp?: string | null;
  facebook?: string | null;
  instagram?: string | null;
  youtube?: string | null;
  tiktok?: string | null;
}): DatoDeContacto[] {
  const lista: DatoDeContacto[] = [];

  // El mismo cuidado que en `enlaceDeRed`: un campo de texto libre que acaba
  // de `href` acepta `javascript:`, y este además se imprime como dirección.
  const mapa = sucursal.ubicacion_maps_url?.trim();
  if (mapa && /^https?:\/\//i.test(mapa)) {
    lista.push({
      clave: "maps",
      etiqueta: "Cómo llegar",
      texto: legible(mapa),
      enlace: mapa,
    });
  }

  const telefono = sucursal.telefono?.trim();
  if (telefono) {
    lista.push({
      clave: "telefono",
      etiqueta: "Teléfono",
      texto: telefono,
      // El `href` va sin espacios ni guiones aunque el negocio los escriba:
      // `tel:993 100 0014` no marca en todos los teléfonos.
      enlace: `tel:${telefono.replace(/[^\d+]/g, "")}`,
    });
  }

  const correo = sucursal.correo_contacto?.trim();
  if (correo) {
    lista.push({
      clave: "correo",
      etiqueta: "Correo",
      texto: correo,
      enlace: `mailto:${correo}`,
    });
  }

  for (const red of REDES) {
    const valor = sucursal[red.campo];
    const enlace = enlaceDeRed(red.campo, valor);
    if (!enlace || !valor) continue;

    lista.push({
      clave: red.campo,
      etiqueta: red.texto,
      texto: comoSeLee(valor, enlace, red.dominio),
      enlace,
    });
  }

  return lista;
}
