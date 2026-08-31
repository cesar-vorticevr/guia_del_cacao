"use client";

import { useActionState } from "react";
import { Aviso, BotonEnviar, Campo } from "@/components/formulario";
import { guardarDatosPersonales, type EstadoPlan } from "@/lib/negocio/plan";

const INICIAL: EstadoPlan = {};

/**
 * Los datos de quien lleva la cuenta y el nombre comercial de la marca.
 *
 * El correo se enseña pero no se edita: cambiarlo obliga a confirmar el nuevo
 * —si no, cualquiera perdería el acceso escribiendo una dirección con errata— y
 * eso es un flujo aparte, con su propio correo de vuelta. Ponerlo aquí editable
 * prometería algo que este formulario no puede cumplir.
 */
export function FormularioDatosPersonales({
  nombre,
  correo,
  nombreComercial,
}: {
  nombre: string;
  correo: string;
  nombreComercial: string;
}) {
  const [estado, accion] = useActionState(guardarDatosPersonales, INICIAL);

  return (
    <form action={accion} className="grid gap-4">
      {estado.error && <Aviso>{estado.error}</Aviso>}
      {estado.ok && (
        <p
          role="status"
          className="rounded-2xl border-2 border-lima/50 bg-lima/15 px-4 py-3 font-bold text-selva-2"
        >
          {estado.ok}
        </p>
      )}

      <Campo nombre="nombre" etiqueta="Tu nombre" valor={nombre} autoComplete="name" />

      <Campo
        nombre="nombre_comercial"
        etiqueta="Nombre comercial del negocio"
        valor={nombreComercial}
        ayuda="Es el nombre grande que la gente ve en el directorio."
      />

      <label className="block">
        <span className="mb-1.5 block font-bold text-selva-2">Correo</span>
        <input
          value={correo}
          readOnly
          className="min-h-14 w-full rounded-2xl border-2 border-selva/15 bg-crema-2 px-4 text-base text-cacao"
        />
        <span className="mt-1.5 block text-sm text-cacao/70">
          Con este entras y aquí te avisamos. Para cambiarlo, escríbenos.
        </span>
      </label>

      <BotonEnviar>Guardar mis datos</BotonEnviar>
    </form>
  );
}
