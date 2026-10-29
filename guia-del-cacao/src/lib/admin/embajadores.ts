"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { perfilActual } from "@/lib/auth/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { crearClienteDeServicio } from "@/lib/supabase/servicio";
import { pesos } from "@/lib/tipos";

export type EstadoPagoEmbajador = { error?: string; ok?: string };

async function exigirAdmin() {
  const perfil = await perfilActual();
  if (!perfil) redirect("/login");
  if (perfil.rol !== "admin") redirect("/cuenta");
  return perfil;
}

export type EstadoCuentaDeVentas = { error?: string; ok?: string };

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Lo que traen los dos formularios de una cuenta de ventas, ya limpio. La
 * contraseña puede venir vacía al editar: entonces no se toca.
 */
function leerCuenta(datos: FormData) {
  return {
    nombre: (datos.get("nombre")?.toString() ?? "").trim().slice(0, 80),
    correo: (datos.get("correo")?.toString() ?? "").trim().toLowerCase(),
    contrasena: datos.get("contrasena")?.toString() ?? "",
    hasta: datos.get("comision_hasta")?.toString() ?? "",
  };
}

function revisarCuenta(c: ReturnType<typeof leerCuenta>, contrasenaObligatoria: boolean) {
  if (c.nombre.length < 2) return "Escribe el nombre del vendedor.";
  if (!CORREO.test(c.correo)) return "Ese correo no parece válido.";
  if ((contrasenaObligatoria || c.contrasena) && c.contrasena.length < 8) {
    return "La contraseña lleva al menos 8 caracteres.";
  }
  if (c.hasta && !FECHA.test(c.hasta)) return "La fecha de corte no es válida.";
  return null;
}

function errorDeAuth(mensaje: string) {
  return /already|registered|exists/i.test(mensaje)
    ? "Ya hay una cuenta con ese correo."
    : "No se pudo guardar la cuenta. Inténtalo de nuevo.";
}

/**
 * Crear una cuenta de ventas: el correo y la contraseña los pone el
 * administrador, la cuenta nace confirmada y con su código (migración 000067).
 *
 * El usuario de Auth solo se crea con la llave de servicio; el código lo da
 * `asignar_embajador` con la sesión del administrador, que la base vuelve a
 * comprobar.
 */
export async function crearCuentaDeVentas(
  _previo: EstadoCuentaDeVentas,
  datos: FormData,
): Promise<EstadoCuentaDeVentas> {
  await exigirAdmin();

  const cuenta = leerCuenta(datos);
  const problema = revisarCuenta(cuenta, true);
  if (problema) return { error: problema };

  const servicio = crearClienteDeServicio();
  const { data, error } = await servicio.auth.admin.createUser({
    email: cuenta.correo,
    password: cuenta.contrasena,
    email_confirm: true,
    user_metadata: { nombre: cuenta.nombre, rol: "cliente" },
  });

  if (error || !data.user) {
    if (error) console.error("No se creó la cuenta de ventas:", error);
    return { error: errorDeAuth(error?.message ?? "") };
  }

  // El correo ya lo confirmó el administrador al crearla.
  await servicio
    .from("perfiles")
    .update({ correo_verificado_en: new Date().toISOString() })
    .eq("id", data.user.id);

  const supabase = await crearClienteServidor();
  const { data: codigo, error: errorCodigo } = await supabase.rpc("asignar_embajador", {
    p_perfil: data.user.id,
  });

  if (errorCodigo) {
    console.error("No se asignó el código:", errorCodigo);
    return { error: "La cuenta se creó, pero no se le pudo dar código. Edítala para reintentar." };
  }

  if (cuenta.hasta) {
    await supabase
      .from("embajadores")
      .update({ comision_hasta: cuenta.hasta })
      .eq("perfil_id", data.user.id);
  }

  revalidatePath("/admin/embajadores");
  return { ok: `Cuenta de ${cuenta.nombre} creada con el código ${codigo}.` };
}

/**
 * Editar una cuenta de ventas: nombre, correo, contraseña (si se escribe una),
 * fecha de corte de la comisión y si su código está activo o en pausa.
 */
export async function editarCuentaDeVentas(
  _previo: EstadoCuentaDeVentas,
  datos: FormData,
): Promise<EstadoCuentaDeVentas> {
  await exigirAdmin();

  const perfilId = datos.get("perfil_id")?.toString() ?? "";
  const estado = datos.get("estado")?.toString();
  const cuenta = leerCuenta(datos);
  const problema = revisarCuenta(cuenta, false);
  if (problema) return { error: problema };

  const supabase = await crearClienteServidor();

  // Solo se editan así las cuentas de ventas, no cualquier persona del sitio.
  const { data: fila } = await supabase
    .from("embajadores")
    .select("estado")
    .eq("perfil_id", perfilId)
    .maybeSingle();
  if (!fila) return { error: "Esa cuenta no es de ventas." };

  const servicio = crearClienteDeServicio();
  const { error } = await servicio.auth.admin.updateUserById(perfilId, {
    email: cuenta.correo,
    email_confirm: true,
    ...(cuenta.contrasena ? { password: cuenta.contrasena } : {}),
  });
  if (error) {
    console.error("No se editó la cuenta de ventas:", error);
    return { error: errorDeAuth(error.message) };
  }

  await servicio
    .from("perfiles")
    .update({ nombre: cuenta.nombre, correo: cuenta.correo })
    .eq("id", perfilId);

  if (cuenta.hasta) {
    await supabase.from("embajadores").update({ comision_hasta: cuenta.hasta }).eq("perfil_id", perfilId);
  }

  if ((estado === "activo" || estado === "pausado") && estado !== fila.estado) {
    const { error: errorEstado } =
      estado === "activo"
        ? await supabase.rpc("asignar_embajador", { p_perfil: perfilId })
        : await supabase.rpc("decidir_embajador", { p_perfil: perfilId, p_estado: "pausado" });
    if (errorEstado) console.error("No se cambió el estado del vendedor:", errorEstado);
  }

  revalidatePath("/admin/embajadores");
  return { ok: cuenta.contrasena ? "Guardado, con contraseña nueva." : "Guardado." };
}

/**
 * Ya se le transfirió a un embajador: se anota el pago con su referencia y
 * quedan cubiertas todas las comisiones que se le debían.
 */
export async function registrarPagoAEmbajador(
  _previo: EstadoPagoEmbajador,
  datos: FormData,
): Promise<EstadoPagoEmbajador> {
  await exigirAdmin();

  const perfilId = datos.get("perfil_id")?.toString() ?? "";
  const referencia = (datos.get("referencia")?.toString() ?? "").trim().slice(0, 120);

  if (!referencia) {
    return { error: "Anota la referencia de la transferencia (SPEI, folio…)." };
  }

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("registrar_pago_a_embajador", {
    p_embajador: perfilId,
    p_referencia: referencia,
  });

  if (error) {
    return {
      error: error.code === "P0001" ? error.message : "No se pudo registrar el pago.",
    };
  }

  revalidatePath("/admin/embajadores");
  revalidatePath("/admin");
  return { ok: `Pago de ${pesos(Number(data))} registrado.` };
}
