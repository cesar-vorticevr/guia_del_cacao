"use server";

import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { destinoSegunRol, origenDelSitio } from "@/lib/auth/sesion";

export type EstadoFormulario = { error?: string };


function texto(datos: FormData, campo: string) {
  return (datos.get(campo)?.toString() ?? "").trim();
}

/** Traduce los errores de Supabase, que llegan en inglés, al español del sitio. */
function traducirError(mensaje: string) {
  const m = mensaje.toLowerCase();

  if (m.includes("invalid login credentials")) {
    return "Correo o contraseña incorrectos.";
  }
  if (m.includes("already registered") || m.includes("already been registered")) {
    return "Ese correo ya tiene una cuenta. Inicia sesión.";
  }
  if (m.includes("email not confirmed")) {
    return "Falta confirmar tu correo. Revisa tu bandeja de entrada.";
  }
  if (m.includes("password")) {
    return "La contraseña no cumple los requisitos mínimos.";
  }

  return "No se pudo completar la operación. Inténtalo de nuevo.";
}

function validarBasicos(nombre: string, correo: string, contrasena: string) {
  if (!nombre) return "Escribe tu nombre.";
  if (!correo.includes("@")) return "Escribe un correo válido.";
  if (contrasena.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
  return null;
}

/**
 * Registro de Cliente por correo. El rol viaja en la metadata del alta y el
 * trigger de la base es quien lo fija; nunca se acepta 'admin' por esa vía.
 */
export async function registrarCliente(
  _previo: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const nombre = texto(datos, "nombre");
  const correo = texto(datos, "correo");
  const contrasena = texto(datos, "contrasena");

  const problema = validarBasicos(nombre, correo, contrasena);
  if (problema) return { error: problema };

  const supabase = await crearClienteServidor();

  const { data, error } = await supabase.auth.signUp({
    email: correo,
    password: contrasena,
    options: { data: { nombre, rol: "cliente" } },
  });

  if (error) return { error: traducirError(error.message) };

  // Si el proyecto exige confirmar el correo, todavía no hay sesión.
  if (!data.session) redirect("/registro/confirma");

  redirect("/cuenta");
}

/**
 * Registro de Negocio. Además de la cuenta, el spec §3.1 pide el nombre
 * comercial y la categoría desde el primer formulario.
 *
 * Si el proyecto exige confirmar el correo, todavía no hay sesión y por lo
 * tanto no se puede crear la marca (RLS exige un dueño identificado): en ese
 * caso los datos se piden otra vez al entrar, en /negocio/completar-marca.
 */
export async function registrarNegocio(
  _previo: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const nombre = texto(datos, "nombre");
  const correo = texto(datos, "correo");
  const contrasena = texto(datos, "contrasena");
  const nombreComercial = texto(datos, "nombre_comercial");
  const categoria = Number(texto(datos, "categoria_id"));

  const problema = validarBasicos(nombre, correo, contrasena);
  if (problema) return { error: problema };
  if (!nombreComercial) return { error: "Escribe el nombre comercial de tu negocio." };
  if (!categoria) return { error: "Elige la categoría de tu negocio." };

  const supabase = await crearClienteServidor();

  const { data, error } = await supabase.auth.signUp({
    email: correo,
    password: contrasena,
    options: { data: { nombre, rol: "negocio" } },
  });

  if (error) return { error: traducirError(error.message) };
  if (!data.session) redirect("/registro/confirma");

  const { error: errorMarca } = await supabase.from("marcas").insert({
    perfil_id: data.session.user.id,
    nombre_comercial: nombreComercial,
    categoria_id: categoria,
  });

  // La cuenta ya existe; si la marca falló se completa en el paso siguiente.
  if (errorMarca) redirect("/negocio/completar-marca");

  redirect("/negocio/panel");
}

/** Alta de la marca cuando no se pudo crear durante el registro. */
export async function crearMarca(
  _previo: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const nombreComercial = texto(datos, "nombre_comercial");
  const categoria = Number(texto(datos, "categoria_id"));

  if (!nombreComercial) return { error: "Escribe el nombre comercial de tu negocio." };
  if (!categoria) return { error: "Elige la categoría de tu negocio." };

  const supabase = await crearClienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { error } = await supabase.from("marcas").insert({
    perfil_id: user.id,
    nombre_comercial: nombreComercial,
    categoria_id: categoria,
  });

  if (error) return { error: "No se pudo dar de alta la marca. Inténtalo de nuevo." };

  redirect("/negocio/panel");
}

export async function iniciarSesion(
  _previo: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const correo = texto(datos, "correo");
  const contrasena = texto(datos, "contrasena");

  if (!correo || !contrasena) return { error: "Escribe tu correo y tu contraseña." };

  const supabase = await crearClienteServidor();

  const { error } = await supabase.auth.signInWithPassword({
    email: correo,
    password: contrasena,
  });

  if (error) return { error: traducirError(error.message) };

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("rol, rol_confirmado")
    .single();

  redirect(perfil ? destinoSegunRol(perfil) : "/cuenta");
}

/**
 * Entrar con Google.
 *
 * No se manda el rol: Google resuelve identidad, no rol (spec §3.1). Si la
 * cuenta es nueva, el perfil nace sin confirmar y la pantalla /elegir-rol
 * pregunta si es cliente o negocio.
 */
export async function entrarConGoogle() {
  const supabase = await crearClienteServidor();
  const origen = await origenDelSitio();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origen}/auth/callback` },
  });

  if (error || !data.url) {
    redirect("/login?error=google");
  }

  redirect(data.url);
}

/** Cierre de la única ventana en que alguien puede elegir su propio rol. */
export async function elegirRol(
  _previo: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const rol = texto(datos, "rol");

  if (rol !== "cliente" && rol !== "negocio") {
    return { error: "Elige si vas a usar la plataforma como cliente o como negocio." };
  }

  const supabase = await crearClienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // El trigger proteger_rol es quien decide si esta ventana sigue abierta.
  const { error } = await supabase
    .from("perfiles")
    .update({ rol })
    .eq("id", user.id);

  if (error) {
    return { error: "Tu rol ya quedó definido y no se puede cambiar desde aquí." };
  }

  redirect(rol === "negocio" ? "/negocio/completar-marca" : "/cuenta");
}

export async function cerrarSesion() {
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();
  redirect("/");
}

