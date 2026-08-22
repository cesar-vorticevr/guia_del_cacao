import Link from "next/link";
import { redirect } from "next/navigation";
import { BarraSesion } from "@/components/barra-sesion";
import { BarraInferior } from "@/components/publico/barra-inferior";
import { perfilActual } from "@/lib/auth/sesion";
import { pestanaDePerfil } from "@/lib/auth/navegacion";

const SECCIONES = [
  { href: "/admin", texto: "Por revisar" },
  { href: "/admin/micrositios", texto: "Micrositios" },
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
    <>
      <BarraSesion nombre={perfil.nombre} />

      <nav aria-label="Administración" className="border-b-2 border-selva/10 bg-crema-2">
        <ul className="mx-auto flex w-[92vw] max-w-3xl gap-1 overflow-x-auto">
          {SECCIONES.map((seccion) => (
            <li key={seccion.href} className="shrink-0">
              <Link
                href={seccion.href}
                className="block px-4 py-3.5 font-bold text-selva-2"
              >
                {seccion.texto}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <main className="mx-auto w-[92vw] max-w-3xl py-8 pb-28 sm:pb-8">{children}</main>

      <BarraInferior
        monedas={null}
        destinoPerfil={pestana.destino}
        etiquetaPerfil={pestana.etiqueta}
        iconoPerfil={pestana.icono}
      />
    </>
  );
}
