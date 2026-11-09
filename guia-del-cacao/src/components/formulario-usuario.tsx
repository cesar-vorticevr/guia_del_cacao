"use client";

import { useActionState } from "react";
import { Aviso, BotonEnviar } from "@/components/formulario";
import { cambiarUsuario } from "@/lib/auth/acciones";

/**
 * El @usuario de la cuenta. Es como te encuentra alguien para compartirte la
 * administración de un negocio, así que se enseña con su arroba y se puede
 * cambiar, aunque solo una vez cada 30 días (lo cuida la base).
 */
export function FormularioUsuario({ usuario }: { usuario: string }) {
  const [estado, accion] = useActionState(cambiarUsuario, {});

  return (
    <form action={accion} className="grid gap-3">
      <label className="block">
        <span className="mb-1.5 block font-bold text-selva-2">Tu @usuario</span>
        {/* `bg-[#fff]` y no `bg-white`: `.noche` oscurece `bg-white`, y aquí va letra oscura. */}
        <span className="flex items-center rounded-2xl border-2 border-selva/20 bg-[#fff] focus-within:border-mango">
          <span className="pl-4 font-bold text-cacao/60" aria-hidden="true">@</span>
          <input
            name="usuario"
            defaultValue={usuario}
            required
            minLength={3}
            maxLength={30}
            pattern="@?[A-Za-z0-9._]{3,30}"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="w-full rounded-2xl bg-transparent py-3 pr-4 pl-1 text-ink focus:outline-none"
          />
        </span>
        <span className="mt-1.5 block text-sm text-cacao/80">
          Con él te encuentran para compartirte la administración de un negocio. Se puede cambiar una vez cada 30 días.
        </span>
      </label>
      <Aviso>{estado.error}</Aviso>
      {estado.ok && (
        <p role="status" className="font-bold text-selva-2">
          {estado.ok}
        </p>
      )}
      <BotonEnviar variante="secundario">Guardar mi @usuario</BotonEnviar>
    </form>
  );
}
