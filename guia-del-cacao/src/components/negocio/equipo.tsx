"use client";

import { useActionState } from "react";
import { Aviso, BotonEnviar } from "@/components/formulario";
import {
  cederNegocio,
  compartirNegocio,
  dejarNegocio,
  type EstadoEquipo,
} from "@/lib/negocio/equipo";

const INICIAL: EstadoEquipo = {};

/** El @usuario de otra persona, con la arroba dibujada delante. */
function CampoArroba({ etiqueta, ayuda }: { etiqueta: string; ayuda: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-bold text-selva-2">{etiqueta}</span>
      {/* `bg-[#fff]` y no `bg-white`: `.noche` oscurece `bg-white`, y aquí va letra oscura. */}
      <span className="flex items-center rounded-2xl border-2 border-selva/20 bg-[#fff] focus-within:border-mango">
        <span className="pl-4 font-bold text-cacao/60" aria-hidden="true">@</span>
        <input
          name="usuario"
          required
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="usuario"
          className="w-full rounded-2xl bg-transparent py-3 pr-4 pl-1 text-ink focus:outline-none"
        />
      </span>
      <span className="mt-1.5 block text-sm text-cacao/80">{ayuda}</span>
    </label>
  );
}

function Respuesta({ estado }: { estado: EstadoEquipo }) {
  return (
    <>
      <Aviso>{estado.error}</Aviso>
      {estado.ok && (
        <p role="status" className="font-bold text-selva-2">
          {estado.ok}
        </p>
      )}
    </>
  );
}

export function FormularioCompartir() {
  const [estado, accion] = useActionState(compartirNegocio, INICIAL);
  return (
    <form action={accion} className="grid gap-3">
      <CampoArroba
        etiqueta="Agregar a un administrador"
        ayuda="La persona necesita su propia cuenta en la Guía. Su @usuario está en Mi cuenta → Tus datos."
      />
      <Respuesta estado={estado} />
      <BotonEnviar>Compartir la administración</BotonEnviar>
    </form>
  );
}

export function FormularioCeder({ negocio }: { negocio: string }) {
  const [estado, accion] = useActionState(cederNegocio, INICIAL);
  return (
    <form action={accion} className="grid gap-3">
      <CampoArroba
        etiqueta="Ceder el negocio a"
        ayuda={`Esa cuenta será la dueña de ${negocio}: pagará el plan, anotará la cuenta bancaria y decidirá quién lo administra.`}
      />
      <label className="flex items-start gap-3 text-cacao">
        <input type="checkbox" name="quedarme" defaultChecked className="mt-1 size-5 accent-[#106b46]" />
        <span>Quedarme como administrador después de cederlo.</span>
      </label>
      <label className="flex items-start gap-3 text-cacao">
        <input type="checkbox" name="confirmo" className="mt-1 size-5 accent-[#106b46]" />
        <span>
          Entiendo que dejo de ser el dueño y que no puedo deshacerlo yo: solo el nuevo dueño me lo
          puede devolver.
        </span>
      </label>
      <Respuesta estado={estado} />
      <BotonEnviar variante="secundario">Ceder el negocio</BotonEnviar>
    </form>
  );
}

export function FormularioDejar({ negocio }: { negocio: string }) {
  const [estado, accion] = useActionState(dejarNegocio, INICIAL);
  return (
    <form action={accion} className="grid gap-3">
      <p className="text-cacao">
        Dejarás de ver y editar <strong className="text-selva-2">{negocio}</strong>. Para volver,
        el dueño tendría que compartírtelo otra vez.
      </p>
      <Respuesta estado={estado} />
      <BotonEnviar variante="secundario">Dejar de administrar este negocio</BotonEnviar>
    </form>
  );
}
