import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { FormularioCancelarSuscripcion } from "@/components/negocio/formularios";
import { FormularioDatosPersonales } from "@/components/negocio/cuenta";
import { PlanesDesplegables } from "@/components/negocio/planes-desplegables";
import { Pestanas } from "@/components/negocio/pestanas";
import { FormularioContrasenaNueva } from "@/components/formularios-auth";
import { cerrarSesion } from "@/lib/auth/acciones";
import { perfilActual } from "@/lib/auth/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import {
  listarTiers,
  misSucursales,
  suscripcionDeMarca,
} from "@/lib/datos/sucursales";
import { PAGO_SIMULADO } from "@/lib/pagos";
import { pesos } from "@/lib/tipos";

export const metadata: Metadata = { title: "Mi cuenta · Guía del Cacao" };

const CUANDO = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/**
 * Días que le quedan a una prueba, redondeando hacia arriba: mientras quede una
 * hora, queda un día. Decir "0 días" a quien todavía puede usarlo hasta la
 * noche sería adelantarle el corte.
 */
function diasDePrueba(fin: string) {
  const faltan = new Date(fin).getTime() - Date.now();
  return Math.max(0, Math.ceil(faltan / 86_400_000));
}

/**
 * La cuenta del negocio, en tres secciones que se cambian con una fila de
 * pestañas: **Tu plan**, **Tus datos** y **Sesión**.
 *
 * Antes iban las tres en una sola columna, y llegar a cerrar sesión era pasar
 * por la tabla de precios y por dos formularios. Son cosas que no se hacen
 * juntas: se entra a mirar el cobro, o a corregir un dato, o a salir.
 *
 * El plan se elige al publicar cada micrositio, porque desde la spec v2 el
 * cobro es por sucursal. Aquí se ve el resumen y se cambia para todas a la vez.
 */
