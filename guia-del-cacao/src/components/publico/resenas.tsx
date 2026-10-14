"use client";

import { useActionState, useState } from "react";
import { Aviso, BotonEnviar, CampoFoto } from "@/components/formulario";
import { Estrellas, SelectorEstrellas } from "@/components/publico/estrellas";
import { Medio } from "@/components/publico/medio";
import { ACEPTA_MEDIO, PESO_MEDIO, PROPORCIONES } from "@/lib/imagenes";
import { MOTIVOS_DE_REPORTE } from "@/lib/reportes";
import {
  publicarResena,
  reportarResena,
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
 * Tu reseña de este negocio: estrellas, texto y, si quieres, foto o video.
 *
 * Es una sola por negocio y **se actualiza**. No hay historial de comentarios
 * de la misma persona: lo que se lee es lo que piensas hoy. Cambiarla cuesta
 * el mismo tope que pedir mazorcas —una vez al día—, y cuando ya lo gastaste el
 * formulario se convierte en lo que escribiste, para que puedas verlo.
 */
export function FormularioResena({
  sucursalId,
  slug,
  misEstrellas,
  miResena,
}: {
  sucursalId: string;
  slug: string;
  /** Las estrellas que ya diste aquí, o null si todavía no votas. */
  misEstrellas: number | null;
  /** Tu reseña de este negocio, si ya dejaste una. */
  miResena: { texto: string; medioUrl: string | null; puedeCambiarla: boolean } | null;
}) {
  const [estado, accion] = useActionState(publicarResena, INICIAL);

  const yaLaTengo = miResena !== null;

  // Con el cupo del día gastado no se enseña el formulario: se enseña lo que
  // escribió, que es lo que vino a ver, y cuándo podrá cambiarlo.
  if (yaLaTengo && !miResena.puedeCambiarla && !estado.ok) {
    return (
      <div className="grid gap-3 rounded-3xl bg-white p-5 shadow-dura">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-bold text-selva-2">Tu reseña</span>
          {misEstrellas !== null && (
            <>
              <Estrellas valor={misEstrellas} tamano="size-6" />
              <span className="font-mono font-bold text-cacao">{misEstrellas}/5</span>
            </>
          )}
        </div>

        <p className="whitespace-pre-line text-cacao">{miResena.texto}</p>

        <Medio ruta={miResena.medioUrl} alt="Lo que subiste con tu reseña" />

        <p className="text-sm text-cacao/70">
          Ya la cambiaste hoy. Puedes volver a hacerlo mañana.
        </p>
      </div>
    );
  }

  if (estado.ok) {
    return (
      <div className="rounded-3xl bg-white p-5 shadow-dura">
        <Confirmacion estado={estado} />
      </div>
    );
  }

  return (
    <form action={accion} className="grid gap-4 rounded-3xl bg-white p-5 shadow-dura">
      <input type="hidden" name="sucursal_id" value={sucursalId} />
      <input type="hidden" name="slug" value={slug} />
      <Confirmacion estado={estado} />

      <div>
        <SelectorEstrellas inicial={misEstrellas ?? 0} />
        <p className="mt-1.5 text-sm text-cacao/70">
          {yaLaTengo
            ? "Puedes cambiar tu nota si volviste y te fue distinto."
            : "Tu nota es la que arma el promedio del negocio."}
        </p>
      </div>

      <label className="block">
        <span className="mb-1.5 block font-bold text-selva-2">Tu reseña</span>
        <textarea
          name="texto"
          rows={3}
          defaultValue={miResena?.texto ?? ""}
          placeholder="¿Cómo te fue? ¿Qué probaste?"
          className="w-full rounded-2xl border-2 border-selva/20 bg-white px-4 py-3 text-base text-ink placeholder:text-cacao/40 focus:border-selva"
        />
      </label>

      {miResena?.medioUrl && (
        <div>
          <p className="mb-1.5 font-bold text-selva-2">Lo que subiste</p>
          <Medio ruta={miResena.medioUrl} alt="Lo que subiste con tu reseña" />
          <p className="mt-1.5 text-sm text-cacao/70">
            Si subes otra cosa, reemplaza a esta.
          </p>
        </div>
      )}

      {/*
        El video pasa de largo: aquí no hay nada que lo recorte, así que el
        encuadre no se abre y se sube tal cual.
      */}
      <CampoFoto
        nombre="medio"
        etiqueta={
          <>
            Una foto o un video{" "}
            <span className="font-normal text-cacao/70">(opcional)</span>
          </>
        }
        proporcion={PROPORCIONES.resena}
        acepta={ACEPTA_MEDIO}
        peso={PESO_MEDIO}
      />

      <BotonEnviar>
        {yaLaTengo ? "Actualizar mi reseña" : "Publicar mi reseña"}
      </BotonEnviar>

      {yaLaTengo && (
        <p className="text-sm text-cacao/70">
          Se puede cambiar una vez al día, igual que pedir mazorcas.
        </p>
      )}
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

/**
 * «Reportar» al pie de una reseña: abre los motivos y lo manda al
 * administrador. Plegado, porque casi nadie lo usa y una fila de botones rojos
 * bajo cada reseña la haría parecer sospechosa.
 */
export function ReportarResena({
  resenaId,
  yaReportada,
}: {
  resenaId: string;
  /** Si quien mira ya la reportó: se lo dice en vez de ofrecerlo otra vez. */
  yaReportada: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion] = useActionState(reportarResena, INICIAL);

  if (yaReportada || estado.ok) {
    return (
      <p role="status" className="mt-3 text-sm text-cacao/70">
        {estado.ok ?? "Ya la reportaste. La estamos revisando."}
      </p>
    );
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="mt-3 text-sm text-cacao/60 underline underline-offset-4 hover:text-cacao"
      >
        Reportar
      </button>
    );
  }

  return (
    <form action={accion} className="mt-3 grid gap-3 rounded-2xl bg-crema-2 p-4">
      <input type="hidden" name="resena_id" value={resenaId} />
      {estado.error && <Aviso>{estado.error}</Aviso>}

      <fieldset className="grid gap-1.5">
        <legend className="mb-1 font-bold text-selva-2">¿Por qué la reportas?</legend>
        {Object.entries(MOTIVOS_DE_REPORTE).map(([clave, texto]) => (
          <label key={clave} className="flex cursor-pointer items-center gap-2 text-cacao">
            <input type="radio" name="motivo" value={clave} required className="size-4 accent-selva" />
            {texto}
          </label>
        ))}
      </fieldset>

      <label className="block">
        <span className="mb-1 block text-sm text-cacao/70">
          Cuéntanos más (opcional)
        </span>
        <textarea
          name="detalle"
          rows={2}
          maxLength={500}
          className="w-full rounded-2xl border-2 border-selva/20 bg-white px-4 py-2 text-base text-ink focus:border-selva"
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <BotonEnviar variante="secundario">Enviar reporte</BotonEnviar>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="text-sm font-bold text-selva underline"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
