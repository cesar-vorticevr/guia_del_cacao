"use client";

import { useActionState } from "react";
import { Aviso, BotonEnviar } from "@/components/formulario";
import { Estrellas, SelectorEstrellas } from "@/components/publico/estrellas";
import { ACEPTA, MEDIDAS, PESO } from "@/lib/imagenes";
import {
  publicarResena,
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

/**
 * Reseñar: estrellas y comentario en el mismo formulario.
 *
 * Para quien lo usa es un solo acto —"cómo me fue aquí"— aunque por debajo
 * sean dos reglas distintas: la calificación se da una vez y para siempre, el
 * comentario una vez al día. Por eso el formulario cambia de forma según lo que
 * ya hiciste, en vez de pedirte dos veces lo mismo:
 *
 *   · Recién llegas          → estrellas + reseña, juntas.
 *   · Ya calificaste         → solo la reseña, con tus estrellas a la vista.
 *   · Ya comentaste hoy      → solo las estrellas, si te faltaban.
 *   · Ya hiciste las dos     → nada que llenar; se dice y ya.
 */
export function FormularioResena({
  sucursalId,
  slug,
  misEstrellas,
  yaComentoHoy,
}: {
  sucursalId: string;
  slug: string;
  /** Las estrellas que ya diste aquí, o null si todavía no votas. */
  misEstrellas: number | null;
  /** El tope real lo impone la base; esto es para avisarte antes de escribir. */
  yaComentoHoy: boolean;
}) {
  const [estado, accion] = useActionState(publicarResena, INICIAL);

  const faltaCalificar = misEstrellas === null;
  const faltaComentar = !yaComentoHoy;

  // Al terminar, la página se revalida y vuelve con el estado nuevo; hasta que
  // eso ocurra el mensaje de éxito es lo único que debe verse.
  if (estado.ok || (!faltaCalificar && !faltaComentar)) {
    return (
      <div className="grid gap-3 rounded-3xl bg-white p-5 shadow-dura">
        {estado.ok ? (
          <Confirmacion estado={estado} />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-bold text-selva-2">Tu calificación</span>
              <Estrellas valor={misEstrellas!} tamano="size-6" />
              <span className="font-mono font-bold text-cacao">{misEstrellas}/5</span>
            </div>
            <p className="text-cacao">
              Ya comentaste hoy en este negocio. Puedes dejar otro comentario
              mañana — así las reseñas siguen siendo de visitas de verdad.
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <form action={accion} className="grid gap-4 rounded-3xl bg-white p-5 shadow-dura">
      <input type="hidden" name="sucursal_id" value={sucursalId} />
      <input type="hidden" name="slug" value={slug} />
      <Confirmacion estado={estado} />

      {faltaCalificar ? (
        <div>
          <SelectorEstrellas />
          <p className="mt-1.5 text-sm text-cacao/70">
            Se califica una sola vez por negocio, así que tómate un segundo.
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-bold text-selva-2">Tu calificación</span>
          <Estrellas valor={misEstrellas} tamano="size-6" />
          <span className="font-mono font-bold text-cacao">{misEstrellas}/5</span>
        </div>
      )}

      {faltaComentar ? (
        <>
          <label className="block">
            <span className="mb-1.5 block font-bold text-selva-2">Tu reseña</span>
            <textarea
              name="texto"
              rows={3}
              placeholder="¿Cómo te fue? ¿Qué probaste?"
              className="w-full rounded-2xl border-2 border-selva/20 bg-white px-4 py-3 text-base text-ink placeholder:text-cacao/40 focus:border-selva"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block font-bold text-selva-2">
              Una foto <span className="font-normal text-cacao/70">(opcional)</span>
            </span>
            <input
              type="file"
              name="foto"
              accept={ACEPTA}
              className="w-full rounded-2xl border-2 border-dashed border-selva/25 bg-white px-4 py-3 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-selva file:px-4 file:py-2 file:font-bold file:text-crema"
            />
            <span className="mt-1.5 block text-sm text-cacao/70">{MEDIDAS.resena}</span>
            <span className="block text-sm text-cacao/70">{PESO}</span>
          </label>
        </>
      ) : (
        <p className="text-cacao">
          Ya comentaste hoy en este negocio, pero todavía puedes calificarlo.
        </p>
      )}

      <BotonEnviar>
        {faltaCalificar && faltaComentar
          ? "Publicar mi reseña"
          : faltaCalificar
            ? "Calificar"
            : "Publicar reseña"}
      </BotonEnviar>
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
