import Link from "next/link";
import { Logotipo } from "@/components/marca";
import { perfilActual, destinoSegunRol } from "@/lib/auth/sesion";

const CATEGORIAS = [
  "Productora / Finca",
  "Comercializadora",
  "Chocolatería",
  "Museo",
  "Artesanías",
  "Otros servicios",
];

/**
 * Portada provisional. Verifica que la paleta y las tipografías del prototipo
 * estén cargando; el home real (banner rotativo, directorio) llega en su fase.
 */
export default async function Home() {
  const perfil = await perfilActual();

  return (
    <>
      <header className="sticky top-0 z-40 bg-selva py-3.5 text-crema">
        <div className="mx-auto flex w-[92vw] max-w-[1180px] items-center justify-between gap-4">
          <Logotipo />

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

      <main className="mx-auto w-[92vw] max-w-[1180px] py-10">
        <h1 className="font-display text-3xl leading-tight sm:text-4xl">
          El cacao de Tabasco, en un solo lugar
        </h1>
        <p className="mt-3 max-w-prose text-lg text-cacao">
          Directorio de productoras, chocolaterías y museos; eventos de la feria
          y un pasaporte digital de puntos que funciona todo el año.
        </p>

        <ul className="mt-8 flex flex-wrap gap-2.5">
          {CATEGORIAS.map((categoria) => (
            <li
              key={categoria}
              className="rounded-full border-2 border-selva/15 bg-crema-2 px-4 py-2 text-sm font-bold text-selva-2"
            >
              {categoria}
            </li>
          ))}
        </ul>

        <p className="mt-10 font-mono text-xs text-cacao/70">
          Cimientos listos · Next.js + Supabase
        </p>
      </main>
    </>
  );
}
