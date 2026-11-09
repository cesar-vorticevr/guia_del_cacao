"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import {
  destinoAlEntrar,
  origenDelSitio,
  perfilActual,
} from "@/lib/auth/sesion";
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
  if (
    m.includes("already registered") ||
    m.includes("already been registered")
  ) {
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
  if (m.includes("expired") || m.includes("invalid") && m.includes("token")) {
    return "Ese código no es correcto o ya caducó. Revísalo o pide uno nuevo.";
  }
  if (m.includes("security purposes") || m.includes("rate limit")) {
    return "Espera un minuto antes de pedir otro código.";
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

  const origen = await origenDelSitio();

  const { data, error } = await supabase.auth.signUp({
    email: correo,
    password: contrasena,
    // El enlace de confirmación vuelve a /auth/callback, que abre la sesión y
    // da el correo por verificado. Sin esto caía en la portada con un código
    // que nadie canjeaba, y había que entrar otra vez a mano.
    options: { data: { nombre, rol: "cliente" }, emailRedirectTo: `${origen}/auth/callback` },
  });

  if (error) return { error: traducirError(error.message) };

  // Si el proyecto exige confirmar el correo, todavía no hay sesión.
  if (!data.session) return pedirCodigo(correo);

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
  if (!nombreComercial)
    return { error: "Escribe el nombre comercial de tu negocio." };
  if (!categoria) return { error: "Elige la categoría de tu negocio." };

  const supabase = await crearClienteServidor();

  const origen = await origenDelSitio();

  const { data, error } = await supabase.auth.signUp({
    email: correo,
    password: contrasena,
    options: {
      // El nombre comercial y la categoría viajan con la cuenta: si hay que
      // confirmar el correo, la marca se crea sola al volver
      // (/negocio/completar-marca) en vez de pedirlos otra vez.
      data: { nombre, rol: "negocio", nombre_comercial: nombreComercial, categoria_id: categoria },
      emailRedirectTo: `${origen}/auth/callback`,
    },
  });

  if (error) return { error: traducirError(error.message) };
  if (!data.session) return pedirCodigo(correo);

  const { error: errorMarca } = await supabase.from("marcas").insert({
    perfil_id: data.session.user.id,
    nombre_comercial: nombreComercial,
    categoria_id: categoria,
  });

  // La cuenta ya existe; si la marca falló se completa en el paso siguiente.
  if (errorMarca) redirect("/negocio/completar-marca");

  redirect("/negocio/panel");
}

// ---------------------------------------------------------------------------
// Confirmar la cuenta con el código del correo
// ---------------------------------------------------------------------------

/**
 * A qué correo se le mandó el código, mientras se escribe. Va en una cookie y
 * no en la URL: un correo en la dirección se queda en el historial y en los
 * registros del servidor. Dura lo que el código.
 */
const COOKIE_CODIGO = "guia-codigo-para";

/** Tras el alta sin sesión: recuerda el correo y lleva a escribir el código. */
async function pedirCodigo(correo: string): Promise<never> {
  (await cookies()).set(COOKIE_CODIGO, correo, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60,
    path: "/",
  });
  redirect("/registro/confirma");
}

/** El correo al que se mandó el código, si sigue en la cookie. */
export async function correoDelCodigo() {
  return (await cookies()).get(COOKIE_CODIGO)?.value ?? null;
}

/** Solo los dígitos: se dicta y se copia con espacios o guiones. */
function codigoDe(datos: FormData) {
  return texto(datos, "codigo").replace(/\D/g, "");
}

/**
 * Confirma la cuenta con el código que llega al correo, como en
 * Vórtice VR. Es el mismo correo de siempre (`signUp`), que ahora trae el
 * código además del enlace: en el stand se lee en el celular y se escribe en
 * la tablet, sin salir de la página. El enlace sigue sirviendo.
 *
 * `verifyOtp` abre la sesión con `amr = otp`, que `marcar_correo_verificado`
 * acepta: confirmar la cuenta también deja verificado el correo del negocio.
 */
export async function confirmarConCodigo(
  _previo: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const correo = (await correoDelCodigo()) ?? texto(datos, "correo");
  const codigo = codigoDe(datos);

  if (!correo.includes("@")) return { error: "Escribe el correo con el que te registraste." };
  if (codigo.length < 6) return { error: "Escribe el código completo, como viene en el correo." };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.verifyOtp({ email: correo, token: codigo, type: "email" });
  if (error) return { error: traducirError(error.message) };

  await supabase.rpc("marcar_correo_verificado");
  (await cookies()).delete(COOKIE_CODIGO);

  const perfil = await perfilActual();
  redirect(perfil ? await destinoAlEntrar(perfil) : "/cuenta");
}

/** Manda otra vez el correo del alta, con un código nuevo. */
export async function reenviarCodigo(
  _previo: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const correo = (await correoDelCodigo()) ?? texto(datos, "correo");
  if (!correo.includes("@")) return { error: "Escribe el correo con el que te registraste." };

  const supabase = await crearClienteServidor();
  const origen = await origenDelSitio();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: correo,
    options: { emailRedirectTo: `${origen}/auth/callback` },
  });
  if (error) return { error: traducirError(error.message) };

  return { enviado: true };
}

