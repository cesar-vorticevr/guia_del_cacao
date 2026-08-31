import { headers } from "next/headers";
import { crearClienteServidor } from "@/lib/supabase/server";

export type Rol = "cliente" | "negocio" | "admin";

export type Perfil = {
  id: string;
  rol: Rol;
  rol_confirmado: boolean;
  nombre: string;
  correo: string;
  foto_perfil: string | null;
  /** Cuándo abrió el enlace que se le mandó al correo. Null = sin verificar. */
  correo_verificado_en: string | null;
};

/**
 * Perfil de quien está navegando, o null si nadie inició sesión.
 *
 * Usa getUser() y no getSession(): getSession() solo lee la cookie, que el
 * navegador puede traer alterada. getUser() la revalida contra el servidor.
 */
export async function perfilActual(): Promise<Perfil | null> {
  const supabase = await crearClienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from("perfiles")
    .select("id, rol, rol_confirmado, nombre, correo, foto_perfil, correo_verificado_en")
    .eq("id", user.id)
    .single();

  return (data as Perfil) ?? null;
}

/** A dónde mandar a cada quien después de entrar. */
export function destinoSegunRol(perfil: Pick<Perfil, "rol" | "rol_confirmado">) {
  if (!perfil.rol_confirmado) return "/elegir-rol";

  switch (perfil.rol) {
    case "negocio":
      return "/negocio/panel";
    case "admin":
      return "/admin";
    default:
      return "/cuenta";
  }
}

/**
 * Origen público del sitio, para armar la URL de retorno de Google.
 *
 * En producción conviene fijar NEXT_PUBLIC_SITE_URL: detrás de un proxy la
 * cabecera host puede no ser el dominio real que ve el usuario.
 */
export async function origenDelSitio() {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }

  const cabeceras = await headers();
  const host = cabeceras.get("x-forwarded-host") ?? cabeceras.get("host");
  const protocolo =
    cabeceras.get("x-forwarded-proto") ??
    (host?.startsWith("localhost") || host?.startsWith("127.") ? "http" : "https");

  return `${protocolo}://${host}`;
}
