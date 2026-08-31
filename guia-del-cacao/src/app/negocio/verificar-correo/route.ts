import { NextResponse } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/server";

/**
 * Final del enlace de confirmación de correo.
 *
 * Se llega aquí desde `/auth/callback`, que ya cambió el código por una sesión.
 * Lo único que se hace es pedirle a la base que marque el perfil, y la base
 * vuelve a comprobar por su cuenta que esta sesión venga del correo: la regla
 * está en `marcar_correo_verificado`, no en esta ruta. Si alguien llega aquí
 * con una sesión abierta con contraseña, la función lo rechaza.
 */
export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const supabase = await crearClienteServidor();

  const { error } = await supabase.rpc("marcar_correo_verificado");

  if (error) {
    return NextResponse.redirect(`${origin}/negocio/panel?correo=fallo`);
  }

  return NextResponse.redirect(`${origin}/negocio/panel?correo=listo`);
}
