import { redirect } from "next/navigation";
import { BarraSesion } from "@/components/barra-sesion";
import { PestanasDelPanel } from "@/components/negocio/pestanas-del-panel";
import { solicitudesPorSucursal } from "@/lib/datos/notificaciones";
import { catalogoDeMarca } from "@/lib/datos/catalogo";
import { cuposLibres, misCupones, TOPE_CUPONES } from "@/lib/datos/cupones";
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
    /*
      La categoría se pide **por su llave**, no como `categorias(nombre)`.
      Desde que un negocio puede tener varias (migración 000042) hay dos caminos
      de `marcas` a `categorias` —la columna `categoria_id` y la tabla puente—
      y PostgREST responde PGRST201 sin elegir ninguno. Aquí es la principal, la
      de la columna, que es la que encabeza el panel.

      El error llega como `data` en null, así que se leía igual que "este
      negocio no tiene marca" y el panel entero rebotaba a completar-marca.
    */
    .select("id, nombre_comercial, categorias!marcas_categoria_id_fkey(nombre)")
    .eq("perfil_id", perfil.id);

  if (!marcas || marcas.length === 0) redirect("/negocio/completar-marca");

  const marca = marcas[0];

  const [sucursales, catalogo, solicitudes] = await Promise.all([
    misSucursales(perfil.id),
    catalogoDeMarca(marca.id),
    solicitudesPorSucursal(),
  ]);

  // En la pestaña se cuentan los vigentes, no todos: los caducados no ocupan
  // lugar y ponerlos ahí haría creer que el cupo está lleno.
  const cupones = await misCupones(sucursales.map((s) => s.id));
  const vigentes = TOPE_CUPONES - cuposLibres(cupones);

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
            cupones={vigentes}
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