/** Alta de la marca cuando no se pudo crear durante el registro. */
export async function crearMarca(
  _previo: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const nombreComercial = texto(datos, "nombre_comercial");
  const categoria = Number(texto(datos, "categoria_id"));

  if (!nombreComercial)
    return { error: "Escribe el nombre comercial de tu negocio." };
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

  if (error)
    return { error: "No se pudo dar de alta la marca. Inténtalo de nuevo." };

  redirect("/negocio/panel");
}

export async function iniciarSesion(
  _previo: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const correo = texto(datos, "correo");
  const contrasena = texto(datos, "contrasena");

  if (!correo || !contrasena)
    return { error: "Escribe tu correo y tu contraseña." };

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

  // Si venía de una pantalla que pedía sesión —«Entra para pedir» en un
  // micrositio, el buzón— vuelve ahí, igual que con Google. Solo rutas de
  // este sitio, y solo con el rol ya elegido: sin rol, lo primero es elegirlo.
  const pedido = texto(datos, "volver");
  const volver = pedido.startsWith("/") && !pedido.startsWith("//") ? pedido : null;
  if (volver && perfil?.rol_confirmado) redirect(volver);

  redirect(perfil ? await destinoAlEntrar(perfil) : "/cuenta");
}

/**
 * Entrar con Google.
 *
 * No se manda el rol: Google resuelve identidad, no rol (spec §3.1). Si la
 * cuenta es nueva, el perfil nace sin confirmar y la pantalla /elegir-rol
 * pregunta si es cliente o negocio.
 *
 * Si venía de una pantalla que pedía sesión —`/login?volver=/cupones`— se le
 * devuelve ahí al terminar. Sin esto, quien tocaba «entrar con Google» desde
 * un cupón acababa en su panel y tenía que buscar otra vez lo que iba a hacer.
 */
export async function entrarConGoogle(datos?: FormData) {
  const supabase = await crearClienteServidor();
  const origen = await origenDelSitio();

  /*
    El destino viene de la URL, así que puede venir de cualquiera: se exige
    que sea una ruta de este sitio. Sin el filtro, un enlace con
    `?volver=https://otro-sitio` usaría nuestro dominio para mandar a la gente
    afuera justo después de identificarse. El callback lo vuelve a comprobar;
    aquí se filtra antes para no pedirle a Google que devuelva a ningún lado
    raro.
  */
  const pedido = datos?.get("volver")?.toString() ?? "";
  const volver =
    pedido.startsWith("/") && !pedido.startsWith("//") ? pedido : null;

  const destino = volver
    ? `${origen}/auth/callback?siguiente=${encodeURIComponent(volver)}`
    : `${origen}/auth/callback`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: destino },
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
    return {
      error: "Elige si vas a usar la plataforma como cliente o como negocio.",
    };
  }

  const supabase = await crearClienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // El trigger proteger_rol es quien decide si esta ventana sigue abierta.
  // `rol_confirmado` va explícito: quien elige «cliente» ya era cliente, y sin
  // él no cambiaba nada y la cuenta se quedaba sin confirmar (migración 000061).
  const { error } = await supabase
    .from("perfiles")
    .update({ rol, rol_confirmado: true })
    .eq("id", user.id);

  if (error) {
    return {
      error: "Tu rol ya quedó definido y no se puede cambiar desde aquí.",
    };
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
  redirect(perfil ? await destinoAlEntrar(perfil) : "/cuenta");
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

/**
 * El código del correo de `pedirVerificarCorreo`, escrito a mano. Va a la
 * dirección de la sesión, igual que el correo: el código no sirve para otra.
 */
export async function verificarCorreoConCodigo(
  _previo: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const perfil = await perfilActual();
  if (!perfil) redirect("/login");

  const codigo = codigoDe(datos);
  if (codigo.length < 6) return { error: "Escribe el código completo, como viene en el correo.", enviado: true };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.verifyOtp({ email: perfil.correo, token: codigo, type: "email" });
  if (error) return { error: traducirError(error.message), enviado: true };

  const { error: errorMarca } = await supabase.rpc("marcar_correo_verificado");
  redirect(`/negocio/panel?correo=${errorMarca ? "fallo" : "listo"}`);
}

// ---------------------------------------------------------------------------
// El @usuario (migración 000078)
// ---------------------------------------------------------------------------

/**
 * Cambia el @usuario de quien está en sesión. La base lo limpia (sin arroba, en
 * minúsculas), exige que esté libre y que no se haya cambiado en 30 días: aquí
 * solo se traducen sus avisos.
 */
export async function cambiarUsuario(
  _previo: EstadoFormulario & { ok?: string },
  datos: FormData,
): Promise<EstadoFormulario & { ok?: string }> {
  const perfil = await perfilActual();
  if (!perfil) redirect("/login");

  const usuario = texto(datos, "usuario").replace(/^@+/, "").toLowerCase();
  if (usuario === perfil.usuario) return { ok: "Ese ya es tu @usuario." };
  if (!/^[a-z0-9._]{3,30}$/.test(usuario)) {
    return { error: "Usa de 3 a 30 letras, números, puntos o guiones bajos, sin espacios ni acentos." };
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("perfiles").update({ usuario }).eq("id", perfil.id);

  if (error) {
    // Los dos avisos de la base ya vienen en español y dicen qué hacer.
    if (error.code === "P0001") return { error: error.message };
    if (error.code === "23505") return { error: "Ese @usuario ya lo tiene otra cuenta. Prueba con otro." };
    return { error: "No se pudo guardar tu @usuario. Inténtalo de nuevo." };
  }

  return { ok: `Listo: ahora eres @${usuario}.` };
}
