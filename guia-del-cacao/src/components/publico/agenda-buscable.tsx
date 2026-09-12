"use client";

import { useMemo, useState } from "react";
import { TarjetaPublicacion } from "@/components/publico/tarjeta-publicacion";
import { parecido } from "@/lib/busqueda";
import type { Publicacion } from "@/lib/datos/publico";

/**
 * La agenda pública, con su buscador.
 *
 * Filtra mientras se escribe, igual que el directorio: la agenda de una feria
 * son decenas de eventos que ya vienen cargados, así que un viaje al servidor
 * por cada letra solo añadiría espera. Y busca por negocio además de por
 * título, porque "qué hace Grijalva este mes" es una pregunta tan normal como
 * "dónde hay una cata".
 */
export function AgendaBuscable({
  proximos,
  pasados,
  /** Para el corazón de cada evento: sin sesión lleva a registrarse. */
  haySesion = false,
}: {
  proximos: Publicacion[];
  pasados: Publicacion[];
  haySesion?: boolean;
}) {
  const [consulta, setConsulta] = useState("");

  const filtrar = useMemo(
    () => (lista: Publicacion[]) =>
      lista.filter((evento) =>
        parecido(consulta, [
          evento.titulo,
          evento.subtitulo,
          evento.sucursales?.marcas?.nombre_comercial,
          evento.sucursales?.nombre_sucursal,
        ]),
      ),
    [consulta],
  );

  const proximosVisibles = filtrar(proximos);
  const pasadosVisibles = filtrar(pasados);

  const buscando = consulta.trim().length > 0;
  const nada = proximosVisibles.length === 0 && pasadosVisibles.length === 0;

  return (
    <>
      <form
        role="search"
        onSubmit={(evento) => {
          evento.preventDefault();
          // El botón no sobra: en celular cierra el teclado, que es lo que tapa
          // los resultados que se acaban de filtrar.
          (document.activeElement as HTMLElement | null)?.blur();
        }}
        className="flex gap-2 pt-6"
      >
        <input
          type="search"
          value={consulta}
          onChange={(evento) => setConsulta(evento.target.value)}
          placeholder="Buscar una cata, un taller, un negocio…"
          aria-label="Buscar en la agenda"
          className="min-h-12 flex-1 rounded-full border-2 border-selva/20 bg-white px-5 text-ink"
        />
        <button
          type="submit"
          className="min-h-12 rounded-full bg-selva px-5 font-bold text-crema"
        >
          Buscar
        </button>
      </form>

      {buscando && nada && (
        <p className="mt-4 rounded-3xl bg-crema-2 p-6 text-cacao">
          No hay eventos que coincidan con «{consulta.trim()}».
        </p>
      )}

      <section className="pt-6">
        <h2 className="font-display text-2xl">Próximos</h2>

        {proximosVisibles.length === 0 ? (
          <p className="mt-3 rounded-3xl bg-crema-2 p-6 text-cacao">
            {buscando
              ? "Ninguno de los que vienen coincide con lo que buscas."
              : "No hay eventos programados por ahora."}
          </p>
        ) : (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {proximosVisibles.map((evento) => (
              <TarjetaPublicacion
                key={evento.id}
                publicacion={evento}
                tipo="evento"
                haySesion={haySesion}
              />
            ))}
          </ul>
        )}
      </section>

      {pasadosVisibles.length > 0 && (
        <section className="pt-8">
          <h2 className="font-display text-2xl">Pasados</h2>
          <ul className="mt-4 grid gap-4 opacity-75 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {pasadosVisibles.map((evento) => (
              <TarjetaPublicacion
                key={evento.id}
                publicacion={evento}
                tipo="evento"
                haySesion={haySesion}
              />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
