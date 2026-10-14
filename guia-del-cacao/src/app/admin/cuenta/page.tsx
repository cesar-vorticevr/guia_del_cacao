import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FormularioContrasenaNueva } from "@/components/formularios-auth";
import { cerrarSesion } from "@/lib/auth/acciones";
import { perfilActual } from "@/lib/auth/sesion";

export const metadata: Metadata = { title: "Mi cuenta · Guía del Cacao" };

/**
 * La cuenta del administrador: quién es, su contraseña y cerrar sesión.
 *
 * El botón con su nombre, arriba a la derecha, apuntaba a la cuenta del
 * negocio; esa pantalla lo devolvía a `/admin` por no ser negocio, y el
 * administrador no tenía por dónde salir. Ahora `BarraSesion` recibe a dónde
 * lleva y el layout de administración lo manda aquí.
 */
export default async function CuentaAdmin() {
  const perfil = await perfilActual();
  if (!perfil) redirect("/login");

  return (
    <div className="grid max-w-xl gap-10">
      <div>
        <h1 className="font-display text-3xl">Mi cuenta</h1>
        <p className="mt-3 text-cacao">
          <strong className="text-selva-2">{perfil.nombre}</strong>
          <span className="block font-mono text-sm text-cacao/70">{perfil.correo}</span>
          <span className="mt-1 block text-sm text-cacao/70">Administrador</span>
        </p>
      </div>

      <section className="grid gap-4">
        <div>
          <h2 className="font-display text-xl">Cambiar mi contraseña</h2>
          <p className="mt-1 text-cacao">
            Escríbela dos veces. La anterior deja de servir en cuanto guardes.
          </p>
        </div>
        <FormularioContrasenaNueva />
      </section>

      <section className="grid gap-4">
        <div>
          <h2 className="font-display text-xl">Sesión</h2>
          <p className="mt-1 text-cacao">
            Se cierra en este dispositivo. Para volver al panel, entra otra vez
            con tu correo.
          </p>
        </div>

        <form action={cerrarSesion}>
          <button
            type="submit"
            className="min-h-12 w-full rounded-full border-2 border-selva/25 bg-white px-6 font-bold text-selva-2 transition-transform active:translate-y-0.5"
          >
            Cerrar sesión
          </button>
        </form>
      </section>
    </div>
  );
}
