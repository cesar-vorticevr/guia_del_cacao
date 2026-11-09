"use client";

import Link from "next/link";
import { elegirMarca } from "@/lib/negocio/elegir-marca";
import type { MarcaDeLaCuenta } from "@/lib/negocio/marca-activa";

/**
 * Qué negocio se administra (cuentas compartidas, fase 2). Con uno solo no hay
 * nada que elegir y solo queda «Crear otro negocio»; con varios, la lista se
 * cambia sin botón: elegir es la acción.
 */
export function SelectorDeNegocio({
  marcas,
  activa,
}: {
  marcas: MarcaDeLaCuenta[];
  activa: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {marcas.length > 1 && (
        <form action={elegirMarca}>
          <label className="flex items-center gap-2 text-sm font-bold text-selva-2">
            <span>Administras:</span>
            <select
              name="marca_id"
              defaultValue={activa}
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
              className="min-h-10 rounded-full border-2 border-selva/20 bg-[#fff] px-4 text-ink"
            >
              {marcas.map((m) => (
                <option key={m.marca_id} value={m.marca_id}>
                  {m.nombre_comercial}
                  {m.papel === "admin" ? " (compartido)" : ""}
                </option>
              ))}
            </select>
          </label>
          <noscript>
            <button type="submit" className="ml-2 font-bold underline">
              Cambiar
            </button>
          </noscript>
        </form>
      )}
      <Link
        href="/negocio/completar-marca?nueva=1"
        className="text-sm font-bold text-selva underline decoration-mango/50 underline-offset-4 hover:text-mango"
      >
        + Crear otro negocio
      </Link>
    </div>
  );
}
