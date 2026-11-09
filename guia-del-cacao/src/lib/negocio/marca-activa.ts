import { cache } from "react";
import { cookies } from "next/headers";
import { crearClienteServidor } from "@/lib/supabase/server";

/**
 * El negocio que se está administrando (cuentas compartidas, fase 2).
 *
 * Una cuenta puede administrar varias marcas —las suyas y las que le
 * compartieron—. El panel trabaja sobre una a la vez: la que se eligió en el
 * selector, guardada en una cookie, o la primera de la lista (las propias van
 * antes). La lista sale de `mis_marcas()`, que filtra por quien pregunta: la
 * cookie solo elige entre las que la base ya le deja administrar, así que
 * escribirle a mano el id de otra marca no sirve de nada.
 *
 * `cache` hace que el layout y la página pregunten una sola vez por pintada.
 */

export const COOKIE_MARCA = "guia-marca";

/** Un uuid que no es de nadie: filtra a cero sin romper la consulta. */
export const SIN_MARCA = "00000000-0000-0000-0000-000000000000";

export type MarcaDeLaCuenta = {
  marca_id: string;
  nombre_comercial: string;
  papel: "dueno" | "admin";
};

/** Todas las marcas que administra quien está en sesión. */
export const marcasDeLaCuenta = cache(async (): Promise<MarcaDeLaCuenta[]> => {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.rpc("mis_marcas");
  return (data ?? []) as MarcaDeLaCuenta[];
});

/** La que se está administrando ahora, o null si todavía no tiene ninguna. */
export const marcaActiva = cache(async (): Promise<MarcaDeLaCuenta | null> => {
  const lista = await marcasDeLaCuenta();
  const elegida = (await cookies()).get(COOKIE_MARCA)?.value;
  return lista.find((m) => m.marca_id === elegida) ?? lista[0] ?? null;
});

/** El id de la marca activa, o `SIN_MARCA` para que la consulta no traiga nada. */
export async function idMarcaActiva() {
  return (await marcaActiva())?.marca_id ?? SIN_MARCA;
}

/**
 * Si quien está en sesión es el dueño de esa marca (fase 3). Pagar, publicar,
 * anotar la CLABE, compartir y ceder son solo suyos; la base lo exige por su
 * cuenta y esto es para contestar con algo legible antes de intentarlo.
 */
export async function soyDuenoDe(marcaId: string) {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.rpc("es_dueno_de_marca", { p_marca: marcaId });
  return data === true;
}

export const SOLO_EL_DUENO =
  "Esto solo lo puede hacer quien es dueño del negocio. Tú lo administras: pídeselo, o que te ceda el negocio.";

/**
 * Los ids de todas las que administra: para comprobar que un producto, un
 * evento o una sucursal abiertos por su enlace son de alguna de ellas, aunque
 * no sea la activa. Nunca vacío, para que `.in()` filtre a cero.
 */
export async function idsDeMisMarcas() {
  const ids = (await marcasDeLaCuenta()).map((m) => m.marca_id);
  return ids.length > 0 ? ids : [SIN_MARCA];
}
