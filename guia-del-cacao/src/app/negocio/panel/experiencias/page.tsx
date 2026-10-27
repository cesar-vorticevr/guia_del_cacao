import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { origenDelSitio, perfilActual } from "@/lib/auth/sesion";
import { cupoDe, experienciasDe, marcaDe, visibles } from "@/lib/datos/experiencias";
import { crearExperiencia } from "@/lib/negocio/experiencias";
import { linkDe, PRECIO_EXPERIENCIA_EXTRA, urlDeArchivo } from "@/lib/experiencias";
import { Tablero } from "@/components/experiencias/tablero";
import { ComprarExtra } from "@/components/experiencias/comprar-extra";
import { PoweredByVortice } from "@/components/experiencias/powered-by-vortice";

export const metadata: Metadata = { title: "Realidad aumentada · Guía del Cacao" };

/**
 * El tablero de experiencias de realidad aumentada (migración 000066), como
 * «Mis experiencias» de Vórtice VR. Gratis arma todas las que quiera; Pro
 * publica tres y suma más de una en una.
 */
export default async function PanelExperiencias({
  searchParams,
}: {
  searchParams: Promise<{ pago?: string; error?: string }>;
}) {
  const { pago, error } = await searchParams;
  const perfil = await perfilActual();

  if (!perfil) redirect("/login");
  if (!perfil.rol_confirmado) redirect("/elegir-rol");
  if (perfil.rol !== "negocio") redirect("/cuenta");

  const marca = await marcaDe(perfil.id);
  if (!marca) redirect("/negocio/completar-marca");

  const [experiencias, cupo, origen] = await Promise.all([
    experienciasDe(marca.id),
    cupoDe(marca.id),
    origenDelSitio(),
  ]);

  const seVen = visibles(experiencias, cupo);
  const publicadas = experiencias.filter((e) => e.estado === "publicada").length;
  const conPro = cupo > 0;

  return (
    <div className="grid gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="antetitulo">Powered by Vórtice VR</p>
          <h1 className="mt-2 font-display text-3xl">Realidad aumentada</h1>
          <p className="mt-2 max-w-prose text-cacao">
            Sube una imagen —tu tarjeta, tu empaque, tu cartel— y ponle encima videos, imágenes y
            textos. Quien la enfoca con su celular la ve cobrar vida.
          </p>
        </div>
        <form action={crearExperiencia}>
          <button
            type="submit"
            className="boton-oro brillo inline-flex min-h-12 items-center gap-2 rounded-full px-6 font-bold text-ink"
          >
            <span aria-hidden="true">✦</span> Crear experiencia
          </button>
        </form>
      </header>

      {pago === "listo" && (
        <p role="status" className="rounded-2xl bg-lima/25 px-4 py-3 font-bold text-selva-2">
          ¡Gracias! En cuanto Stripe confirme el pago tendrás una experiencia más.
        </p>
      )}
      {pago === "cancelado" && (
        <p className="rounded-2xl bg-ink/5 px-4 py-3 text-cacao">No se hizo ningún cargo.</p>
      )}
      {error === "crear" && (
        <p role="alert" className="rounded-2xl bg-guayaba/15 px-4 py-3 font-bold text-cacao">
          No se pudo crear la experiencia. Inténtalo de nuevo.
        </p>
      )}

      <section
        className={`flex flex-wrap items-center justify-between gap-5 rounded-3xl border-2 p-6 ${
          conPro ? "border-mango/50 bg-white shadow-[0_0_30px_rgb(255_183_3/0.18)]" : "border-mango/50 bg-crema-2"
        }`}
      >
        {conPro ? (
          <>
            <div>
              <p className="antetitulo">Tu plan Pro</p>
              <p className="mt-2 font-display text-4xl">
                <span className="texto-oro">{publicadas}</span>
                <span className="text-cacao/60"> de {cupo}</span>
              </p>
              <p className="text-sm text-cacao">
                experiencias publicadas
                {marca.experiencias_extra > 0 && ` (3 del plan + ${marca.experiencias_extra} extra)`}
              </p>
            </div>
            <ComprarExtra />
          </>
        ) : (
          <>
            <div className="max-w-prose">
              <p className="antetitulo">Arma gratis, publica con Pro</p>
              <p className="mt-2 text-cacao">
                Puedes crear y editar tus experiencias sin pagar. Para publicarlas —que su link y su QR
                funcionen para todos— necesitas el plan <strong>Pro</strong>: trae 3 experiencias, y cada
                una más cuesta ${PRECIO_EXPERIENCIA_EXTRA} de un solo pago.
              </p>
            </div>
            <Link
              href="/negocio/panel/cuenta"
              className="boton-oro brillo inline-flex min-h-12 items-center rounded-full px-6 font-bold text-ink"
            >
              Pasarme a Pro · $499/mes
            </Link>
          </>
        )}
      </section>

      {experiencias.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-mango/50 bg-white p-8 text-center">
          <p className="font-display text-2xl">Todavía no tienes experiencias</p>
          <p className="mx-auto mt-2 max-w-prose text-cacao">
            Elige una imagen que tus clientes tengan a la mano y ponle un video encima: tu historia,
            cómo se hace tu chocolate, una promoción.
          </p>
          <form action={crearExperiencia} className="mt-5">
            <button
              type="submit"
              className="boton-oro brillo inline-flex min-h-12 items-center rounded-full px-6 font-bold text-ink"
            >
              Crear mi primera experiencia
            </button>
          </form>
        </div>
      ) : (
        <Tablero
          puedePublicar={conPro}
          experiencias={experiencias.map((e) => ({
            id: e.id,
            codigo: e.codigo,
            titulo: e.titulo,
            estado: e.estado,
            seVe: seVen.has(e.id),
            vistas: e.vistas,
            miniatura: urlDeArchivo(e.imagen),
            link: linkDe(origen, e.codigo),
            elementos: e.elementos.length,
          }))}
        />
      )}

      <PoweredByVortice />
    </div>
  );
}
