import { createClient } from "@supabase/supabase-js";

/**
 * Cliente de Supabase con la llave de servicio: se salta RLS.
 *
 * **Solo para el webhook de Stripe** (`/api/stripe/webhook`), que llega sin
 * sesión de nadie y tiene que abrir suscripciones y volver a publicar
 * micrositios cuando un pago entra. Ninguna pantalla ni acción de usuario
 * debe usarlo: ahí quien decide es RLS. La excepción son las cuentas de
 * ventas (`lib/admin/embajadores.ts`): crear un usuario con su contraseña solo
 * se puede con esta llave, y la acción comprueba antes que llama el
 * administrador.
 *
 * La llave (`SUPABASE_SERVICE_ROLE_KEY`) vive solo en el servidor —en Vercel,
 * sin el prefijo `NEXT_PUBLIC_`— y nunca llega al navegador. Este archivo no
 * se importa desde un componente de cliente.
 */
export function crearClienteDeServicio() {
  const llave = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!llave) {
    throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY: el webhook de Stripe la necesita.");
  }

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, llave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
