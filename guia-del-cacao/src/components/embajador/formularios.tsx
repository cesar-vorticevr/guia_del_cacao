"use client";

import { useActionState, useState } from "react";
import { Area, Aviso, BotonEnviar, Campo } from "@/components/formulario";
import {
  guardarDatosDeCobro,
  solicitarSerEmbajador,
  type EstadoEmbajador,
} from "@/lib/embajador/acciones";

const INICIAL: EstadoEmbajador = {};

function Listo({ children }: { children?: string }) {
  if (!children) return null;
  return (
    <p role="status" className="rounded-2xl border-2 border-lima/60 bg-lima/20 px-4 py-3 font-bold text-selva-2">
      {children}
    </p>
  );
}

/** «Quiero ser embajador»: un motivo opcional y enviar. */
export function SolicitudDeEmbajador() {
  const [estado, enviar] = useActionState(solicitarSerEmbajador, INICIAL);

  return (
    <form action={enviar} className="grid gap-4">
      <Area
        nombre="motivo"
        etiqueta="Cuéntanos un poco (opcional)"
        ayuda="¿A qué negocios del cacao conoces? ¿Dónde los vas a invitar?"
        filas={3}
        limite={500}
      />
      <Aviso>{estado.error}</Aviso>
      <Listo>{estado.ok}</Listo>
      <BotonEnviar>Quiero ser Embajador del Cacao</BotonEnviar>
    </form>
  );
}

/** A dónde se le transfiere: titular, banco y CLABE. */
export function DatosDeCobro({
  titular,
  banco,
  clabe,
}: {
  titular: string | null;
  banco: string | null;
  clabe: string | null;
}) {
  const [estado, enviar] = useActionState(guardarDatosDeCobro, INICIAL);

  return (
    <form action={enviar} className="grid gap-4">
      <Campo nombre="titular" etiqueta="A nombre de" valor={titular} autoComplete="name" />
      <Campo nombre="banco" etiqueta="Banco" valor={banco} requerido={false} marcador="BBVA, Banorte, Nu…" />
      <Campo
        nombre="clabe"
        etiqueta="CLABE interbancaria"
        valor={clabe}
        ayuda="Los 18 dígitos. Ahí te transferimos lo que ganes cada mes."
        marcador="012345678901234567"
      />
      <Aviso>{estado.error}</Aviso>
      <Listo>{estado.ok}</Listo>
      <BotonEnviar variante="secundario">Guardar datos de cobro</BotonEnviar>
    </form>
  );
}

/**
 * El código del embajador, grande y con sus dos salidas: copiarlo y mandarlo
 * por WhatsApp con un mensaje ya escrito. El mensaje dice qué gana el negocio,
 * que es lo que hace que lo use.
 */
export function TuCodigo({ codigo, sitio }: { codigo: string; sitio: string }) {
  const [copiado, setCopiado] = useState(false);

  const mensaje = `¡Hola! Te invito a poner tu negocio en la Guía del Cacao (${sitio}). Con mi código ${codigo} tienes 20% de descuento en tu primer pago.`;

  return (
    <div className="flex flex-col items-center gap-5">
      <p className="texto-oro select-all font-mono text-4xl font-bold tracking-[0.12em] sm:text-6xl">
        {codigo}
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(codigo);
              setCopiado(true);
              setTimeout(() => setCopiado(false), 2000);
            } catch {
              // Sin permiso para el portapapeles: el código se puede seleccionar a mano.
            }
          }}
          className="boton-oro brillo min-h-12 rounded-full px-6 font-bold text-ink"
        >
          {copiado ? "¡Copiado!" : "Copiar código"}
        </button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(mensaje)}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-12 items-center rounded-full border border-mango/50 px-6 font-bold text-crema transition-colors hover:border-mango hover:text-mango"
        >
          Mandar por WhatsApp
        </a>
      </div>
    </div>
  );
}
