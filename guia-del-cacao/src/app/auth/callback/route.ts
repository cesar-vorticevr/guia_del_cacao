import { NextResponse } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/server";
import { destinoSegunRol, perfilActual } from "@/lib/auth/sesion";

/**
 * Regreso de Google: cambia el código de un solo uso por una sesión y manda a
 * cada quien a donde le toca. Si la cuenta es nueva, su perfil todavía no tiene
 * rol confirmado y cae en /elegir-rol.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const codigo = searchParams.get("code");

  if (!codigo) {
    return NextResponse.redirect(`${origin}/login?error=google`);
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.exchangeCodeForSession(codigo);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=google`);
  }

  // perfilActual() filtra por id. Un `.single()` suelto sobre perfiles falla
  // justo para los administradores: su política les deja ver todos los
  // perfiles, así que la consulta devolvería varias filas.
  const perfil = await perfilActual();

  return NextResponse.redirect(
    `${origin}${perfil ? destinoSegunRol(perfil) : "/cuenta"}`,
  );
}
