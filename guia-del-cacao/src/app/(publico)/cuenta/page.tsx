import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { perfilActual } from "@/lib/auth/sesion";
import { cerrarSesion } from "@/lib/auth/acciones";
import { FormularioContrasenaNueva } from "@/components/formularios-auth";
import { Pestanas } from "@/components/negocio/pestanas";

export const metadata: Metadata = { title: "Mi cuenta · Guía del Cacao" };

/**
 * La cuenta del visitante: **Tus datos** y **Sesión**, con la misma fila de
 * pestañas que usa el panel del negocio.
 *
 * Antes iba todo en una columna —marcador, solicitudes, reseñas, salir— y
 * llegar a cerrar sesión era bajar tres pantallas. Son cosas que no se hacen
 * juntas: se entra a corregir un dato, o a salir.
 *
 * **Los favoritos no se nombran aquí.** Viven como filtro del explorador, que
 * es donde se usan: son una herramienta para elegir a dónde ir, y elegir se
 * hace mirando el directorio. Hubo un atajo con su contador y también se fue —
 * la cuenta es para los datos de la cuenta, no un tablero de todo.
 */
export default async function Cuenta({
  searchParams,
}: {
  searchParams: Promise<{ ver?: string }>;
}) {
  const { ver } = await searchParams;
  const perfil = await perfilActual();

  if (!perfil) redirect("/login");
  if (!perfil.rol_confirmado) redirect("/elegir-rol");

  // Esta pantalla es la del visitante. Un negocio o un administrador que
  // llegue aquí —por un enlace viejo o escribiendo la ruta— va a la suya: aquí
  // solo encontraría una lista de favoritos que su cuenta no puede tener.
  if (perfil.rol === "negocio") redirect("/negocio/panel/cuenta");
  if (perfil.rol === "admin") redirect("/admin");

  const seccion = ver === "sesion" ? "sesion" : "datos";

  return (
    <div className="mx-auto grid max-w-3xl gap-6 py-8">
      <h1 className="font-display text-3xl">Hola, {perfil.nombre}</h1>

      <Pestanas
        base="/cuenta"
        actual={seccion}
        pestanas={[
          { clave: "datos", texto: "Tus datos" },
          { clave: "sesion", texto: "Sesión" },
        ]}
      />

      {seccion === "datos" && (
        <section className="grid gap-6">
          <div>
            <h2 className="font-display text-2xl">Tus datos</h2>
            <p className="mt-1 text-cacao">
              Con esto entras a tu cuenta.
            </p>
          </div>

          <dl className="grid gap-3 rounded-3xl bg-crema-2 p-6">
            <div>
              <dt className="text-sm font-bold text-selva-2">Nombre</dt>
              <dd className="text-cacao">{perfil.nombre}</dd>
            </div>
            <div>
              <dt className="text-sm font-bold text-selva-2">Correo</dt>
              <dd className="text-cacao">{perfil.correo}</dd>
            </div>
          </dl>

          <div className="grid gap-4 rounded-3xl border-2 border-selva/15 p-6">
            <div>
              <h3 className="font-display text-xl text-selva-2">
                Cambiar tu contraseña
              </h3>
              {/*
                Se escribe dos veces y el formulario compara: es el mismo
                componente del enlace de recuperación, así que una errata no
                deja a nadie fuera de su cuenta por ninguno de los dos caminos.
              */}
              <p className="mt-1 text-cacao">
                Escríbela dos veces. Al guardarla, la nueva es con la que
                entras.
              </p>
            </div>

            <FormularioContrasenaNueva />
          </div>
        </section>
      )}

      {seccion === "sesion" && (
        <section className="grid gap-4">
          <div>
            <h2 className="font-display text-2xl">Sesión</h2>
            <p className="mt-1 text-cacao">
              Se cierra en este dispositivo. Tus favoritos y tus reseñas se
              quedan como están.
            </p>
          </div>

          <form action={cerrarSesion}>
            <button
              type="submit"
              className="min-h-14 w-full rounded-full border-2 border-selva/25 bg-white px-6 font-display text-lg font-semibold text-selva-2 transition-colors hover:border-selva"
            >
              Cerrar sesión
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
