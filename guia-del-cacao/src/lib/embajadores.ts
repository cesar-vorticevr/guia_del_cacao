import { crearClienteServidor } from "@/lib/supabase/server";
import { crearClienteDeServicio } from "@/lib/supabase/servicio";

/**
 * Embajadores del Cacao (migración 000059).
 *
 * Quien es embajador comparte su código; el negocio que lo pone recibe 20% de
 * descuento en su primer pago y el embajador gana 20% de lo que ese negocio
 * pagó. Las reglas viven en la base —quién puede usar qué código, cuándo se
 * anota una comisión, quién registra un pago— y aquí solo se llaman.
 *
 * No es un archivo de acciones (`"use server"`): lo que hay aquí recibe ids y
 * no debe quedar expuesto como endpoint. Las acciones que lo usan comprueban
 * antes quién llama.
 */

export type EstadoDeEmbajador = "solicitado" | "activo" | "pausado" | "rechazado";

/**
 * Pone el código de un embajador en una marca. Devuelve su nombre, nada si el
 * código no es de ningún embajador (puede ser un convenio), o el error de la
 * base: su propio código, una marca que ya pagó, otro embajador ya puesto.
 */
export async function vincularEmbajador(
  marcaId: string,
  codigo: string,
): Promise<{ nombre?: string; error?: string }> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("vincular_embajador", {
    p_marca: marcaId,
    p_codigo: codigo,
  });

  if (error) {
    return {
      error:
        error.code === "P0001"
          ? error.message
          : "No se pudo revisar el código. Inténtalo de nuevo.",
    };
  }

  return data ? { nombre: data as string } : {};
}

/**
 * El código de embajador que espera el primer pago de una marca, si tiene uno.
 * Lo usa el cobro, que corre como el dueño de la marca.
 */
export async function embajadorPendienteDe(marcaId: string) {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.rpc("codigo_de_embajador_de", { p_marca: marcaId });
  const fila = (data as { codigo: string; embajador: string; embajador_id: string }[] | null)?.[0];
  return fila ?? null;
}

/**
 * Stripe confirmó el primer pago de una marca con código: se anota lo que se
 * pagó y la comisión. Solo con la llave de servicio (la llama el webhook), y la
 * base la hace idempotente.
 */
export async function registrarComision(marcaId: string, monto: number, suscripcionStripe: string) {
  const servicio = crearClienteDeServicio();
  const { error } = await servicio.rpc("registrar_comision", {
    p_marca: marcaId,
    p_monto: monto,
    p_stripe: suscripcionStripe,
  });
  if (error) console.error("No se anotó la comisión del embajador:", error);
}
