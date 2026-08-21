import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { BarraSesion } from "@/components/barra-sesion";
import { perfilActual } from "@/lib/auth/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Mi cuenta · Guía del Cacao" };

export default async function Cuenta() {
  const perfil = await perfilActual();

  if (!perfil) redirect("/login");
  if (!perfil.rol_confirmado) redirect("/elegir-rol");

  const supabase = await crearClienteServidor();
  const anio = new Date().getFullYear();

  // Filtrar por usuario, no solo por año: un administrador puede leer los
  // rangos de todo el mundo, así que sin el .eq acabaría viendo los puntos de
  // otra persona como si fueran suyos.
  const { data: rango } = await supabase
    .from("rangos_usuario")
    .select("puntos_acumulados, rango_actual")
    .eq("usuario_id", perfil.id)
    .eq("anio", anio)
    .maybeSingle();

  const puntos = rango?.puntos_acumulados ?? 0;
  const nivel = rango?.rango_actual ?? 1;

  return (
    <>
      <BarraSesion nombre={perfil.nombre} />

      <main className="mx-auto w-[92vw] max-w-[1180px] py-8">
        <h1 className="font-display text-3xl">Hola, {perfil.nombre}</h1>

        <section className="mt-6 rounded-3xl bg-crema-2 p-6">
          <p className="font-bold text-selva-2">Tu pasaporte {anio}</p>
          <p className="mt-2 font-mono text-5xl font-bold text-selva">{puntos}</p>
          <p className="mt-1 text-cacao">
            puntos acumulados · Rango {nivel}
          </p>
          <p className="mt-4 text-sm text-cacao/70">
            Los puntos se reinician cada 1 de enero.
          </p>
        </section>

        <p className="mt-8 font-mono text-xs text-cacao/70">
          Historial, reseñas y escaneo de QR llegan en la siguiente fase.
        </p>
      </main>
    </>
  );
}
