import { redirect } from "next/navigation";
import { BarraInferior } from "@/components/publico/barra-inferior";
import { CieloMagico } from "@/components/publico/cielo-magico";
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
    /*
      El panel va de noche, con el mismo cielo que el sitio: es la misma
      plataforma, no un cuarto de servicio. `isolate` le da al cielo un
      contexto propio para que quede detrás del contenido.
    */
    <div className="noche relative isolate min-h-screen">
      <CieloMagico />
      {/* El hueco de abajo es el alto de la barra: sin él, tapa el último
          botón de cada formulario justo cuando hay que tocarlo. */}
      <div className="relative pb-28 sm:pb-12">{children}</div>

      <BarraInferior
        monedas={null}
        destinoPerfil={pestana.destino}
        etiquetaPerfil={pestana.etiqueta}
        iconoPerfil={pestana.icono}
      />
    </div>
  );
}
