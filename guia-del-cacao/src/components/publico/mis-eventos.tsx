"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { TarjetaEvento } from "@/components/negocio/eventos";
import { parecido } from "@/lib/busqueda";
import type { PublicacionPropia } from "@/lib/datos/sucursales";

/**
 * Los eventos del negocio, dentro de la página de Eventos.
 *
 * Vivían en una pestaña del panel, que era salir del sitio público para escribir
 * sobre él: se editaba en un sitio y se veía en otro, y para comprobar cómo había
 * quedado había que navegar a la agenda. Aquí se editan donde se leen.
 *
 * Van separados en los que vienen y los que ya pasaron, como la agenda pública:
 * lo que hay que atender es lo de arriba, y lo de abajo es archivo.
 */
export function MisEventos({
  eventos,
  slugs,
  fechas,
  fotos,
  /** Si el plan de la marca incluye publicar. Cambia todo lo que se puede hacer. */
  puedePublicar,
}: {
  eventos: PublicacionPropia[];
  /** Slug de la sucursal de cada evento, para "ver publicado". */
  slugs: Record<string, string | null>;
  /** La fecha ya formateada: el servidor la arma para no repintar distinto. */
  fechas: Record<string, string>;
  /** La foto de cada evento, ya resuelta a URL pública. */
  fotos: Record<string, string | null>;
  puedePublicar: boolean;
}) {
  const [consulta, setConsulta] = useState("");

  const encontrados = useMemo(
    () =>
      eventos.filter((evento) =>
        parecido(consulta, [evento.titulo, evento.subtitulo, evento.sucursal]),
      ),
    [consulta, eventos],
  );

  const proximos = encontrados.filter((evento) => !evento.paso);
  const pasados = encontrados.filter((evento) => evento.paso);

  const buscando = consulta.trim().length > 0;

  return (
    <section className="pt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-display text-2xl">
          Tus eventos{" "}
          <span className="font-mono text-sm font-normal text-cacao/70">
            {eventos.length}
          </span>
        </h2>
      </div>

      {!puedePublicar && eventos.length > 0 && (
        /*
          El aviso va aquí arriba y no en cada tarjeta: es una sola cosa que le
          pasa a todos sus eventos, y repetirlo diez veces sería regañar.
        */
        <div className="mt-3 rounded-3xl border-2 border-mango/50 bg-mango/15 p-5">
          <p className="text-cacao">
            <strong className="text-selva-2">
              Tus eventos están ocultos para el público.
            </strong>{" "}
            Publicar viene con el plan Premier y tu cuenta ya no lo tiene. No se
            borró nada: en cuanto vuelvas a Premier se ven otra vez, tal como
            estaban.
          </p>

          <Link
            href="/negocio/panel/cuenta"
            className="mt-4 inline-block min-h-11 rounded-full bg-mango px-5 py-2.5 font-bold text-ink"
          >
            Volver a Premier
          </Link>
        </div>
      )}

      {eventos.length === 0 ? (
        <p className="mt-3 rounded-3xl bg-crema-2 p-6 text-cacao">
          Todavía no has publicado ninguno.
        </p>
      ) : (
        <>
          {/* La caja solo aparece cuando hay bastantes: con tres eventos, un
              buscador es una fila que estorba para encontrar lo que ya se ve. */}
          {eventos.length > 4 && (
            <form
              role="search"
              onSubmit={(evento) => {
                evento.preventDefault();
                // Cierra el teclado en celular, que es lo que tapa justo los
                // resultados recién filtrados.
                (document.activeElement as HTMLElement | null)?.blur();
              }}
              className="mt-4 flex gap-2"
            >
              <input
                type="search"
                value={consulta}
                onChange={(evento) => setConsulta(evento.target.value)}
                placeholder="Buscar en tus eventos"
                aria-label="Buscar en tus eventos"
                className="min-h-12 flex-1 rounded-full border-2 border-selva/20 bg-white px-5 text-ink"
              />
              <button
                type="submit"
                className="min-h-12 rounded-full bg-selva px-5 font-bold text-crema"
              >
                Buscar
              </button>
            </form>
          )}

          {buscando && encontrados.length === 0 && (
            <p className="mt-4 rounded-3xl bg-crema-2 p-6 text-cacao">
              Ninguno de tus eventos coincide con «{consulta.trim()}».
            </p>
          )}

          {proximos.length > 0 && (
            <div className="mt-4">
              <p className="mb-3 font-bold text-selva-2">Próximos</p>
              <ul className="grid gap-4">
                {proximos.map((evento) => (
                  <TarjetaEvento
                    key={evento.id}
                    evento={evento}
                    fechaTexto={fechas[evento.id] ?? ""}
                    foto={fotos[evento.id] ?? null}
                    slug={slugs[evento.id] ?? null}
                    editable={puedePublicar}
                  />
                ))}
              </ul>
            </div>
          )}

          {pasados.length > 0 && (
            <div className="mt-6">
              <p className="mb-3 font-bold text-selva-2">Ya pasaron</p>
              <ul className="grid gap-4 opacity-80">
                {pasados.map((evento) => (
                  <TarjetaEvento
                    key={evento.id}
                    evento={evento}
                    fechaTexto={fechas[evento.id] ?? ""}
                    foto={fotos[evento.id] ?? null}
                    slug={slugs[evento.id] ?? null}
                    editable={puedePublicar}
                  />
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
