"use server";

import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { destinoSegunRol, origenDelSitio, perfilActual } from "@/lib/auth/sesion";
import { MINIMO_CONTRASENA } from "@/lib/limites";

export type EstadoFormulario = {
  error?: string;
  /** Solo lo usa el restablecimiento: el correo salió y toca esperar. */
  enviado?: boolean;
};


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
  // Va antes del caso general: ese mensaje también trae la palabra "password"
  // y caía en "no cumple los requisitos mínimos", que manda a cambiarla por una
  // más larga cuando el problema era justo el contrario.
  if (m.includes("should be different")) {
    return "Esa es la contraseña que ya tenías. Escribe una distinta.";
  }
  if (m.includes("password")) {
    return "La contraseña no cumple los requisitos mínimos.";
  }

  return "No se pudo completar la operación. Inténtalo de nuevo.";
}

/**
 * Las dos contraseñas tienen que coincidir.
 *
 * Se comprueba en el servidor además de en el campo: el segundo cuadro es una
 * red contra la errata de tecleo, y una red que solo existe en el navegador no
 * sirve para lo único que importa —que quien se registra pueda volver a entrar.
 */
function validarContrasena(contrasena: string, repetida: string) {
  if (contrasena.length < MINIMO_CONTRASENA) {
    return `La contraseña debe tener al menos ${MINIMO_CONTRASENA} caracteres.`;
  }
  if (contrasena !== repetida) {
    return "Las dos contraseñas no coinciden. Escríbelas de nuevo.";
  }
  return null;
}

function validarBasicos(
  nombre: string,
  correo: string,
  contrasena: string,
  repetida: string,
) {
  if (!nombre) return "Escribe tu nombre.";
  if (!correo.includes("@")) return "Escribe un correo válido.";
  return validarContrasena(contrasena, repetida);
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
  const repetida = texto(datos, "contrasena2");

  const problema = validarBasicos(nombre, correo, contrasena, repetida);
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
  const repetida = texto(datos, "contrasena2");
  const nombreComercial = texto(datos, "nombre_comercial");
  const categoria = Number(texto(datos, "categoria_id"));

  const problema = validarBasicos(nombre, correo, contrasena, repetida);
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

  // Se lee con perfilActual(), que filtra por id. Un `.single()` suelto sobre
  // perfiles falla justo para los administradores: su política les deja ver
  // todos los perfiles, así que la consulta devuelve varias filas.
  const perfil = await perfilActual();

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


// ---------------------------------------------------------------------------
// Contraseña olvidada
// ---------------------------------------------------------------------------

/**
 * Manda el correo con el enlace para poner una contraseña nueva.
 *
 * **Contesta lo mismo exista o no la cuenta.** Si dijera "ese correo no está
 * registrado", cualquiera podría averiguar quién tiene cuenta aquí probando
 * direcciones, y en un directorio de negocios eso es información de la que no
 * somos dueños. Supabase se comporta igual por su lado; esta pantalla no
 * deshace ese cuidado.
 *
 * El enlace vuelve por `/auth/callback`, que es el único sitio que cambia el
 * código por una sesión, y de ahí sigue a la pantalla de la contraseña nueva.
 */
export async function pedirRestablecer(
  _previo: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const correo = texto(datos, "correo");

  if (!correo.includes("@")) return { error: "Escribe un correo válido." };

  const supabase = await crearClienteServidor();
  const origen = await origenDelSitio();

  await supabase.auth.resetPasswordForEmail(correo, {
    redirectTo: `${origen}/auth/callback?siguiente=/cambiar-contrasena`,
  });

  return { enviado: true };
}

/**
 * Guarda la contraseña nueva.
 *
 * Exige sesión: se llega aquí con la que abrió el enlace del correo. Sin ese
 * requisito, la acción dejaría cambiarle la contraseña a cualquiera que
 * adivinara la ruta.
 */
export async function cambiarContrasena(
  _previo: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const contrasena = texto(datos, "contrasena");
  const repetida = texto(datos, "contrasena2");

  const problema = validarContrasena(contrasena, repetida);
  if (problema) return { error: problema };

  const supabase = await crearClienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error:
        "El enlace ya no es válido. Pide otro correo para restablecer tu contraseña.",
    };
  }

  const { error } = await supabase.auth.updateUser({ password: contrasena });

  if (error) return { error: traducirError(error.message) };

  const perfil = await perfilActual();
  redirect(perfil ? destinoSegunRol(perfil) : "/cuenta");
}

// ---------------------------------------------------------------------------
// Confirmar el correo (negocios, antes de su primera sucursal)
// ---------------------------------------------------------------------------

/**
 * Manda al correo del negocio el enlace que confirma que esa dirección es suya.
 *
 * Va por `signInWithOtp` con `shouldCreateUser: false`: no queremos dar de alta
 * a nadie por esta vía, solo abrir una sesión que GoTrue marque como venida del
 * correo. Esa marca (`amr`) es lo único que la base acepta como prueba —ver
 * `marcar_correo_verificado`—, así que el enlace no es un trámite: es la
 * credencial.
 *
 * Se manda a la dirección de la sesión, no a una escrita en un formulario. Si
 * se pudiera elegir el destino, cualquiera confirmaría la cuenta con un correo
 * suyo y la comprobación no valdría nada.
 */
export async function pedirVerificarCorreo(): Promise<EstadoFormulario> {
  const perfil = await perfilActual();
  if (!perfil) redirect("/login");

  const supabase = await crearClienteServidor();
  const origen = await origenDelSitio();

  const { error } = await supabase.auth.signInWithOtp({
    email: perfil.correo,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${origen}/auth/callback?siguiente=/negocio/verificar-correo`,
    },
  });

  if (error) return { error: traducirError(error.message) };

  return { enviado: true };
}
