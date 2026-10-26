"use client";

import { useActionState, useState } from "react";
import { BotonEnviar } from "@/components/formulario";
import {
  canjearCodigo,
  guardarRuleta,
  type EstadoRuleta,
} from "@/lib/ruleta/acciones";
import type { Ruleta } from "@/lib/datos/ruleta";
import { TEXTO_DE_FRECUENCIA, type Frecuencia } from "@/lib/ruleta/textos";

const INICIAL: EstadoRuleta = {};

/** Para quien arma su primera ruleta: tres premios y un 40% de suerte. */
const EJEMPLOS = [
  { texto: "10% de descuento", probabilidad: 35 },
  { texto: "Bebida de cacao gratis", probabilidad: 20 },
  { texto: "Caja de trufas", probabilidad: 5 },
];

function Mensaje({ estado }: { estado: EstadoRuleta }) {
  if (estado.error) {
    return (
      <p role="alert" className="rounded-2xl border-2 border-guayaba/40 bg-guayaba/10 px-4 py-3 font-bold">
        {estado.error}
      </p>
    );
  }
  if (estado.ok) {
    return (
      <p role="status" className="rounded-2xl border-2 border-lima/60 bg-lima/20 px-4 py-3 font-bold text-selva-2">
        {estado.ok}
      </p>
    );
  }
  return null;
}

/** Un renglón del formulario: un gajo, con su texto, su chance y si es suerte. */
type Renglon = { texto: string; probabilidad: number; suerte: boolean };

/**
 * Armar la ruleta: hasta seis gajos con su probabilidad —cualquiera puede ser
 * «Suerte para la próxima»—, cómo se llenan los vacíos, cada cuánto se gira y
 * cuántos días vale lo ganado. La cuenta se ve mientras se escribe y dice qué
 * pasa con lo que falta para 100.
 */
