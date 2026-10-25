import { Logotipo } from "@/components/marca";
import { CieloMagico } from "@/components/publico/cielo-magico";

/**
 * Entrar, registrarse, recuperar la contraseña.
 *
 * Van sobre la misma selva de noche que el sitio público: crear una cuenta es
 * entrar a la guía, no salir de ella. La barra de arriba es de cristal, así
 * que el cielo sube por debajo hasta el borde de la pantalla.
 */
export default function LayoutAuth({ children }: { children: React.ReactNode }) {
  return (
    <div className="noche relative isolate flex min-h-screen flex-col">
      <CieloMagico />

      <header className="barra-cristal relative z-10 flex h-16 items-center">
        <div className="mx-auto w-[92vw] max-w-[1180px]">
          <Logotipo />
        </div>
      </header>

      <main className="relative z-10 mx-auto w-[92vw] max-w-md flex-1 py-8 sm:py-12">
        {children}
      </main>
    </div>
  );
}
