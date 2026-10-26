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

const EJEMPLOS = [
  { texto: "10% de descuento", probabilidad: 60 },
  { texto: "Bebida de cacao gratis", probabilidad: 30 },
  { texto: "Caja de trufas", probabilidad: 10 },
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

/**
 * Armar la ruleta: tres premios con su probabilidad, cada cuánto se gira y
 * cuántos días vale lo que se gana. La suma de las probabilidades se ve
 * mientras se escribe, en verde cuando ya da cien.
 */
export function FormularioRuleta({
  sucursalId,
  ruleta,
}: {
  sucursalId: string;
  ruleta: Ruleta | null;
}) {
  const [estado, guardar] = useActionState(guardarRuleta, INICIAL);
  const inicial = [1, 2, 3].map(
    (orden) =>
      ruleta?.premios.find((p) => p.orden === orden) ?? {
        orden,
        ...(ruleta ? { texto: "", probabilidad: 0 } : EJEMPLOS[orden - 1]),
      },
  );
  const [probabilidades, setProbabilidades] = useState(inicial.map((p) => p.probabilidad));
  const suma = probabilidades.reduce((total, p) => total + (Number(p) || 0), 0);

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
        <legend className="mb-2 font-bold text-selva-2">Los premios</legend>
        {inicial.map((premio, i) => (
          <div key={premio.orden} className="flex gap-2">
            <input
              name={`premio_${premio.orden}`}
              defaultValue={premio.texto}
              maxLength={60}
              placeholder={`Premio ${premio.orden}`}
              aria-label={`Premio ${premio.orden}`}
              className="min-h-12 min-w-0 flex-1 rounded-2xl border-2 border-selva/20 bg-white px-4 text-ink"
            />
            <label className="flex min-h-12 w-28 shrink-0 items-center gap-1 rounded-2xl border-2 border-selva/20 bg-[#fff] px-3 text-[#22150e]">
              <span className="sr-only">Probabilidad del premio {premio.orden}</span>
              <input
                name={`probabilidad_${premio.orden}`}
                type="number"
                min={0}
                max={100}
                defaultValue={premio.probabilidad || ""}
                onChange={(evento) => {
                  const nuevas = [...probabilidades];
                  nuevas[i] = Number(evento.target.value);
                  setProbabilidades(nuevas);
                }}
                className="w-full bg-transparent text-right outline-none"
              />
              %
            </label>
          </div>
        ))}
        <p className={`text-sm font-bold ${suma === 100 ? "text-lima" : "text-guayaba"}`}>
          Suman {suma}% {suma === 100 ? "✓" : "· tienen que sumar 100%"}
        </p>
        <p className="text-sm text-cacao/70">
          Los premios que dejes en blanco no salen. Lo que ya ganó alguien no cambia
          aunque cambies tus premios.
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
