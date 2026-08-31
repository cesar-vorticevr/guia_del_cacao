import { redirect } from "next/navigation";
import { BarraSesion } from "@/components/barra-sesion";
import { PestanasDelPanel } from "@/components/negocio/pestanas-del-panel";
import { solicitudesPorSucursal } from "@/lib/datos/notificaciones";
import { catalogoDeMarca } from "@/lib/datos/catalogo";
import { misSucursales } from "@/lib/datos/sucursales";
import { perfilActual } from "@/lib/auth/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";

/**
 * El armazón del panel del negocio: encabezado, nombre de la marca y la fila de
 * pestañas, que ahora acompañan a todas sus pantallas.
 *
 * Antes cada sección lo pintaba por su cuenta, y las que vivían en su propia
 * ruta —Mazorcas, Eventos, Foro— se quedaban sin pestañas: entrar era perder el
 * menú y volver era el botón de atrás del navegador.
 *
 * Las comprobaciones de sesión se repiten en cada página aunque estén aquí: un
 * layout no protege nada por sí solo —Next puede pintar la página sin volver a
 * pasar por él en una navegación de cliente— y confiar la autorización a este
 * archivo dejaría la puerta abierta.
 */
export default async function LayoutDelPanel({
  children,
}: {
  children: React.ReactNode;
}) {
  const perfil = await perfilActual();

  if (!perfil) redirect("/login");
  if (!perfil.rol_confirmado) redirect("/elegir-rol");
  if (perfil.rol !== "negocio") redirect("/cuenta");

  const supabase = await crearClienteServidor();
  const { data: marcas } = await supabase
    .from("marcas")
    .select("id, nombre_comercial, categorias(nombre)")
    .eq("perfil_id", perfil.id);

  if (!marcas || marcas.length === 0) redirect("/negocio/completar-marca");

  const marca = marcas[0];

  const [sucursales, catalogo, solicitudes] = await Promise.all([
    misSucursales(perfil.id),
    catalogoDeMarca(marca.id),
    solicitudesPorSucursal(),
  ]);

  const monedasPendientes = [...solicitudes.values()].reduce(
    (total, s) => total + s.pendientes,
    0,
  );
  const monedasNuevas = [...solicitudes.values()].some((s) => s.nuevas > 0);

  /*
    Sin sucursales el panel enseña el recorrido de alta y nada más: unas pestañas
    que llevan a listas vacías serían cinco caminos a ninguna parte para quien
    todavía no ha empezado. En su lugar queda la vuelta al recorrido, que lo
    decide el componente porque depende de la ruta.
  */
  const empezando = sucursales.length === 0;

  return (
    <>
      <BarraSesion nombre={perfil.nombre} />

      <main className="mx-auto w-[92vw] max-w-[1180px] py-8">
        <p className="font-mono text-xs tracking-wide text-cacao/70 uppercase">
          {(marca.categorias as unknown as { nombre: string } | null)?.nombre}
        </p>
        {/*
          El nombre de la marca no es el h1 de estas pantallas: el h1 lo pone
          cada pestaña («Eventos», «Catálogo»…). Aquí es la tira que dice de
          quién es el panel, y por eso va más chica que el título de abajo.
        */}
        <p className="mt-1 font-display text-2xl text-selva-2">
          {marca.nombre_comercial}
        </p>

        <div className="mt-8">
          <PestanasDelPanel
            sucursales={sucursales.length}
            catalogo={catalogo.length}
            monedasPendientes={monedasPendientes}
            monedasNuevas={monedasNuevas}
            empezando={empezando}
          />
        </div>

        <div className="mt-6">{children}</div>
      </main>
    </>
  );
}