export function FormularioRuleta({
  sucursalId,
  ruleta,
}: {
  sucursalId: string;
  ruleta: Ruleta | null;
}) {
  const [estado, guardar] = useActionState(guardarRuleta, INICIAL);
  const [renglones, setRenglones] = useState<Renglon[]>(() =>
    [1, 2, 3, 4, 5, 6].map((orden) => {
      const p = ruleta?.premios.find((x) => x.orden === orden);
      if (p) return { texto: p.esPremio ? p.texto : "", probabilidad: p.probabilidad, suerte: !p.esPremio };
      if (!ruleta && EJEMPLOS[orden - 1]) return { ...EJEMPLOS[orden - 1], suerte: false };
      return { texto: "", probabilidad: 0, suerte: false };
    }),
  );
  const [relleno, setRelleno] = useState(ruleta?.relleno ?? "suerte");

  const puestos = renglones.filter((r) => r.suerte || r.texto.trim());
  const suma = Math.round(puestos.reduce((t, r) => t + (Number(r.probabilidad) || 0), 0) * 100) / 100;
  const vacios = 6 - puestos.length;

  const cambiar = (i: number, cambio: Partial<Renglon>) =>
    setRenglones((todos) => todos.map((r, n) => (n === i ? { ...r, ...cambio } : r)));

  // Lo que se le dice a quien llena: qué le falta o qué pasará con el resto.
  const cuenta =
    vacios === 0 || relleno === "repetir"
      ? suma === 100
        ? { bien: true, texto: `Suman 100% ✓${vacios > 0 ? " · los gajos vacíos repiten tus premios" : ""}` }
        : { bien: false, texto: `Suman ${suma}% · tienen que sumar 100%` }
      : suma < 100
        ? {
            bien: true,
            texto: `Suman ${suma}% ✓ · el ${Math.round((100 - suma) * 100) / 100}% que falta es «Suerte para la próxima» en ${vacios === 1 ? "el gajo vacío" : `los ${vacios} gajos vacíos`}`,
          }
        : { bien: false, texto: `Suman ${suma}% · deja algo de chance para la suerte, o elige repetir premios` };

  return (
    <form action={guardar} className="grid gap-6">
      <input type="hidden" name="sucursal_id" value={sucursalId} />

      <label className="flex items-center gap-3 font-bold">
        <input
          type="checkbox"
          name="activa"
          value="si"
          defaultChecked={ruleta?.activa ?? true}
          className="size-5 accent-[#ffb703]"
        />
        Ruleta encendida en mi micrositio
      </label>

      <fieldset className="grid gap-3">
        <legend className="mb-2 font-bold text-selva-2">Los seis gajos</legend>
        {renglones.map((r, i) => (
          <div key={i} className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_auto_auto]">
            <input
              name={`premio_${i + 1}`}
              value={r.suerte ? "Suerte para la próxima" : r.texto}
              onChange={(e) => cambiar(i, { texto: e.target.value })}
              disabled={r.suerte}
              maxLength={40}
              placeholder={`Gajo ${i + 1} · un premio`}
              aria-label={`Gajo ${i + 1}`}
              className="min-h-12 min-w-0 rounded-2xl border-2 border-selva/20 bg-white px-4 text-ink disabled:opacity-70"
            />
            <label className="flex min-h-12 w-24 shrink-0 items-center gap-1 rounded-2xl border-2 border-selva/20 bg-[#fff] px-3 text-[#22150e]">
              <span className="sr-only">Probabilidad del gajo {i + 1}</span>
              <input
                name={`probabilidad_${i + 1}`}
                type="number"
                min={0}
                max={100}
                step="0.5"
                value={r.probabilidad || ""}
                onChange={(e) => cambiar(i, { probabilidad: Number(e.target.value) })}
                className="w-full bg-transparent text-right outline-none"
              />
              %
            </label>
            <label className="col-span-2 flex items-center gap-2 text-sm sm:col-span-1">
              <input
                type="checkbox"
                name={`suerte_${i + 1}`}
                value="si"
                checked={r.suerte}
                onChange={(e) => cambiar(i, { suerte: e.target.checked })}
                className="size-4 accent-[#ffb703]"
              />
              🍀 Suerte
            </label>
          </div>
        ))}
        <p className={`text-sm font-bold ${cuenta.bien ? "text-lima" : "text-guayaba"}`}>{cuenta.texto}</p>
      </fieldset>

      <fieldset className="grid gap-2">
        <legend className="mb-2 font-bold text-selva-2">Los gajos que dejes vacíos…</legend>
        {[
          ["suerte", "Dicen «Suerte para la próxima»"],
          ["repetir", "Repiten mis premios (el chance no cambia)"],
        ].map(([valor, texto]) => (
          <label key={valor} className="flex items-center gap-3">
            <input
              type="radio"
              name="relleno"
              value={valor}
              checked={relleno === valor}
              onChange={() => setRelleno(valor as "suerte" | "repetir")}
              className="size-5 accent-[#ffb703]"
            />
            {texto}
          </label>
        ))}
        <p className="text-sm text-cacao/70">
          Lo que ya ganó alguien no cambia aunque cambies tus premios.
        </p>
      </fieldset>

      <fieldset className="grid gap-2">
        <legend className="mb-2 font-bold text-selva-2">¿Cada cuánto se puede girar?</legend>
        {(Object.keys(TEXTO_DE_FRECUENCIA) as Frecuencia[]).map((clave) => (
          <label key={clave} className="flex items-center gap-3">
            <input
              type="radio"
              name="frecuencia"
              value={clave}
              defaultChecked={(ruleta?.frecuencia ?? "diaria") === clave}
              className="size-5 accent-[#ffb703]"
            />
            {TEXTO_DE_FRECUENCIA[clave]}
          </label>
        ))}
      </fieldset>

      <label className="grid gap-1.5">
        <span className="font-bold text-selva-2">¿Cuántos días vale el premio?</span>
        <input
          name="vigencia_dias"
          type="number"
          min={1}
          max={365}
          defaultValue={ruleta?.vigenciaDias ?? 30}
          className="min-h-12 w-32 rounded-2xl border-2 border-selva/20 bg-white px-4 text-ink"
        />
      </label>

      <Mensaje estado={estado} />
      <BotonEnviar>Guardar mi ruleta</BotonEnviar>
    </form>
  );
}

/** El cliente enseña su código: se escribe y se marca entregado. */
export function CanjearPremio() {
  const [estado, canjear] = useActionState(canjearCodigo, INICIAL);

  return (
    <form action={canjear} className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        <input
          name="codigo"
          required
          maxLength={20}
          placeholder="MAZ-7K2PQ"
          aria-label="Código del premio"
          autoComplete="off"
          className="min-h-12 min-w-0 flex-1 rounded-full border-2 border-selva/20 bg-white px-5 font-mono uppercase text-ink"
        />
        <button
          type="submit"
          className="boton-oro brillo min-h-12 shrink-0 rounded-full px-6 font-bold text-ink"
        >
          Canjear
        </button>
      </div>
      <Mensaje estado={estado} />
    </form>
  );
}
