"use client";

import { useActionState, useState } from "react";
import { Aviso, BotonEnviar } from "@/components/formulario";
import {
  cambiarRol,
  crearConvenio,
  type EstadoAccion,
} from "@/lib/admin/acciones";
import { cambiarEmbajador } from "@/lib/admin/embajadores";

const INICIAL: EstadoAccion = {};

const ROLES = [
  { valor: "cliente", texto: "Cliente" },
  { valor: "negocio", texto: "Negocio" },
  { valor: "admin", texto: "Administrador" },
];

/**
 * Cambio de rol. Un formulario por opcion y el rol en un campo oculto: React
 * descarta `name`/`value` en un boton que lleva `formAction` con funcion.
 */
export function BotonesRol({
  perfilId,
  rolActual,
}: {
  perfilId: string;
  rolActual: string;
}) {
  const [estado, accion] = useActionState(cambiarRol, INICIAL);

  return (
    <div className="grid gap-2">
      {estado.error && <Aviso>{estado.error}</Aviso>}
      {estado.ok && (
        <p role="status" className="text-sm font-bold text-selva">
          {estado.ok}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {ROLES.map((rol) => (
          <form key={rol.valor} action={accion}>
            <input type="hidden" name="perfil_id" value={perfilId} />
            <input type="hidden" name="rol" value={rol.valor} />
            <button
              type="submit"
              disabled={rol.valor === rolActual}
              aria-current={rol.valor === rolActual}
              className={`min-h-10 rounded-full px-4 text-sm font-bold ${
                rol.valor === rolActual
                  ? "cursor-default bg-selva text-crema"
                  : "border-2 border-selva/25 bg-white text-selva-2"
              }`}
            >
              {rol.texto}
            </button>
          </form>
        ))}
      </div>
    </div>
  );
}

/**
 * Hacer embajadora a una persona o ponerla en pausa. Ser embajador no es un
 * rol: va aparte de los tres botones de arriba y se suma a cualquiera.
 */
export function BotonEmbajador({
  perfilId,
  embajador,
}: {
  perfilId: string;
  embajador: { estado: string; codigo: string | null } | null;
}) {
  const [estado, accion] = useActionState(cambiarEmbajador, INICIAL);
  const activo = embajador?.estado === "activo";

  return (
    <div className="grid gap-2">
      {estado.error && <Aviso>{estado.error}</Aviso>}
      {estado.ok && (
        <p role="status" className="text-sm font-bold text-selva">
          {estado.ok}
        </p>
      )}

      <form action={accion} className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="perfil_id" value={perfilId} />
        <input type="hidden" name="activar" value={activo ? "0" : "1"} />
        <button
          type="submit"
          aria-pressed={activo}
          className={`min-h-10 rounded-full px-4 text-sm font-bold ${
            activo
              ? "bg-mango text-ink"
              : "border-2 border-mango/50 bg-white text-selva-2"
          }`}
        >
          {activo ? "✓ Embajador" : "Hacer embajador"}
        </button>
        {embajador?.codigo && embajador.estado !== "solicitado" && (
          <span className="text-sm text-cacao/80">
            Código <span className="font-mono font-bold">{embajador.codigo}</span>
            {embajador.estado === "pausado" && " · en pausa"}
            {activo && " · pulsa para pausar"}
          </span>
        )}
      </form>
    </div>
  );
}

/**
 * Un código de promoción nuevo.
 *
 * Dice las cuatro cosas que definen un código: hasta cuándo se puede usar,
 * cuántas veces, qué plan da y con cuánto descuento (100% = gratis), y hasta
 * cuándo dura lo que da.
 */
export function FormularioConvenio({
  planes,
}: {
  /** Los planes de pago, para elegir el que da el código. */
  planes: { id: number; nombre: string }[];
}) {
  const [estado, accion] = useActionState(crearConvenio, INICIAL);
  const [gratis, setGratis] = useState(false);
  const clase =
    "w-full rounded-2xl border-2 border-selva/20 bg-white px-4 py-3 text-base text-ink focus:border-selva";

  return (
    <form action={accion} className="grid gap-4">
      {estado.error && <Aviso>{estado.error}</Aviso>}
      {estado.ok && (
        <p role="status" className="font-bold text-selva">
          {estado.ok}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block font-bold text-selva-2">Código</span>
          <input
            name="codigo"
            required
            placeholder="APERTURA"
            className={`${clase} font-mono uppercase`}
          />
          <span className="mt-1.5 block text-sm text-cacao/70">
            Solo letras y números. Es lo que el negocio escribe.
          </span>
        </label>
        <label className="block">
          <span className="mb-1.5 block font-bold text-selva-2">
            ¿Cuántos códigos?
          </span>
          <input
            name="usos_maximos"
            type="number"
            min={1}
            required
            defaultValue={50}
            className={clase}
          />
          <span className="mt-1.5 block text-sm text-cacao/70">
            Cuántos negocios lo pueden usar. Se va gastando: uno por sucursal.
          </span>
        </label>
      </div>

      <label className="block">
        <span className="mb-1.5 block font-bold text-selva-2">Para qué es</span>
        <input
          name="descripcion"
          required
          placeholder="Apertura del Festival del Chocolate: Pro a mitad de precio"
          className={clase}
        />
        <span className="mt-1.5 block text-sm text-cacao/70">
          Lo lee el negocio al aplicar el código.
        </span>
      </label>

      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-1.5 font-bold text-selva-2">
          Se puede usar
        </legend>
        <label className="block">
          <span className="mb-1.5 block text-sm text-cacao/70">Desde</span>
          <input name="vigente_desde" type="date" required className={clase} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm text-cacao/70">
            Hasta (último día para pagar)
          </span>
          <input name="vigente_hasta" type="date" required className={clase} />
        </label>
      </fieldset>

      <fieldset className="grid gap-3 rounded-2xl bg-white p-4">
        <legend className="px-1 font-bold text-selva-2">Qué da el código</legend>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm text-cacao/70">Plan</span>
            <select name="plan_id" required defaultValue={planes.at(-1)?.id} className={clase}>
              {planes.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.nombre}
                </option>
              ))}
            </select>
          </label>

          <div>
            <span className="mb-1.5 block text-sm text-cacao/70">Beneficio</span>
            <div className="flex gap-2">
              {[
                { valor: false, texto: "Descuento" },
                { valor: true, texto: "Gratis" },
              ].map((opcion) => (
                <label
                  key={opcion.texto}
                  className={`flex min-h-12 flex-1 cursor-pointer items-center justify-center rounded-2xl border-2 px-3 font-bold ${
                    gratis === opcion.valor
                      ? "border-selva bg-selva text-crema"
                      : "border-selva/20 text-selva-2"
                  }`}
                >
                  <input
                    type="radio"
                    name="beneficio"
                    checked={gratis === opcion.valor}
                    onChange={() => setGratis(opcion.valor)}
                    className="sr-only"
                  />
                  {opcion.texto}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {gratis ? (
            <input type="hidden" name="descuento" value={100} />
          ) : (
            <label className="block">
              <span className="mb-1.5 block text-sm text-cacao/70">
                Descuento (%)
              </span>
              <input
                name="descuento"
                type="number"
                min={1}
                max={99}
                required
                defaultValue={50}
                className={clase}
              />
            </label>
          )}
          <label className="block">
            <span className="mb-1.5 block text-sm text-cacao/70">
              La promoción dura hasta
            </span>
            <input name="cubre_hasta" type="date" required className={clase} />
          </label>
        </div>

        <p className="text-sm text-cacao/70">
          {gratis
            ? "El negocio tiene el plan sin pagar nada hasta esa fecha."
            : "El negocio paga un mes del plan con el descuento y queda cubierto hasta esa fecha."}{" "}
          Al día siguiente se le cobra el precio normal.
        </p>
      </fieldset>

      <BotonEnviar variante="secundario">Crear código</BotonEnviar>
    </form>
  );
}
