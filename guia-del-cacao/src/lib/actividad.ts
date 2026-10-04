/**
 * Lo que se mide en la guía (migración 000052). La lista es la misma que el
 * `check` de `public.actividad`: si se agrega un tipo, se agrega en los dos.
 *
 * Solo conteos: nada de lo que viaja dice quién fue.
 */
export const TIPOS_DE_ACTIVIDAD = [
  "vista_pagina",
  "vista_micrositio",
  "vista_evento",
  "busqueda",
  "filtro",
  "whatsapp",
  "telefono",
  "correo",
  "mapa",
  "red",
  "compartir",
  "catalogo_pdf",
] as const;

export type TipoDeActividad = (typeof TIPOS_DE_ACTIVIDAD)[number];

export function esTipoDeActividad(valor: unknown): valor is TipoDeActividad {
  return (
    typeof valor === "string" &&
    (TIPOS_DE_ACTIVIDAD as readonly string[]).includes(valor)
  );
}

export type Anotacion = {
  tipo: TipoDeActividad;
  sucursal?: string;
  evento?: string;
  detalle?: string;
};

/**
 * Manda una anotación sin esperar respuesta.
 *
 * `sendBeacon` y no `fetch`: un clic en WhatsApp o en Maps saca a la persona
 * de la página, y una petición normal se cancela al salir. El faro la entrega
 * aunque la pestaña ya se esté yendo.
 */
export function anotar(anotacion: Anotacion) {
  if (typeof navigator === "undefined") return;

  const cuerpo = JSON.stringify(anotacion);

  try {
    if (navigator.sendBeacon?.("/api/actividad", new Blob([cuerpo], { type: "application/json" }))) {
      return;
    }
  } catch {
    // Sin faro, se intenta con fetch.
  }

  void fetch("/api/actividad", {
    method: "POST",
    body: cuerpo,
    headers: { "Content-Type": "application/json" },
    keepalive: true,
  }).catch(() => {});
}

/** Qué se anota al pulsar cada dato de contacto de `listaDeContacto`. */
export function tipoDeContacto(clave: string): Pick<Anotacion, "tipo" | "detalle"> {
  if (clave === "maps") return { tipo: "mapa" };
  if (clave === "whatsapp" || clave === "telefono" || clave === "correo") {
    return { tipo: clave };
  }
  return { tipo: "red", detalle: clave };
}
