import { redirect } from "next/navigation";
import { BarraInferior } from "@/components/publico/barra-inferior";
import { perfilActual } from "@/lib/auth/sesion";
import { pestanaDePerfil } from "@/lib/auth/navegacion";

/**
 * Armazón del panel de negocio.
 *
 * Existe por dos razones. La comprobación de rol vale aquí para toda la
 * sección, en vez de repetirse —y olvidarse— en cada pantalla nueva. Y la
 * barra de abajo viaja con el negocio: antes, al entrar a su panel desde el
 * celular, se quedaba sin forma de volver al sitio.
 */
export default async function LayoutNegocio({ children }: LayoutProps<"/negocio">) {
  const perfil = await perfilActual();

  if (!perfil) redirect("/login");
  if (perfil.rol !== "negocio") redirect("/cuenta");

  const pestana = pestanaDePerfil(perfil);

  return (
    <>
      {/* El hueco de abajo es el alto de la barra: sin él, tapa el último
          botón de cada formulario justo cuando hay que tocarlo. */}
      <div className="pb-28 sm:pb-0">{children}</div>

      <BarraInferior
        monedas={null}
        destinoPerfil={pestana.destino}
        etiquetaPerfil={pestana.etiqueta}
        iconoPerfil={pestana.icono}
      />
    </>
  );
}
