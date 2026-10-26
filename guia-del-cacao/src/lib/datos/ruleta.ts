import { crearClienteServidor } from "@/lib/supabase/server";
import { TEXTO_DE_FRECUENCIA, type Frecuencia } from "@/lib/ruleta/textos";
import type { DatosDelTarjeton } from "@/lib/negocio/tarjeton-pdf";

export { TEXTO_DE_FRECUENCIA, type Frecuencia } from "@/lib/ruleta/textos";

/**
 * Lecturas de la Ruleta Mágica (migración 000060).
 *
 * La ruleta y sus premios son públicos —se pintan en el micrositio—; lo que
 * ganó cada quien, no: eso se lee por funciones de la base que ya filtran por
 * quien pregunta.
 */

export type PremioDeRuleta = {
  orden: number;
  texto: string;
  probabilidad: number;
  /** false: «Suerte para la próxima», que no deja premio. */
  esPremio: boolean;
};

/** Cómo se llenan los gajos que el negocio deja vacíos (migración 000062). */
export type Relleno = "suerte" | "repetir";

export type Ruleta = {
  activa: boolean;
  frecuencia: Frecuencia;
  vigenciaDias: number;
  relleno: Relleno;
  premios: PremioDeRuleta[];
};

/** La ruleta de una sucursal, o null si no tiene. */
export async function ruletaDe(sucursalId: string): Promise<Ruleta | null> {
  const supabase = await crearClienteServidor();
  const [{ data: ruleta }, { data: premios }] = await Promise.all([
    supabase
      .from("ruletas")
      .select("activa, frecuencia, vigencia_dias, relleno")
      .eq("sucursal_id", sucursalId)
      .maybeSingle(),
    supabase
      .from("premios_ruleta")
      .select("orden, texto, probabilidad, es_premio")
      .eq("sucursal_id", sucursalId)
      .order("orden"),
  ]);

  if (!ruleta) return null;

  return {
    activa: ruleta.activa as boolean,
    frecuencia: ruleta.frecuencia as Frecuencia,
    vigenciaDias: Number(ruleta.vigencia_dias),
    relleno: ruleta.relleno as Relleno,
    premios: ((premios ?? []) as { orden: number; texto: string; probabilidad: number; es_premio: boolean }[]).map(
      (p) => ({
        orden: Number(p.orden),
        texto: p.texto,
        probabilidad: Number(p.probabilidad),
        esPremio: p.es_premio,
      }),
    ),
  };
}

/**
 * Los seis gajos que se pintan, ya con su relleno. Salen de la misma función
 * de la base con la que se tira (`gajos_de_ruleta`): la rueda y el premio no
 * pueden contar cosas distintas.
 */
export async function gajosDe(sucursalId: string) {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.rpc("gajos_de_ruleta", { p_sucursal: sucursalId });
  return ((data ?? []) as { gajo: number; texto: string; probabilidad: number; es_premio: boolean }[])
    .map((g) => ({
      gajo: Number(g.gajo),
      texto: g.texto,
      probabilidad: Number(g.probabilidad),
      esPremio: g.es_premio,
    }))
    .sort((a, b) => a.gajo - b.gajo);
}

export type MiGiro = {
  premio: string;
  esPremio: boolean;
  codigo: string | null;
  venceEn: string | null;
  canjeadoEn: string | null;
  puedeGirar: boolean;
};

/**
 * El último giro de quien mira en esta ruleta y si todavía le toca girar
 * (migración 000064). Sin giros, null.
 */
export async function miGiroEn(sucursalId: string): Promise<MiGiro | null> {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.rpc("mi_giro_en", { p_sucursal: sucursalId });
  const fila = (data as {
    premio: string;
    es_premio: boolean;
    codigo: string | null;
    vence_en: string | null;
    canjeado_en: string | null;
    puede_girar: boolean;
  }[] | null)?.[0];
  if (!fila) return null;
  return {
    premio: fila.premio,
    esPremio: fila.es_premio,
    codigo: fila.codigo,
    venceEn: fila.vence_en,
    canjeadoEn: fila.canjeado_en,
    puedeGirar: fila.puede_girar,
  };
}

/** Las sucursales con una ruleta que hoy se puede girar. */
export async function sucursalesConRuleta(): Promise<Set<string>> {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.rpc("sucursales_con_ruleta");
  return new Set(((data ?? []) as string[]).map(String));
}

export type MiPremio = {
  codigo: string;
  premio: string;
  venceEn: string;
  canjeadoEn: string | null;
  creadoEn: string;
  marca: string;
  sucursal: string;
  slug: string;
};

/** Los premios de quien mira, el más nuevo arriba. */
export async function misPremios(): Promise<MiPremio[]> {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.rpc("mis_premios");
  return ((data ?? []) as {
    codigo: string;
    premio: string;
    vence_en: string;
    canjeado_en: string | null;
    creado_en: string;
    marca: string;
    sucursal: string;
    slug: string;
  }[]).map((p) => ({
    codigo: p.codigo,
    premio: p.premio,
    venceEn: p.vence_en,
    canjeadoEn: p.canjeado_en,
    creadoEn: p.creado_en,
    marca: p.marca,
    sucursal: p.sucursal,
    slug: p.slug,
  }));
}

export type PremioEntregado = {
  codigo: string;
  premio: string;
  venceEn: string;
  canjeadoEn: string | null;
  creadoEn: string;
  cliente: string;
};

/** Lo que ha repartido una sucursal, para su panel. */
export async function premiosEntregados(sucursalId: string): Promise<PremioEntregado[]> {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.rpc("premios_entregados", { p_sucursal: sucursalId });
  return ((data ?? []) as {
    codigo: string;
    premio: string;
    vence_en: string;
    canjeado_en: string | null;
    creado_en: string;
    cliente: string;
  }[]).map((p) => ({
    codigo: p.codigo,
    premio: p.premio,
    venceEn: p.vence_en,
    canjeadoEn: p.canjeado_en,
    creadoEn: p.creado_en,
    cliente: p.cliente,
  }));
}

/** Hoy en el centro de México, `aaaa-mm-dd`, para saber si un premio venció. */
export function hoyEnMexico() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(new Date());
}

/**
 * Lo que lleva el tarjetón del mostrador de una sucursal
 * (`lib/negocio/tarjeton-pdf`): a dónde lleva el QR y, si tiene la ruleta
 * encendida, qué premios se pueden ganar y cada cuánto se gira.
 */
export async function tarjetonDe(
  sucursal: { id: string; slug: string; nombre_sucursal: string; logo: string | null },
  marca: string,
  origen: string,
  logo: string | null,
  conRuleta: boolean,
): Promise<DatosDelTarjeton> {
  const ruleta = conRuleta ? await ruletaDe(sucursal.id) : null;
  const premios = [
    ...new Set((ruleta?.premios ?? []).filter((p) => p.esPremio && p.texto.trim()).map((p) => p.texto.trim())),
  ];

  return {
    marca,
    sucursal: sucursal.nombre_sucursal,
    logo,
    destino: `${origen}/marca/${sucursal.slug}`,
    conRuleta: Boolean(ruleta?.activa) && conRuleta,
    premios,
    frecuencia: ruleta ? TEXTO_DE_FRECUENCIA[ruleta.frecuencia] : null,
  };
}
