"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Area, Campo } from "@/components/formulario";
import { EditarFotos } from "@/components/publico/editar-fotos";
import { borrarTema, editarTema, ocultarTema } from "@/lib/foro/acciones";
import type { EstadoForo } from "@/lib/foro/acciones";
import type { Entrada } from "@/lib/datos/comunidad";
import { LIMITES } from "@/lib/limites";

const INICIAL: EstadoForo = {};

/**
 * La última publicación de quien mira, con lo que puede hacer con ella.
 *
 * Va arriba del muro porque lo primero que se viene a ver es si respondieron.
 * Y trae las tres salidas que faltaban: **editar** el texto —antes solo se podía
 * cambiar la foto, que es de lo que menos se arrepiente uno—, **ocultarla** sin
 * perder los comentarios, y **eliminarla**.
 */
export function MiPublicacion({ entrada }: { entrada: Entrada }) {
  const [editando, setEditando] = useState(false);
  const [estado, guardar] = useActionState(editarTema, INICIAL);

  return (
    <div className="mt-3 grid gap-4 rounded-3xl bg-crema-2 p-6">
      <div>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <p className="font-mono text-xs tracking-wide text-cacao/70 uppercase">
            {entrada.fechaTexto}
          </p>

          {entrada.oculta && (
            <span className="rounded-full bg-ink/10 px-2 py-0.5 font-mono text-xs font-bold text-cacao">
              Oculta · solo la ves tú
            </span>
          )}
        </div>

        <Link
          href={entrada.href}
          className="mt-1 block font-display text-2xl font-semibold text-selva-2 underline-offset-4 hover:underline"
        >
          {entrada.titulo}
        </Link>

        <p className="mt-2 line-clamp-3 text-cacao">{entrada.resumen}</p>

        <p className="mt-3 flex flex-wrap items-center gap-3 font-mono text-xs text-cacao/70">
          <span className="inline-flex items-center gap-1.5">
            {entrada.comentarios}{" "}
            {entrada.comentarios === 1 ? "comentario" : "comentarios"}
            {entrada.sinVer > 0 && (
              <span
                className="grid size-5 place-items-center rounded-full bg-guayaba font-bold text-ink"
                aria-label={`${entrada.sinVer} sin leer`}
              >
                {entrada.sinVer}
              </span>
            )}
          </span>

          {entrada.apoyos > 0 && (
            <span>
              {entrada.apoyos} {entrada.apoyos === 1 ? "apoyo" : "apoyos"}
            </span>
          )}
        </p>
      </div>

      {editando ? (
        <form action={guardar} className="grid gap-4 rounded-2xl bg-white p-5">
          <input type="hidden" name="publicacion_id" value={entrada.id} />

          <Campo
            nombre="titulo"
            etiqueta="Título"
            valor={entrada.titulo}
            limite={LIMITES.tituloPublicacion}
          />

          <Area
            nombre="contenido"
            etiqueta="Contenido"
            valor={entrada.resumen}
            limite={LIMITES.contenidoPublicacion}
            filas={6}
          />

          {/*
            Las fotos se editan aquí y no en otro sitio: quitar una era lo único
            que no se podía hacer, y mandar una nueva borraba todas las demás.
          */}
          <EditarFotos actuales={entrada.rutas} urlDe={entrada.urlDeFoto} />

          {estado.error && (
            <p
              role="alert"
              className="rounded-2xl border-2 border-guayaba/40 bg-guayaba/10 px-4 py-3 text-cacao"
            >
              {estado.error}
            </p>
          )}

          {estado.ok && (
            <p
              role="status"
              className="rounded-2xl border-2 border-lima/50 bg-lima/15 px-4 py-3 font-bold text-selva-2"
            >
              {estado.ok}
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              className="min-h-12 rounded-full bg-selva px-6 font-bold text-crema"
            >
              Guardar cambios
            </button>

            <button
              type="button"
              onClick={() => setEditando(false)}
              className="min-h-12 rounded-full border-2 border-selva/25 bg-white px-6 font-bold text-selva-2"
            >
              Cerrar
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setEditando(true)}
            className="min-h-11 rounded-full border-2 border-selva/25 bg-white px-5 py-2.5 text-sm font-bold text-selva-2"
          >
            Editar
          </button>

          <form action={ocultarTema}>
            <input type="hidden" name="publicacion_id" value={entrada.id} />
            <input
              type="hidden"
              name="ocultar"
              value={entrada.oculta ? "no" : "si"}
            />
            <button
              type="submit"
              className="min-h-11 rounded-full border-2 border-selva/25 bg-white px-5 py-2.5 text-sm font-bold text-selva-2"
            >
              {entrada.oculta ? "Volver a mostrar" : "Ocultar"}
            </button>
          </form>

          {/*
            Eliminar va en letra pequeña y detrás de un despliegue: ocultar
            resuelve casi todo lo que lleva a querer borrar, y esta es la única
            de las tres que no tiene vuelta atrás.
          */}
          <details className="w-full">
            <summary className="cursor-pointer list-none pt-1 text-sm text-cacao/70 underline underline-offset-4 hover:text-cacao">
              Eliminarla
            </summary>

            <div className="mt-3 grid gap-3 rounded-2xl border-2 border-guayaba/40 bg-guayaba/10 p-5">
              <p className="text-cacao">
                Se borra con sus{" "}
                <strong className="text-selva-2">
                  {entrada.comentarios}{" "}
                  {entrada.comentarios === 1 ? "comentario" : "comentarios"}
                </strong>{" "}
                y no se puede deshacer. Si solo quieres que deje de verse,{" "}
                <strong className="text-selva-2">ocúltala</strong>.
              </p>

              <form action={borrarTema}>
                <input type="hidden" name="publicacion_id" value={entrada.id} />
                <button
                  type="submit"
                  className="min-h-11 w-full rounded-full bg-guayaba px-5 font-bold text-ink"
                >
                  Sí, eliminarla
                </button>
              </form>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
