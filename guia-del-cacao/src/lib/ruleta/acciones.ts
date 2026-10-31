"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { perfilActual } from "@/lib/auth/sesion";
import { miSucursal } from "@/lib/datos/sucursales";
import { crearClienteServidor } from "@/lib/supabase/server";

/**
 * Lo que se hace con la Ruleta Mágica (migración 000060): girarla, armarla y
 * canjear lo que se ganó. Las reglas —quién gira, cada cuánto, qué premio
 * sale— viven en la base; aquí solo se llaman y se traducen los errores.
 */

export type ResultadoDeGiro =
  | {
      /** El gajo donde paró: la rueda se anima hasta él. */
      gajo: number;
      premio: string;
      /** «Suerte para la próxima» no trae código. */
      esPremio: boolean;
      codigo: string | null;
      venceEn: string | null;
    }
  | { error: string; entrar?: boolean };

/** Girar. El premio lo decide `girar_ruleta`; el navegador solo lo anima. */
export async function girarRuleta(sucursalId: string): Promise<ResultadoDeGiro> {
  const perfil = await perfilActual();
  if (!perfil) return { error: "Inicia sesión para girar la ruleta.", entrar: true };

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("girar_ruleta", { p_sucursal: sucursalId });

  if (error) {
    return {
      error: error.code === "P0001" ? error.message : "La ruleta se atoró. Inténtalo de nuevo.",
    };
  }

  const fila = (data as {
    gajo: number;
    premio: string;
    es_premio: boolean;
    codigo: string | null;
    vence_en: string | null;
  }[])[0];
  /*
    Aquí **no** va `revalidatePath`. Una acción que revalida hace que Next
    vuelva a pintar la página donde se llamó en la misma respuesta, y el
    micrositio, al ver que ya giró, cambia la rueda grande por la de cacao:
    la que estaba girando se desmontaba a media vuelta y no salía el premio.
    La vista previa no lo sufría porque gira sin servidor. La rueda refresca
    la página sola al cerrar el resultado (`cerrar`), y «Mis premios» es
    dinámica: lee de la base cada vez que se abre.
  */
  return {
    gajo: Number(fila.gajo),
    premio: fila.premio,
    esPremio: fila.es_premio,
    codigo: fila.codigo,
    venceEn: fila.vence_en,
  };
}

export type EstadoRuleta = { error?: string; ok?: string };

async function exigirNegocio() {
  const perfil = await perfilActual();
  if (!perfil) redirect("/login");
  if (perfil.rol !== "negocio") redirect("/cuenta");
  return perfil;
}

/** Lo que se lee en un gajo de «suerte». La base pone el mismo en el relleno. */
const SUERTE = "Suerte para la próxima";

/**
 * Guardar la ruleta de una sucursal: si está encendida, cada cuánto se gira,
 * cuántos días vale lo ganado, hasta seis gajos y cómo se llenan los vacíos
 * (migración 000062). Las probabilidades se leen como porcentajes:
 *
 * - Repitiendo premios, los puestos suman 100: la rueda solo los repite.
 * - Rellenando con suerte, lo que falte para 100 es el chance de la suerte, así
 *   que tiene que faltar algo: un gajo de suerte que nunca sale engaña.
 * - Con los seis puestos llenos no hay relleno y suman 100.
 */
export async function guardarRuleta(
  _previo: EstadoRuleta,
  datos: FormData,
): Promise<EstadoRuleta> {
  const perfil = await exigirNegocio();
  const sucursalId = datos.get("sucursal_id")?.toString() ?? "";
  const sucursal = await miSucursal(perfil.id, sucursalId);
  if (!sucursal) return { error: "Esa sucursal no es tuya." };

  const frecuencia = datos.get("frecuencia")?.toString() ?? "diaria";
  if (!["una_vez", "diaria", "ilimitada"].includes(frecuencia)) {
    return { error: "Elige cada cuánto se puede girar." };
  }

  const vigencia = Number(datos.get("vigencia_dias") ?? 30);
  if (!Number.isInteger(vigencia) || vigencia < 1 || vigencia > 365) {
    return { error: "Los premios valen entre 1 y 365 días." };
  }

  const relleno = datos.get("relleno")?.toString() === "repetir" ? "repetir" : "suerte";

  const puestos = [1, 2, 3, 4, 5, 6]
    .map((n) => {
      const esSuerte = datos.get(`suerte_${n}`) === "si";
      return {
        texto: esSuerte ? SUERTE : (datos.get(`premio_${n}`)?.toString() ?? "").trim().slice(0, 40),
        es_premio: !esSuerte,
      };
    })
    .filter((p) => p.texto);

  if (!puestos.some((p) => p.es_premio)) return { error: "Escribe al menos un premio." };

  // Como en Vórtice VR, el negocio no pone porcentajes: cada gajo de la rueda
  // vale lo mismo. Con relleno de suerte cada puesto es un sexto y la suerte se
  // queda el resto; repitiendo, los puestos se reparten el cien. La base tira
  // sobre la suma real, así que el redondeo no mueve el chance.
  const probabilidad = Math.round((100 / (relleno === "repetir" ? puestos.length : 6)) * 100) / 100;
  const premios = puestos.map((p, i) => ({ ...p, probabilidad, orden: i + 1 }));

  const activa = datos.get("activa") === "si";
  const supabase = await crearClienteServidor();

  const { error } = await supabase.from("ruletas").upsert({
    sucursal_id: sucursalId,
    activa,
    frecuencia,
    vigencia_dias: vigencia,
    relleno,
  });
  if (error) {
    return { error: error.code === "P0001" ? error.message : "No se pudo guardar la ruleta." };
  }

  // Los premios se reemplazan enteros: lo ya ganado guarda su propio texto en
  // `giros`, así que cambiarlos no toca ningún premio entregado.
  await supabase.from("premios_ruleta").delete().eq("sucursal_id", sucursalId);
  const { error: errorPremios } = await supabase
    .from("premios_ruleta")
    .insert(premios.map((p) => ({ ...p, sucursal_id: sucursalId })));
  if (errorPremios) return { error: "La ruleta se guardó, pero sus premios no. Inténtalo de nuevo." };

  revalidatePath("/negocio/panel/ruleta");
  revalidatePath(`/marca/${sucursal.slug}`);
  // Sin Pro se guarda igual (000066), pero no sale en el micrositio: se dice.
  const { data: conPro } = await supabase.rpc("sucursal_tiene_ruleta", { p_sucursal: sucursalId });
  if (!conPro) return { ok: "Ruleta guardada. Pruébala aquí; sale en tu micrositio al pasarte a Pro." };
  return { ok: activa ? "¡Tu ruleta está girando!" : "Ruleta guardada, apagada por ahora." };
}

/** El cliente enseña su código en la sucursal: se marca como entregado. */
export async function canjearCodigo(
  _previo: EstadoRuleta,
  datos: FormData,
): Promise<EstadoRuleta> {
  await exigirNegocio();
  const codigo = (datos.get("codigo")?.toString() ?? "").trim();
  if (!codigo) return { error: "Escribe el código que te enseñan." };

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("canjear_premio", { p_codigo: codigo });

  if (error) {
    return { error: error.code === "P0001" ? error.message : "No se pudo canjear. Inténtalo de nuevo." };
  }

  const fila = (data as { premio: string; cliente: string }[])[0];
  revalidatePath("/negocio/panel/ruleta");
  return { ok: `✓ Entrega «${fila.premio}» a ${fila.cliente}.` };
}
