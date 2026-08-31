import { NextResponse } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/server";
import { destinoSegunRol, perfilActual } from "@/lib/auth/sesion";

/**
 * Una ruta interna y nada más.
 *
 * `siguiente` llega en la URL, así que puede venir de cualquiera. Sin este
 * filtro, un enlace con `?siguiente=https://otro-sitio` usaría nuestro dominio
 * para mandar a la gente afuera justo después de identificarse. Se exige una
 * barra inicial y se rechaza `//`, que el navegador lee como otro dominio.
 */
function rutaInterna(valor: string | null) {
  if (!valor || !valor.startsWith("/") || valor.startsWith("//")) return null;
  return valor;
}

/**
 * Regreso de Google y de los enlaces por correo: cambia el código de un solo
 * uso por una sesión y manda a cada quien a donde le toca. Si la cuenta es
 * nueva, su perfil todavía no tiene rol confirmado y cae en /elegir-rol.
 *
 * El correo para restablecer la contraseña pasa por aquí con
 * `?siguiente=/cambiar-contrasena`: la sesión que abre ese enlace es lo único
 * que autoriza a poner una contraseña nueva.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const codigo = searchParams.get("code");
  const siguiente = rutaInterna(searchParams.get("siguiente"));

  if (!codigo) {
    return NextResponse.redirect(`${origin}/login?error=enlace`);
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.exchangeCodeForSession(codigo);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=enlace`);
  }

  if (siguiente) return NextResponse.redirect(`${origin}${siguiente}`);

  // perfilActual() filtra por id. Un `.single()` suelto sobre perfiles falla
  // justo para los administradores: su política les deja ver todos los
  // perfiles, así que la consulta devolvería varias filas.
  const perfil = await perfilActual();

  return NextResponse.redirect(
    `${origin}${perfil ? destinoSegunRol(perfil) : "/cuenta"}`,
  );
}
