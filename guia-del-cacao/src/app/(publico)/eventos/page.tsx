import type { Metadata } from "next";
import { TarjetaPublicacion } from "@/components/publico/tarjeta-publicacion";
import { listarEventos } from "@/lib/datos/publico";

export const metadata: Metadata = { title: "Eventos · Guía del Cacao" };

export default async function Eventos() {
  const { proximos, pasados } = await listarEventos();

  return (
    <>
      <h1 className="pt-8 font-display text-3xl">Eventos</h1>
      <p className="mt-2 text-cacao">
        Catas, ferias y talleres de los negocios del cacao en Tabasco.
      </p>

      <section className="pt-6">
        <h2 className="font-display text-2xl">Próximos</h2>

        {proximos.length === 0 ? (
          <p className="mt-3 rounded-3xl bg-crema-2 p-6 text-cacao">
            No hay eventos programados por ahora.
          </p>
        ) : (
          <ul className="mt-4 grid gap-5 sm:grid-cols-2">
            {proximos.map((evento) => (
              <TarjetaPublicacion key={evento.id} publicacion={evento} tipo="evento" />
            ))}
          </ul>
        )}
      </section>

      {pasados.length > 0 && (
        <section className="pt-8">
          <h2 className="font-display text-2xl">Pasados</h2>
          <ul className="mt-4 grid gap-5 opacity-75 sm:grid-cols-2">
            {pasados.map((evento) => (
              <TarjetaPublicacion key={evento.id} publicacion={evento} tipo="evento" />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
