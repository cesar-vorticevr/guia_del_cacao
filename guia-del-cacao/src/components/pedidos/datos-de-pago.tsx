"use client";

import { useActionState, useState } from "react";
import { Aviso, BotonEnviar } from "@/components/formulario";
import { guardarDatosDePago, type EstadoPedido } from "@/lib/pedidos/acciones";
import type { DatosDePago } from "@/lib/datos/pedidos";

const INICIAL: EstadoPedido = {};

const CAMPO =
  "min-h-12 w-full rounded-2xl border-2 border-selva/20 bg-white px-4 text-base text-ink focus:border-selva";

/**
 * A dónde le transfieren al negocio. El cliente solo los ve cuando el negocio
 * confirma su pedido, y le llegan al chat en ese momento.
 *
 * La CLABE la revisa la base (dígito de control): un número mal copiado manda
 * el dinero de un cliente a ninguna parte. Si falla, lo escrito vuelve a los
 * campos («Un formulario que falla no se vacía», AGENTS.md).
 */
export function FormularioDatosDePago({
  datos,
}: {
  datos: (DatosDePago & { recibe_pedidos: boolean }) | null;
}) {
  const [estado, accion] = useActionState(guardarDatosDePago, INICIAL);
  const [vuelta, setVuelta] = useState(0);
  const [ultimo, setUltimo] = useState(estado);

  if (estado !== ultimo) {
    setUltimo(estado);
    setVuelta((v) => v + 1);
  }

  const v = estado.valores ?? {
    banco: datos?.banco ?? "",
    titular: datos?.titular ?? "",
    clabe: datos?.clabe ?? "",
    instrucciones: datos?.instrucciones ?? "",
    recibe_pedidos: datos?.recibe_pedidos === false ? "" : "on",
  };

  return (
    <form action={accion} className="grid max-w-xl gap-4">
      <div key={vuelta} className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block font-bold text-selva-2">Banco</span>
            <input name="banco" required maxLength={60} defaultValue={v.banco} placeholder="BBVA, Banorte, Nu…" className={CAMPO} />
          </label>
          <label className="block">
            <span className="mb-1.5 block font-bold text-selva-2">Titular de la cuenta</span>
            <input name="titular" required maxLength={120} defaultValue={v.titular} className={CAMPO} />
          </label>
        </div>

        <label className="block">
          <span className="mb-1.5 block font-bold text-selva-2">CLABE (18 dígitos)</span>
          <input
            name="clabe"
            required
            inputMode="numeric"
            maxLength={24}
            defaultValue={v.clabe}
            className={`${CAMPO} font-mono tracking-wide`}
          />
          <span className="mt-1.5 block text-sm text-cacao/70">
            El titular que ve el cliente en su banco al transferir debe coincidir con este: es lo
            que le da confianza.
          </span>
        </label>

        <label className="block">
          <span className="mb-1.5 block font-bold text-selva-2">Instrucciones (opcional)</span>
          <textarea
            name="instrucciones"
            rows={3}
            maxLength={500}
            defaultValue={v.instrucciones}
            placeholder="Pon el número de pedido en el concepto. Entregamos de martes a sábado…"
            className="w-full rounded-2xl border-2 border-selva/20 bg-white px-4 py-3 text-base text-ink focus:border-selva"
          />
        </label>

        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            name="recibe_pedidos"
            defaultChecked={v.recibe_pedidos === "on"}
            className="mt-0.5 size-5 shrink-0 accent-selva"
          />
          <span>
            <span className="block font-bold text-selva-2">Recibir pedidos</span>
            <span className="mt-1 block text-sm text-cacao/80">
              Apágalo si te vas de vacaciones o te quedas sin producto: tu catálogo se sigue viendo,
              sin el botón de pedir.
            </span>
          </span>
        </label>
      </div>

      {estado.error && <Aviso>{estado.error}</Aviso>}
      {estado.ok && (
        <p role="status" className="font-bold text-selva">
          {estado.ok}
        </p>
      )}

      <div className="max-w-xs">
        <BotonEnviar>Guardar</BotonEnviar>
      </div>
    </form>
  );
}
