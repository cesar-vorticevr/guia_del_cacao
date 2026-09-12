import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { perfilActual } from "@/lib/auth/sesion";
import { cerrarSesion } from "@/lib/auth/acciones";
import { FormularioContrasenaNueva } from "@/components/formularios-auth";
import { Pestanas } from "@/components/negocio/pestanas";
import { cuantosFavoritos } from "@/lib/datos/favoritos";

export const metadata: Metadata = { title: "Mi cuenta · Guía del Cacao" };

/**
 * La cuenta del visitante: **Tus datos** y **Sesión**, con la misma fila de
 * pestañas que usa el panel del negocio.
 *
 * Antes iba todo en una columna —marcador, solicitudes, reseñas, salir— y
 * llegar a cerrar sesión era bajar tres pantallas. Son cosas que no se hacen
 * juntas: se entra a corregir un dato, o a salir.
 *
 * **Los favoritos no viven aquí**, sino como filtro del explorador. Son una
 * herramienta para elegir a dónde ir, y elegir se hace mirando el directorio,
 * no dentro de la pantalla de la cuenta. Lo único que queda de ellos aquí es
 * el atajo de abajo, para quien los busque donde estaban.
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

  // Solo el número, para el atajo al explorador. La lista se ve allá.
  const favoritos = await cuantosFavoritos(perfil.id);

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

      {/*
        El atajo a donde se fueron. Quien guardó un negocio con el corazón lo
        va a buscar aquí la primera vez, y una cuenta que no menciona sus
        favoritos se lee como si se hubieran perdido.
      */}
      {favoritos > 0 && (
        <Link
          href="/directorio?favoritos=1"
          className="flex items-center justify-between gap-3 rounded-3xl border-2 border-guayaba/40 bg-guayaba/10 px-5 py-4 text-cacao transition-colors hover:border-guayaba"
        >
          <span>
            <strong className="block font-display text-lg text-selva-2">
              Tienes {favoritos}{" "}
              {favoritos === 1 ? "negocio guardado" : "negocios guardados"}
            </strong>
            Se ven en el explorador, con el filtro de favoritos puesto.
          </span>
          <span aria-hidden="true" className="shrink-0 font-bold text-selva">
            →
          </span>
        </Link>
      )}

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
