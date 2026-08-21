import Link from "next/link";
import { Logotipo } from "@/components/marca";
import { destinoSegunRol, perfilActual } from "@/lib/auth/sesion";

const SECCIONES = [
  { href: "/directorio", texto: "Directorio" },
  { href: "/eventos", texto: "Eventos" },
  { href: "/noticias", texto: "Noticias" },
];

/**
 * Armazón del sitio público. Mobile-first: en celular la navegación vive en una
 * barra fija abajo, al alcance del pulgar; en escritorio sube al encabezado.
 */
export default async function LayoutPublico({
  children,
}: {
  children: React.ReactNode;
}) {
  const perfil = await perfilActual();

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

          {perfil ? (
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

      <main className="mx-auto w-[92vw] max-w-[1180px] pb-24 sm:pb-10">{children}</main>

      <nav
        aria-label="Secciones"
        className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-selva/10 bg-crema/95 backdrop-blur sm:hidden"
      >
        <div className="mx-auto grid max-w-md grid-cols-4">
          <Link href="/" className="py-3 text-center text-sm font-bold text-selva-2">
            Inicio
          </Link>
          {SECCIONES.map((seccion) => (
            <Link
              key={seccion.href}
              href={seccion.href}
              className="py-3 text-center text-sm font-bold text-selva-2"
            >
              {seccion.texto}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
