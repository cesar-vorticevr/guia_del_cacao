import type { Metadata } from "next";
import { BotonesRol } from "@/components/admin/formularios";
import { todosLosPerfiles } from "@/lib/datos/admin";

export const metadata: Metadata = { title: "Personas · Guía del Cacao" };

const CUANDO = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export default async function Usuarios() {
  const perfiles = await todosLosPerfiles();

  return (
    <>
      <h1 className="font-display text-3xl">Personas</h1>
      <p className="mt-2 text-cacao">
        Esta es la única vía para nombrar a un administrador: el registro público
        nunca acepta ese rol, venga de donde venga.
      </p>

      <ul className="mt-6 grid gap-4">
        {perfiles.map((perfil) => (
          <li key={perfil.id} className="grid gap-3 rounded-3xl bg-crema-2 p-6">
            <div>
              <p className="font-display text-xl font-semibold text-selva-2">
                {perfil.nombre}
              </p>
              <p className="font-mono text-xs text-cacao/70">{perfil.correo}</p>
              <p className="mt-1 text-sm text-cacao/70">
                Desde {CUANDO.format(new Date(perfil.fecha_registro))}
              </p>
            </div>

            <BotonesRol perfilId={perfil.id} rolActual={perfil.rol} />
          </li>
        ))}
      </ul>
    </>
  );
}
