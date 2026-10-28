"use client";

import { useActionState, useState } from "react";
import { BotonEnviar } from "@/components/formulario";
import {
  canjearCodigo,
  guardarRuleta,
  type EstadoRuleta,
} from "@/lib/ruleta/acciones";
import type { Ruleta } from "@/lib/datos/ruleta";
import { RuletaMagica, type Gajo } from "@/components/ruleta/ruleta-magica";
import { TEXTO_DE_FRECUENCIA, type Frecuencia } from "@/lib/ruleta/textos";

const INICIAL: EstadoRuleta = {};

/** Para quien arma su primera ruleta: tres premios y tres gajos de suerte. */
const EJEMPLOS = ["10% de descuento", "Bebida de cacao gratis", "Caja de trufas"];

const SUERTE = "Suerte para la próxima";

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

/** Un renglón del formulario: un gajo, con su texto y si es suerte. */
type Renglon = { texto: string; suerte: boolean };

/**
 * Los seis gajos tal como los pintará la base (`gajos_de_ruleta`), pero con lo
 * que hay escrito ahora mismo: así la vista previa cambia con cada tecla, sin
 * guardar. Cada gajo vale lo mismo, como en Vórtice VR. Sin ningún premio
 * escrito se enseñan los ejemplos, para que la rueda no se vea vacía.
 */
function gajosDelFormulario(renglones: Renglon[], relleno: "suerte" | "repetir"): Gajo[] {
  let puestos = renglones
    .filter((r) => r.suerte || r.texto.trim())
    .map((r) => (r.suerte ? { texto: SUERTE, esPremio: false } : { texto: r.texto.trim(), esPremio: true }));
  if (!puestos.some((p) => p.esPremio)) puestos = EJEMPLOS.map((texto) => ({ texto, esPremio: true }));

  const sexto = 100 / 6;
  return [1, 2, 3, 4, 5, 6].map((gajo) => {
    const p =
      relleno === "repetir" ? puestos[(gajo - 1) % puestos.length] : (puestos[gajo - 1] ?? { texto: SUERTE, esPremio: false });
    return { gajo, texto: p.texto, esPremio: p.esPremio, probabilidad: sexto };
  });
}

