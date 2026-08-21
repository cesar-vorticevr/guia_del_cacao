import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refresca el token de sesión en cada navegación.
 *
 * Sin esto, los Server Components pueden recibir un token vencido y tratar al
 * usuario como anónimo. No decide permisos: eso lo resuelve RLS en Postgres.
 */
export async function proxy(request: NextRequest) {
  let respuesta = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesNuevas) {
          for (const { name, value } of cookiesNuevas) {
            request.cookies.set(name, value);
          }
          respuesta = NextResponse.next({ request });
          for (const { name, value, options } of cookiesNuevas) {
            respuesta.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // getUser() revalida contra el servidor de Auth; getSession() solo lee la
  // cookie y no basta para confiar en la identidad.
  await supabase.auth.getUser();

  return respuesta;
}

export const config = {
  matcher: [
    /*
     * Todo menos archivos estáticos e imágenes: no tiene caso refrescar la
     * sesión al servir un logo.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
