"use client";

import { useActionState } from "react";
import { Aviso, BotonEnviar } from "@/components/formulario";
import {
  dejarResena,
  responderResena,
  type EstadoResena,
} from "@/lib/publico/acciones";

const INICIAL: EstadoResena = {};

function Confirmacion({ estado }: { estado: EstadoResena }) {
  if (estado.error) return <Aviso>{estado.error}</Aviso>;
  if (estado.ok) {
    return (
      <p
        role="status"
        className="rounded-2xl border-2 border-lima/50 bg-lima/15 px-4 py-3 font-bold text-selva-2"
      >
        {estado.ok}
      </p>
    );
  }
  return null;
}

export function FormularioResena({
  sucursalId,
  slug,
}: {
  sucursalId: string;
  slug: string;
}) {
  const [estado, accion] = useActionState(dejarResena, INICIAL);

  return (
    <form action={accion} className="grid gap-3">
      <input type="hidden" name="sucursal_id" value={sucursalId} />
      <input type="hidden" name="slug" value={slug} />
      <Confirmacion estado={estado} />

      <label className="block">
        <span className="mb-1.5 block font-bold text-selva-2">Tu reseña</span>
        <textarea
          name="texto"
          rows={3}
          placeholder="¿Cómo te fue? ¿Qué probaste?"
          className="w-full rounded-2xl border-2 border-selva/20 bg-white px-4 py-3 text-base text-ink placeholder:text-cacao/40 focus:border-selva"
        />
      </label>

      <BotonEnviar>Publicar reseña</BotonEnviar>
    </form>
  );
}

export function FormularioRespuesta({
  resenaId,
  slug,
}: {
  resenaId: string;
  slug: string;
}) {
  const [estado, accion] = useActionState(responderResena, INICIAL);

  return (
    <form action={accion} className="mt-3 grid gap-2">
      <input type="hidden" name="resena_id" value={resenaId} />
      <input type="hidden" name="slug" value={slug} />
      <Confirmacion estado={estado} />

      <textarea
        name="respuesta"
        rows={2}
        placeholder="Responder como el negocio…"
        className="w-full rounded-2xl border-2 border-selva/20 bg-white px-4 py-2.5 text-base text-ink placeholder:text-cacao/40 focus:border-selva"
      />

      <BotonEnviar variante="secundario">Responder</BotonEnviar>
    </form>
  );
}
