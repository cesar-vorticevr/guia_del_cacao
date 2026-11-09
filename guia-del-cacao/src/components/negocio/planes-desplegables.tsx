"use client";

import { useRef, useState } from "react";
import { FormularioCambiarPlan, PromoAnual } from "@/components/negocio/formularios";
import type { Oferta, Periodo } from "@/lib/precios";
import type { Tier } from "@/lib/tipos";

/**
 * El anuncio de subir de plan y la lista que abre.
 *
 * Van juntos porque comparten dos cosas: **si la lista está abierta** y **con
 * qué plan abre**. Llegando desde "cámbiate a Pro" abre en Pro — quien
 * tocó ese anuncio ya eligió, y devolverlo a su plan actual sería pedirle la
 * misma decisión dos veces. Entrando por "ver los planes" abre en el suyo,
 * porque ahí todavía no ha elegido nada.
 *
 * Al abrirse desplaza hasta la lista: en celular el anuncio ocupa casi toda la
 * pantalla y lo que se destapa queda por debajo del pliegue, así que sin el
 * desplazamiento parecería que no pasó nada.
 */
export function PlanesDesplegables({
  tiers,
  cobroReal = false,
  porPagar = false,
  enPrueba = false,
  finDePrueba = null,
  tierActual,
  siguiente,
  oferta = null,
  children,
}: {
  tiers: Tier[];
  /** Está en su mes gratis de la membresía. */
  enPrueba?: boolean;
  /** Cuándo acaba el mes gratis: el día del primer cobro si mete tarjeta. */
  finDePrueba?: string | null;
  /** Hay Stripe: el botón «Pagar ahora» cobra de verdad. */
  cobroReal?: boolean;
  /** Alguna sucursal todavía no paga con tarjeta. */
  porPagar?: boolean;
  tierActual?: number;
  /** El convenio con el que entró, para enseñar sus precios. */
  oferta?: Oferta | null;
  /** El plan de arriba. Sin él no hay anuncio: no hay a dónde subir. */
  siguiente?: { id: number; nombre: string; ventajas: string; precio: string };
  /** La opción de cancelar, que va debajo de la lista. */
  children?: React.ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);
  const [preseleccion, setPreseleccion] = useState<number | undefined>(undefined);
  const [periodo, setPeriodo] = useState<Periodo>("mensual");
  const lista = useRef<HTMLDivElement | null>(null);

  function abrir(plan?: number, conPeriodo: Periodo = "mensual") {
    setPreseleccion(plan);
    setPeriodo(conPeriodo);
    setAbierto(true);

    // Después de pintar, no antes: hasta que la lista no existe no hay a dónde
    // desplazarse.
    requestAnimationFrame(() =>
      lista.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }

  return (
    <>
      {siguiente && (
        <button
          type="button"
          onClick={() => abrir(siguiente.id)}
          aria-expanded={abierto}
          className="rounded-[2rem] border-2 border-ink/10 bg-mango px-6 py-8 text-left shadow-dura transition-transform hover:brightness-[1.03] active:translate-y-0.5"
        >
          <span className="flex flex-wrap items-baseline justify-between gap-3">
            <span className="font-display text-2xl text-ink">
              Cámbiate a {siguiente.nombre}
            </span>
            <span aria-hidden="true" className="font-bold text-cacao">
              Ver planes →
            </span>
          </span>

          <span className="mt-2 block max-w-prose text-cacao">
            {siguiente.ventajas} Por {siguiente.precio}.
          </span>
        </button>
      )}

      <section ref={lista} className="grid scroll-mt-24 gap-4">
        <h2 className="font-display text-xl">
          {enPrueba ? "Paga tu membresía" : "Tu membresía"}
        </h2>

        {abierto ? (
          <>
            {/*
              La `key` vuelve a montar el formulario cuando cambia con qué plan
              se abre. Sin ella, abrir por "ver los planes" después de haber
              tocado el anuncio conservaría Pro marcado: el estado interno
              sobrevive y la preselección nueva se ignoraría.
            */}
            <FormularioCambiarPlan
              key={`${preseleccion ?? "actual"}-${periodo}`}
              tiers={tiers}
              cobroReal={cobroReal}
              porPagar={porPagar}
              enPrueba={enPrueba}
              finDePrueba={finDePrueba}
              periodoInicial={periodo}
              tierActual={tierActual}
              preseleccion={preseleccion}
              oferta={oferta}
            />

            {children}
          </>
        ) : (
          <>
            {/* La promoción anual se ve sin abrir nada: es la que se empuja. */}
            {porPagar && (
              <PromoAnual tiers={tiers} periodo="mensual" alElegir={() => abrir(undefined, "anual")} />
            )}
          <button
            type="button"
            onClick={() => abrir()}
            className="inline-flex min-h-12 w-fit items-center rounded-full border-2 border-selva/25 bg-white px-6 font-bold text-selva-2 transition-transform active:translate-y-0.5"
          >
            {enPrueba ? "Pagar o ver mi membresía" : "Ver mi membresía"}
          </button>
          </>
        )}
      </section>
    </>
  );
}
