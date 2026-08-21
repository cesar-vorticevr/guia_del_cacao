import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { BarraSesion } from "@/components/barra-sesion";
import { perfilActual } from "@/lib/auth/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { misResenas, misSolicitudes } from "@/lib/datos/puntos";

export const metadata: Metadata = { title: "Mi cuenta · Guía del Cacao" };

const CUANDO = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** Escalera de §5.4, con el siguiente peldaño a la vista para que motive. */
const RANGOS = [
  { nivel: 1, desde: 0, hasta: 19 },
  { nivel: 2, desde: 20, hasta: 49 },
  { nivel: 3, desde: 50, hasta: 99 },
  { nivel: 4, desde: 100, hasta: null },
];

const ESTADO_SOLICITUD = {
  pendiente: { texto: "Pendiente", tono: "bg-mango/25 text-cacao" },
  aprobada: { texto: "Aprobada", tono: "bg-lima/35 text-selva-2" },
  rechazada: { texto: "Rechazada", tono: "bg-guayaba/20 text-cacao" },
};

export default async function Cuenta() {
  const perfil = await perfilActual();

  if (!perfil) redirect("/login");
  if (!perfil.rol_confirmado) redirect("/elegir-rol");

  const supabase = await crearClienteServidor();
  const anio = new Date().getFullYear();

  // Filtrar por usuario, no solo por año: un administrador puede leer los
  // rangos de todo el mundo, así que sin el .eq acabaría viendo los puntos de
  // otra persona como si fueran suyos.
  const [{ data: rango }, solicitudes, resenas] = await Promise.all([
    supabase
      .from("rangos_usuario")
      .select("puntos_acumulados, rango_actual")
      .eq("usuario_id", perfil.id)
      .eq("anio", anio)
      .maybeSingle(),
    misSolicitudes(perfil.id),
    misResenas(perfil.id),
  ]);

  const puntos = rango?.puntos_acumulados ?? 0;
  const nivel = rango?.rango_actual ?? 1;
  const siguiente = RANGOS.find((r) => r.nivel === nivel + 1);
  const faltan = siguiente ? siguiente.desde - puntos : 0;

  return (
    <>
      <BarraSesion nombre={perfil.nombre} />

      <main className="mx-auto grid w-[92vw] max-w-2xl gap-8 py-8">
        <h1 className="font-display text-3xl">Hola, {perfil.nombre}</h1>

        <section className="rounded-3xl bg-crema-2 p-6">
          <p className="font-bold text-selva-2">Tu pasaporte {anio}</p>

          <p className="mt-2 font-mono text-5xl font-bold text-selva">{puntos}</p>
          <p className="mt-1 text-cacao">
            {puntos === 1 ? "punto acumulado" : "puntos acumulados"} · Rango {nivel}
          </p>

          {siguiente && (
            <div className="mt-5">
              <div
                className="h-3 overflow-hidden rounded-full bg-white"
                role="img"
                aria-label={`Te faltan ${faltan} puntos para el Rango ${siguiente.nivel}`}
              >
                <div
                  className="h-full rounded-full bg-lima"
                  style={{
                    width: `${Math.min(100, Math.round((puntos / siguiente.desde) * 100))}%`,
                  }}
                />
              </div>
              <p className="mt-2 text-cacao">
                Te {faltan === 1 ? "falta" : "faltan"} <strong>{faltan}</strong>{" "}
                {faltan === 1 ? "punto" : "puntos"} para el Rango {siguiente.nivel}.
              </p>
            </div>
          )}

          <p className="mt-4 text-sm text-cacao/70">
            Cada negocio decide qué beneficio te da según tu rango. Los puntos se
            reinician el 1 de enero.
          </p>
        </section>

        <section className="grid gap-4">
          <h2 className="font-display text-2xl">Tus solicitudes</h2>

          {solicitudes.length === 0 ? (
            <p className="rounded-3xl bg-crema-2 p-6 text-cacao">
              Todavía no has pedido puntos. Escanea el QR de cualquier negocio
              del{" "}
              <Link href="/directorio" className="font-bold text-selva underline">
                directorio
              </Link>{" "}
              después de comprar.
            </p>
          ) : (
            <ul className="grid gap-3">
              {solicitudes.map((solicitud) => {
                const estado = ESTADO_SOLICITUD[solicitud.estado];

                return (
                  <li
                    key={solicitud.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4"
                  >
                    <div>
                      <p className="font-bold text-selva-2">
                        {solicitud.sucursales?.nombre_sucursal ?? "Negocio"}
                      </p>
                      <p className="font-mono text-xs text-cacao/70">
                        {CUANDO.format(new Date(solicitud.fecha_solicitud))}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      {solicitud.puntos_otorgados !== null && (
                        <span className="font-mono font-bold text-selva">
                          +{solicitud.puntos_otorgados}
                        </span>
                      )}
                      <span
                        className={`rounded-full px-3 py-1 text-sm font-bold ${estado.tono}`}
                      >
                        {estado.texto}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {resenas.length > 0 && (
          <section className="grid gap-4">
            <h2 className="font-display text-2xl">Tus reseñas</h2>
            <ul className="grid gap-3">
              {resenas.map((resena) => (
                <li key={resena.id} className="rounded-2xl bg-white p-4">
                  <Link
                    href={`/marca/${resena.sucursales?.slug}`}
                    className="font-bold text-selva-2 underline"
                  >
                    {resena.sucursales?.nombre_sucursal}
                  </Link>
                  <p className="mt-1 text-cacao">{resena.texto}</p>
                  {resena.respuesta_marca && (
                    <p className="mt-2 rounded-xl bg-crema-2 p-3 text-cacao">
                      <span className="block font-bold text-selva-2">Te respondieron</span>
                      {resena.respuesta_marca}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </>
  );
}