export default async function CuentaNegocio({
  searchParams,
}: {
  searchParams: Promise<{ ver?: string }>;
}) {
  const { ver } = await searchParams;
  const perfil = await perfilActual();

  if (!perfil) redirect("/login");
  if (perfil.rol !== "negocio") redirect("/cuenta");

  const supabase = await crearClienteServidor();
  const { data: marca } = await supabase
    .from("marcas")
    .select("id, nombre_comercial")
    .eq("perfil_id", perfil.id)
    .limit(1)
    .maybeSingle();

  if (!marca) redirect("/negocio/completar-marca");

  const [tiers, suscripcion, sucursales] = await Promise.all([
    listarTiers(),
    suscripcionDeMarca(marca.id),
    misSucursales(perfil.id),
  ]);

  const plan = tiers.find((tier) => tier.id === suscripcion?.tier_id);

  // El plan de arriba, si lo hay. Es lo único que se anuncia: sin siguiente no
  // hay nada que ofrecer, y decirlo igual sería mentir.
  const siguiente = tiers.find(
    (tier) => tier.id === (suscripcion?.tier_id ?? 0) + 1,
  );

  const publicadas = sucursales.filter((s) => s.estado === "publicado").length;

  const seccion =
    ver === "datos" ? "datos" : ver === "sesion" ? "sesion" : "plan";

  return (
    <div className="grid max-w-2xl gap-6">
      <div>
        <Link href="/negocio/panel" className="font-bold text-selva underline">
          ← Panel
        </Link>
        <h1 className="mt-3 font-display text-3xl">Mi cuenta</h1>
      </div>

      <Pestanas
        base="/negocio/panel/cuenta"
        actual={seccion}
        pestanas={[
          { clave: "plan", texto: "Tu plan" },
          { clave: "datos", texto: "Tus datos" },
          { clave: "sesion", texto: "Sesión" },
        ]}
      />

      {seccion === "plan" && (
        <div className="grid gap-8">
          {PAGO_SIMULADO && (
            <p className="rounded-3xl border-2 border-mango/50 bg-mango/15 p-5 text-cacao">
              <strong>Cobro simulado.</strong> Todavía no hay pasarela
              conectada, así que ni se cobra ni se devuelve dinero de verdad. El
              resto del flujo sí es el definitivo.
            </p>
          )}

          {suscripcion ? (
            <div className="rounded-3xl bg-crema-2 p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <p className="font-display text-2xl text-selva-2">
                  {plan?.nombre}
                </p>
                <p className="font-mono text-lg font-bold text-selva">
                  {pesos(suscripcion.monto_mensual)}
                  <span className="text-sm font-normal text-cacao/70">
                    /mes
                  </span>
                </p>
              </div>

              <p className="mt-1 text-sm text-cacao/70">
                {suscripcion.cuantas === 1
                  ? "Un micrositio en este plan"
                  : `${suscripcion.cuantas} micrositios en este plan`}
                {" · se cobra por micrositio"}
              </p>

              {/*
                Durante la prueba la fecha deja de ser un dato de consulta y
                pasa a ser lo que importa, así que sube de la letra chica a su
                propia línea. Y dice qué pasa el día 15, que es justo lo que
                nadie quiere averiguar por sorpresa.
              */}
              {suscripcion.enPrueba && suscripcion.finDePrueba ? (
                <p className="mt-3 rounded-2xl border-2 border-mango/50 bg-mango/15 px-4 py-3 text-cacao">
                  <strong className="block text-selva-2">
                    {diasDePrueba(suscripcion.finDePrueba) <= 0
                      ? "Tu prueba termina hoy"
                      : diasDePrueba(suscripcion.finDePrueba) === 1
                        ? "Te queda 1 día de prueba"
                        : `Te quedan ${diasDePrueba(suscripcion.finDePrueba)} días de prueba`}
                  </strong>
                  Termina el {CUANDO.format(new Date(suscripcion.finDePrueba))}.
                  Si para entonces no has agregado una forma de pago, tu
                  micrositio sale del directorio — pero no se borra nada y vuelve
                  en cuanto la agregues.
                </p>
              ) : (
                <p className="mt-1 text-sm text-cacao/70">
                  Próximo cobro el{" "}
                  {CUANDO.format(new Date(suscripcion.fecha_proximo_cobro))}
                </p>
              )}
            </div>
          ) : (
            <p className="rounded-3xl bg-crema-2 p-6 text-cacao">
              Todavía no tienes ningún micrositio publicado. El plan se elige al
              publicar cada uno, desde su ficha, y arranca con quince días de
              prueba sin dejar tarjeta.
            </p>
          )}

          <PlanesDesplegables
            tiers={tiers}
            tierActual={suscripcion?.tier_id}
            siguiente={
              siguiente
                ? {
                    id: siguiente.id,
                    nombre: siguiente.nombre,
                    ventajas:
                      [
                        siguiente.permite_resenas && !plan?.permite_resenas
                          ? "reseñas de tus clientes en tu micrositio"
                          : null,
                        siguiente.puede_publicar_contenido &&
                        !plan?.puede_publicar_contenido
                          ? "eventos y noticias"
                          : null,
                        siguiente.en_banner_principal &&
                        !plan?.en_banner_principal
                          ? "tu negocio en el banner de la portada"
                          : null,
                      ]
                        .filter(Boolean)
                        .join(", ") + ".",
                    precio: pesos(siguiente.precio_mensual),
                  }
                : undefined
            }
          >
            {/*
              Cancelar vive dentro de los planes, en letra pequeña: es una
              decisión sobre el plan, y su sitio es donde se deciden los planes.
            */}
            {suscripcion && (
              <details>
                <summary className="cursor-pointer list-none text-sm text-cacao/70 underline underline-offset-4 hover:text-cacao">
                  Cancelar mi plan
                </summary>

                <div className="mt-3 grid gap-4 rounded-3xl bg-crema-2 p-5">
                  <p className="text-cacao">
                    Dejas de pagar y{" "}
                    {publicadas > 0 ? (
                      <>
                        tus{" "}
                        <strong className="text-selva-2">
                          {publicadas === 1
                            ? "sucursal sale"
                            : `${publicadas} sucursales salen`}
                        </strong>{" "}
                        del directorio
                      </>
                    ) : (
                      "tus micrositios no vuelven al directorio"
                    )}
                    , pero{" "}
                    <strong className="text-selva-2">no pierdes nada</strong> de
                    lo que armaste: todo vuelve a borrador con sus fotos, sus
                    datos y su catálogo.
                  </p>

                  <FormularioCancelarSuscripcion />
                </div>
              </details>
            )}
          </PlanesDesplegables>
        </div>
      )}

      {seccion === "datos" && (
        <div className="grid gap-10">
          <section className="grid gap-4">
            <h2 className="font-display text-xl">Tus datos</h2>
            <FormularioDatosPersonales
              nombre={perfil.nombre}
              correo={perfil.correo}
              nombreComercial={marca.nombre_comercial}
            />
          </section>

          {/*
            La contraseña va con los datos y no en pestaña propia: se entra a
            "tus datos" a corregir lo que la plataforma sabe de uno, y la
            contraseña es parte de eso. Una pestaña para un formulario de dos
            campos sería una parada de más.
          */}
          <section className="grid gap-4">
            <div>
              <h2 className="font-display text-xl">Cambiar mi contraseña</h2>
              <p className="mt-1 text-cacao">
                Escríbela dos veces. La anterior deja de servir en cuanto
                guardes.
              </p>
            </div>

            <FormularioContrasenaNueva />
          </section>
        </div>
      )}

      {seccion === "sesion" && (
        <section className="grid gap-4">
          <h2 className="font-display text-xl">Tu sesión</h2>

          <div className="rounded-3xl bg-crema-2 p-6">
            <p className="text-cacao">
              Estás dentro como{" "}
              <strong className="text-selva-2">{perfil.nombre}</strong>, con{" "}
              {perfil.correo}.
            </p>
            <p className="mt-2 text-cacao">
              Al salir no se pierde nada: tus micrositios siguen publicados y
              tus solicitudes de mazorcas te esperan.
            </p>
          </div>

          <form action={cerrarSesion}>
            <button
              type="submit"
              className="min-h-12 w-full rounded-full border-2 border-selva/25 bg-white px-6 font-bold text-selva-2 transition-transform active:translate-y-0.5"
            >
              Cerrar sesión
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
