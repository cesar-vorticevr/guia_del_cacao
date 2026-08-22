import Link from "next/link";
import { Logotipo } from "@/components/marca";
import { BarraInferior } from "@/components/publico/barra-inferior";
import { PastillaPasaporte } from "@/components/publico/pastilla-pasaporte";
import { destinoSegunRol, perfilActual } from "@/lib/auth/sesion";
import { pasaporteDe } from "@/lib/datos/puntos";

const SECCIONES = [
  { href: "/directorio", texto: "Explorar" },
  { href: "/eventos", texto: "Eventos" },
  { href: "/noticias", texto: "Noticias" },
];

/**
 * Armazón del sitio público. Mobile-first: en celular la navegación vive en una
 * barra fija abajo, al alcance del pulgar; en escritorio sube al encabezado.
 *
 * El pasaporte se ve siempre, en las dos: pastilla en el encabezado y contador
 * en la barra de abajo. Es a propósito — ver el número subir es lo que hace
 * que la persona quiera seguir explorando.
 */
export default async function LayoutPublico({
  children,
}: {
  children: React.ReactNode;
}) {
  const perfil = await perfilActual();

  // Solo los clientes juntan monedas; un negocio o un administrador no tienen
  // pasaporte que enseñar.
  const esCliente = perfil?.rol === "cliente" && perfil.rol_confirmado;
  const pasaporte = esCliente ? await pasaporteDe(perfil.id) : null;

  return (
    <>
      <header className="sticky top-0 z-40 bg-selva py-3.5 text-crema">
        <div className="mx-auto flex w-[92vw] max-w-[1180px] items-center justify-between gap-4">
          <Logotipo />

          <nav className="hidden gap-1 sm:flex" aria-label="Secciones">
            {SECCIONES.map((seccion) => (
              <Link
                key={seccion.href}
                href={seccion.href}
                className="rounded-full px-3 py-2 font-bold transition-colors hover:bg-selva-2"
              >
                {seccion.texto}
              </Link>
            ))}
          </nav>

          {pasaporte ? (
            <PastillaPasaporte puntos={pasaporte.puntos} nivel={pasaporte.nivel} />
          ) : perfil ? (
            <Link
              href={destinoSegunRol(perfil)}
              className="min-h-10 rounded-full bg-mango px-4 py-2 text-sm font-bold text-ink"
            >
              Mi cuenta
            </Link>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login" className="px-2 py-2 text-sm font-bold">
                Entrar
              </Link>
              <Link
                href="/registro"
                className="min-h-10 rounded-full bg-mango px-4 py-2 text-sm font-bold text-ink"
              >
                Crear cuenta
              </Link>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto w-[92vw] max-w-[1180px] pb-28 sm:pb-10">{children}</main>

      <BarraInferior
        monedas={pasaporte?.puntos ?? null}
        destinoPasaporte={perfil ? destinoSegunRol(perfil) : "/login"}
      />
    </>
  );
}
