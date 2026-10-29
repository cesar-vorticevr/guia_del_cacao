import Link from "next/link";
import { redirect } from "next/navigation";
import { BarraSesion } from "@/components/barra-sesion";
import { BarraInferior } from "@/components/publico/barra-inferior";
import { CieloMagico } from "@/components/publico/cielo-magico";
import { perfilActual } from "@/lib/auth/sesion";
import { pestanaDePerfil } from "@/lib/auth/navegacion";

const SECCIONES = [
  { href: "/admin", texto: "Resumen" },
  { href: "/admin/micrositios", texto: "Micrositios" },
  { href: "/admin/metricas", texto: "Métricas" },
  { href: "/admin/convenios", texto: "Códigos" },
  { href: "/admin/embajadores", texto: "Ventas" },
  { href: "/admin/moderacion", texto: "Moderación" },
  { href: "/admin/usuarios", texto: "Personas" },
];

/**
 * El rol admin no es autoregistrable (spec §2). La comprobación vive aquí, en
 * el layout, para que valga en toda la sección y no haya que repetirla —ni
 * olvidarla— en cada pantalla nueva.
 */
export default async function LayoutAdmin({ children }: LayoutProps<"/admin">) {
  const perfil = await perfilActual();

  if (!perfil) redirect("/login");
  if (perfil.rol !== "admin") redirect("/cuenta");

  const pestana = pestanaDePerfil(perfil);

  return (
    /*
      El panel también va de noche, con el mismo cielo que el sitio: es la
      misma plataforma. `isolate` le da al cielo un contexto propio para que
      quede detrás del contenido y no detrás del fondo de la página.
    */
    <div className="noche relative isolate min-h-screen">
      <CieloMagico />
      <BarraSesion nombre={perfil.nombre} cuenta="/admin/cuenta" />

      <nav aria-label="Administración" className="border-b border-mango/15 bg-white/5 backdrop-blur-md">
        <ul className="mx-auto flex w-[92vw] max-w-5xl gap-1 overflow-x-auto [scrollbar-width:none]">
          {SECCIONES.map((seccion) => (
            <li key={seccion.href} className="shrink-0">
              <Link
                href={seccion.href}
                className="block px-4 py-3.5 font-bold text-crema/85 transition-colors hover:text-mango"
              >
                {seccion.texto}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <main className="relative mx-auto w-[92vw] max-w-5xl py-8 pb-28 sm:pb-12">{children}</main>

      <BarraInferior
        monedas={null}
        destinoPerfil={pestana.destino}
        etiquetaPerfil={pestana.etiqueta}
        iconoPerfil={pestana.icono}
      />
    </div>
  );
}