/**
 * Armar la ruleta: hasta seis premios —cualquiera puede ser «Suerte para la
 * próxima»—, cómo se llenan los vacíos, cada cuánto se gira y cuántos días
 * vale lo ganado.
 *
 * **Sin porcentajes.** Antes cada gajo pedía su probabilidad y tenían que
 * sumar cien: era una cuenta que el negocio no tenía por qué hacer. Ahora,
 * como en Vórtice VR, los seis gajos valen lo mismo; un premio que se quiere
 * más seguido se escribe dos veces.
 *
 * **La ruleta se ve siempre.** La vista previa vive aquí y no en la página
 * porque se pinta con lo escrito, no con lo guardado: en escritorio queda fija
 * a la derecha mientras se baja por el formulario; en celular, arriba.
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
      if (p) return { texto: p.esPremio ? p.texto : "", suerte: !p.esPremio };
      if (!ruleta && EJEMPLOS[orden - 1]) return { texto: EJEMPLOS[orden - 1], suerte: false };
      return { texto: "", suerte: false };
    }),
  );
  const [relleno, setRelleno] = useState<"suerte" | "repetir">(ruleta?.relleno ?? "suerte");
  const [frecuencia, setFrecuencia] = useState<Frecuencia>(ruleta?.frecuencia ?? "diaria");
  const [vigencia, setVigencia] = useState(ruleta?.vigenciaDias ?? 30);

  const gajos = gajosDelFormulario(renglones, relleno);

  // Qué tan seguido sale cada cosa, contado en gajos: un premio escrito dos
  // veces sale el doble. Se lee, no se escribe.
  const veces = new Map<string, number>();
  for (const g of gajos) veces.set(g.texto, (veces.get(g.texto) ?? 0) + 1);

  const cambiar = (i: number, cambio: Partial<Renglon>) =>
    setRenglones((todos) => todos.map((r, n) => (n === i ? { ...r, ...cambio } : r)));

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
    <form action={guardar} className="grid gap-6 rounded-3xl border-2 border-ink/10 bg-white p-6">
      <h2 className="font-display text-2xl">Tu ruleta</h2>
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
        <legend className="mb-1 font-bold text-selva-2">Tus premios</legend>
        <p className="-mt-1 text-sm text-cacao/75">
          La ruleta tiene seis gajos y todos salen igual de seguido. Si quieres que un premio salga
          más, escríbelo dos veces.
        </p>
        {renglones.map((r, i) => (
          <div key={i} className="grid grid-cols-[1fr_auto] items-center gap-3">
            <input
              name={`premio_${i + 1}`}
              value={r.suerte ? SUERTE : r.texto}
              onChange={(e) => cambiar(i, { texto: e.target.value })}
              disabled={r.suerte}
              maxLength={40}
              placeholder={`Gajo ${i + 1} · un premio`}
              aria-label={`Gajo ${i + 1}`}
              className="min-h-12 min-w-0 rounded-2xl border-2 border-selva/20 bg-white px-4 text-ink disabled:opacity-70"
            />
            <label className="flex items-center gap-2 text-sm">
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
      </fieldset>

      <fieldset className="grid gap-2">
        <legend className="mb-2 font-bold text-selva-2">Los gajos que dejes vacíos…</legend>
        {[
          ["suerte", "Dicen «Suerte para la próxima»"],
          ["repetir", "Repiten mis premios"],
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
              checked={frecuencia === clave}
              onChange={() => setFrecuencia(clave)}
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
          value={vigencia || ""}
          onChange={(e) => setVigencia(Number(e.target.value))}
          className="min-h-12 w-32 rounded-2xl border-2 border-selva/20 bg-white px-4 text-ink"
        />
      </label>

      <Mensaje estado={estado} />
      <BotonEnviar>Guardar mi ruleta</BotonEnviar>
    </form>

    {/*
      Pegada arriba siempre, para que la rueda no se pierda mientras se escribe:
      en celular va primero y chica —la lista de chances se esconde, que ahí
      ocupa media pantalla—; en escritorio, a la derecha y más grande.
    */}
    <aside
      className="sticky top-2 z-10 lg:top-[4.5rem] order-first rounded-3xl border-2 border-mango/50 p-4 text-crema shadow-[0_0_40px_rgb(255_183_3/0.2)] lg:order-none lg:p-6"
      style={{ background: "linear-gradient(180deg, #1c1236 0%, #0f2a22 70%, #08150f 100%)" }}
    >
      <p className="antetitulo">Vista previa · gírala para probar</p>
      <div className="mt-3 lg:mt-4">
        <RuletaMagica
          anchoRueda="max-w-[9rem] lg:max-w-[17rem]"
          modo="vista-previa"
          sucursalId={sucursalId}
          gajos={gajos}
          reglas={`${TEXTO_DE_FRECUENCIA[frecuencia]} · el premio vale ${vigencia || 1} ${vigencia === 1 ? "día" : "días"}`}
          puedeGirar
          motivo={null}
          volver="/negocio/panel/ruleta"
          frecuenciaDiaria={false}
          enlacePremios="/negocio/panel/cuenta?ver=premios"
        />
      </div>
      <ul className="mt-5 hidden gap-1.5 text-sm lg:grid" aria-label="Qué tan seguido sale cada uno">
        {[...veces].map(([texto, n]) => (
          <li key={texto} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
            <span className="truncate">{texto}</span>
            <span className="font-mono text-xs text-crema/60">
              {n} de 6 · {Math.round((n * 1000) / 6) / 10}%
            </span>
            <span className="col-span-2 block h-1.5 overflow-hidden rounded-full bg-crema/10">
              <span className="block h-full rounded-full bg-mango" style={{ width: `${(n * 100) / 6}%` }} />
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-4 hidden text-center text-xs text-crema/60 lg:block">
        Cambia con lo que escribes. En la vista previa no se guarda ningún premio.
      </p>
    </aside>
    </div>
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
