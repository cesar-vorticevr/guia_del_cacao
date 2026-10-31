"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { perfilActual } from "@/lib/auth/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";

export type EstadoPedido = {
  error?: string;
  ok?: string;
  /** Lo que venía escrito, para devolverlo al formulario si falla. */
  valores?: Record<string, string>;
};

async function exigirSesion(volver = "/pedidos") {
  const perfil = await perfilActual();
  if (!perfil) redirect(`/login?volver=${encodeURIComponent(volver)}`);
  return perfil;
}

/** Los errores de la base que traen su propia explicación (P0001) se dicen tal cual. */
function explicar(error: { code?: string; message: string } | null, otro: string) {
  if (!error) return undefined;
  return error.code === "P0001" ? error.message : otro;
}

function refrescar(conversacion?: string | null) {
  revalidatePath("/pedidos");
  revalidatePath("/negocio/panel/pedidos");
  revalidatePath("/negocio/panel", "layout");
  revalidatePath("/buzon");
  if (conversacion) revalidatePath(`/buzon/${conversacion}`);
}

/**
 * El cliente manda su pedido desde el micrositio. Qué se puede pedir, a quién
 * y cuánto lo decide `hacer_pedido`; aquí solo se arma y se lleva al chat,
 * donde el negocio lo va a contestar.
 */
export async function hacerPedido(
  _previo: EstadoPedido,
  datos: FormData,
): Promise<EstadoPedido> {
  const slug = datos.get("slug")?.toString() ?? "";
  await exigirSesion(slug ? `/marca/${slug}` : "/pedidos");

  const valores = {
    direccion: datos.get("direccion")?.toString() ?? "",
    nota: datos.get("nota")?.toString() ?? "",
  };

  let productos: unknown;
  try {
    productos = JSON.parse(datos.get("productos")?.toString() ?? "[]");
  } catch {
    return { error: "Tu pedido está vacío.", valores };
  }

  const supabase = await crearClienteServidor();
  const { data: pedido, error } = await supabase.rpc("hacer_pedido", {
    p_sucursal: datos.get("sucursal_id")?.toString() ?? "",
    p_productos: productos,
    p_entrega: datos.get("entrega")?.toString() ?? "",
    p_direccion: valores.direccion || null,
    p_nota: valores.nota || null,
  });

  if (error || !pedido) {
    return { error: explicar(error, "No se pudo mandar el pedido. Inténtalo de nuevo."), valores };
  }

  const { data } = await supabase
    .from("pedidos")
    .select("conversacion_id")
    .eq("id", pedido)
    .single();

  refrescar(data?.conversacion_id);
  redirect(data ? `/buzon/${data.conversacion_id}` : "/pedidos");
}

/** Confirmar, marcar pagado, entregar o cancelar. Quién puede qué lo dice la base. */
export async function cambiarEstadoPedido(
  _previo: EstadoPedido,
  datos: FormData,
): Promise<EstadoPedido> {
  await exigirSesion();

  const total = datos.get("total")?.toString().replace(/[$,\s]/g, "") ?? "";
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("cambiar_estado_pedido", {
    p_pedido: datos.get("pedido_id")?.toString() ?? "",
    p_estado: datos.get("estado")?.toString() ?? "",
    p_total: total === "" ? null : Number(total),
    p_motivo: datos.get("motivo")?.toString() || null,
  });

  if (error) {
    return {
      error: explicar(error, "No se pudo guardar. Inténtalo de nuevo."),
      valores: {
        estado: datos.get("estado")?.toString() ?? "",
        total: datos.get("total")?.toString() ?? "",
        motivo: datos.get("motivo")?.toString() ?? "",
      },
    };
  }

  refrescar(datos.get("conversacion_id")?.toString());
  return { ok: "Listo" };
}

/** El cliente avisa que ya transfirió. No lo marca pagado: eso lo hace el negocio. */
export async function avisarPago(
  _previo: EstadoPedido,
  datos: FormData,
): Promise<EstadoPedido> {
  await exigirSesion();

  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("avisar_pago_de_pedido", {
    p_pedido: datos.get("pedido_id")?.toString() ?? "",
    p_referencia: datos.get("referencia")?.toString() || null,
  });

  if (error) return { error: explicar(error, "No se pudo avisar. Inténtalo de nuevo.") };

  refrescar(datos.get("conversacion_id")?.toString());
  return { ok: "Le avisamos al negocio." };
}

/** El negocio anota a dónde le transfieren y si recibe pedidos. */
export async function guardarDatosDePago(
  _previo: EstadoPedido,
  datos: FormData,
): Promise<EstadoPedido> {
  const perfil = await exigirSesion("/negocio/panel/pedidos");

  const valores = {
    banco: datos.get("banco")?.toString() ?? "",
    titular: datos.get("titular")?.toString() ?? "",
    clabe: datos.get("clabe")?.toString() ?? "",
    instrucciones: datos.get("instrucciones")?.toString() ?? "",
    recibe_pedidos: datos.get("recibe_pedidos") === "on" ? "on" : "",
  };

  const supabase = await crearClienteServidor();
  const { data: marca } = await supabase
    .from("marcas")
    .select("id")
    .eq("perfil_id", perfil.id)
    .order("fecha_registro")
    .limit(1)
    .maybeSingle();

  if (!marca) return { error: "Primero da de alta tu negocio.", valores };

  const { error } = await supabase.from("datos_de_pago").upsert({
    marca_id: marca.id,
    banco: valores.banco,
    titular: valores.titular,
    clabe: valores.clabe,
    instrucciones: valores.instrucciones || null,
    recibe_pedidos: valores.recibe_pedidos === "on",
  });

  if (error) {
    return {
      error:
        error.code === "23514"
          ? "Revisa el banco y el titular: no pueden quedar vacíos."
          : explicar(error, "No se pudieron guardar. Inténtalo de nuevo."),
      valores,
    };
  }

  refrescar();
  return { ok: "Guardado.", valores };
}

/** El negocio manda sus datos de pago a una conversación. */
export async function mandarDatosDePago(datos: FormData) {
  await exigirSesion();

  const conversacion = datos.get("conversacion_id")?.toString() ?? "";
  const supabase = await crearClienteServidor();
  await supabase.rpc("mandar_datos_de_pago", { p_conversacion: conversacion });

  refrescar(conversacion);
}
