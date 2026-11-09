import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { FormularioCeder, FormularioCompartir, FormularioDejar } from "@/components/negocio/equipo";
import { Aviso } from "@/components/formulario";
import { perfilActual } from "@/lib/auth/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { marcaActiva, SOLO_EL_DUENO } from "@/lib/negocio/marca-activa";
import { quitarAdministrador } from "@/lib/negocio/equipo";

export const metadata: Metadata = { title: "Administradores · Guía del Cacao" };

type Integrante = {
  perfil_id: string;
  nombre: string;
  usuario: string;
  papel: "dueno" | "admin";
};

/**
 * Quién administra el negocio activo (cuentas compartidas, fase 3).
 *
 * El dueño agrega por @usuario, quita y cede; un administrador ve al equipo y
 * puede irse. Lo que cada quien puede hacer lo decide la base (000079): esta
 * pantalla solo enseña los botones que le van a funcionar.
 */
export default async function Equipo({
  searchParams,
}: {
  searchParams: Promise<{ solo?: string }>;
}) {
  const { solo } = await searchParams;
  const perfil = await perfilActual();

  if (!perfil) redirect("/login");
  if (perfil.rol !== "negocio") redirect("/cuenta");

  const marca = await marcaActiva();
  if (!marca) redirect("/negocio/completar-marca");

  const supabase = await crearClienteServidor();
  const { data } = await supabase.rpc("administradores_de", { p_marca: marca.marca_id });
  const equipo = (data ?? []) as Integrante[];
  const soyDueno = marca.papel === "dueno";

  return (
    <div className="grid max-w-2xl gap-10">
      <div>
        <h1 className="font-display text-3xl">Administradores</h1>
        <p className="mt-2 text-cacao">
          Quién puede editar <strong className="text-selva-2">{marca.nombre_comercial}</strong>. Los
          administradores cambian el micrositio, el catálogo, los eventos y la ruleta, y atienden los
          pedidos. Pagar el plan, publicar, anotar la cuenta bancaria y compartir es del dueño.
        </p>
      </div>

      {solo === "dueno" && <Aviso>{SOLO_EL_DUENO}</Aviso>}

      <ul className="grid gap-3">
        {equipo.map((p) => (
          <li
            key={p.perfil_id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border-2 border-selva/15 p-4"
          >
            <span>
              <span className="block font-bold text-selva-2">
                {p.nombre}
                {p.perfil_id === perfil.id && <span className="font-normal text-cacao/70"> (tú)</span>}
              </span>
              <span className="block font-mono text-sm text-cacao/80">@{p.usuario}</span>
            </span>
            <span className="flex items-center gap-3">
              <span
                className={`rounded-full px-3 py-1 font-mono text-xs font-bold uppercase ${
                  p.papel === "dueno" ? "bg-mango text-ink" : "bg-ink/10 text-cacao"
                }`}
              >
                {p.papel === "dueno" ? "Dueño" : "Administra"}
              </span>
              {soyDueno && p.papel === "admin" && (
                <form action={quitarAdministrador}>
                  <input type="hidden" name="perfil_id" value={p.perfil_id} />
                  <button className="text-sm font-bold text-guayaba underline">Quitar</button>
                </form>
              )}
            </span>
          </li>
        ))}
      </ul>

      {soyDueno ? (
        <>
          <section className="grid gap-4 rounded-3xl border-2 border-selva/15 p-6">
            <FormularioCompartir />
          </section>

          <details className="rounded-3xl border-2 border-guayaba/30 p-6">
            <summary className="cursor-pointer font-display text-xl">Ceder el negocio</summary>
            <p className="mt-3 text-cacao">
              Para cuando armaste el negocio de otra persona y se lo entregas, o cambia el dueño. Los
              cobros siguen con la tarjeta registrada hasta que el nuevo dueño la cambie en Tu plan.
            </p>
            <div className="mt-4">
              <FormularioCeder negocio={marca.nombre_comercial} />
            </div>
          </details>
        </>
      ) : (
        <section className="grid gap-4 rounded-3xl border-2 border-selva/15 p-6">
          <FormularioDejar negocio={marca.nombre_comercial} />
        </section>
      )}
    </div>
  );
}
