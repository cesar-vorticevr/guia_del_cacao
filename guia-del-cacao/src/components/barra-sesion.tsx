import { cerrarSesion } from "@/lib/auth/acciones";
import { Logotipo } from "@/components/marca";

export function BarraSesion({ nombre }: { nombre: string }) {
  return (
    <header className="bg-selva py-3.5 text-crema">
      <div className="mx-auto flex w-[92vw] max-w-[1180px] items-center justify-between gap-4">
        <Logotipo />

        <div className="flex items-center gap-3">
          <span className="hidden text-sm sm:inline">{nombre}</span>
          <form action={cerrarSesion}>
            <button
              type="submit"
              className="min-h-10 rounded-full border-2 border-crema/30 px-4 text-sm font-bold transition-colors hover:border-crema"
            >
              Salir
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
