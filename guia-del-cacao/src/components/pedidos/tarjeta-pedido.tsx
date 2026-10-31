"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Aviso } from "@/components/formulario";
import {
  avisarPago,
  cambiarEstadoPedido,
  type EstadoPedido,
} from "@/lib/pedidos/acciones";
import { ESTADOS_DE_PEDIDO } from "@/lib/pedidos/textos";
import type { DatosDePago, Pedido } from "@/lib/datos/pedidos";
import { pesos } from "@/lib/tipos";

const INICIAL: EstadoPedido = {};

const BOTON =
  "min-h-11 rounded-full px-5 font-bold transition-colors disabled:opacity-60";
const BOTON_ORO = `${BOTON} boton-oro brillo text-ink`;
const BOTON_SUAVE = `${BOTON} border-2 border-mango/40 bg-white text-selva-2 hover:border-mango hover:text-mango`;

/**
 * Un pedido, para quien lo hizo o para el negocio, con los botones del paso
 * que le toca a cada quien. Quién puede qué lo vuelve a decidir la base
 * (`cambiar_estado_pedido`); aquí solo no se enseña lo que no va.
 *
 * Las horas (`cuando`) llegan ya escritas del servidor, como en el buzón:
 * calcularlas aquí daría una en el servidor y otra en el navegador.
 */
export function TarjetaPedido({
  pedido,
  cuando,
  enChat = false,
}: {
  pedido: Pedido;
  cuando: string;
  /** Dentro de la conversación no hace falta el enlace a ella. */
  enChat?: boolean;
}) {
  const estado = ESTADOS_DE_PEDIDO[pedido.estado];
  const vendedor = pedido.soy_vendedor;
  const sinPrecio = pedido.renglones.some((r) => r.precio === null);
  const cerrado = pedido.estado === "entregado" || pedido.estado === "cancelado";

  return (
    <article
      className={`grid gap-4 rounded-3xl border-2 bg-white p-5 text-cacao ${
        pedido.estado === "nuevo" && vendedor ? "border-mango" : "border-ink/10"
      } ${cerrado ? "opacity-80" : ""}`}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs tracking-wide text-cacao/60 uppercase">
            Pedido #{pedido.folio} · {cuando}
          </p>
          <h3 className="font-display text-xl text-selva-2">
            {vendedor ? pedido.otro_nombre : pedido.marca_nombre}
          </h3>
          {(!vendedor || pedido.sucursal_nombre) && (
            <p className="text-sm text-cacao/70">{pedido.sucursal_nombre}</p>
          )}
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-extrabold ${estado.color}`}>
          {estado.texto}
        </span>
      </header>

      <ul className="grid gap-1">
        {pedido.renglones.map((r) => (
          <li key={r.nombre} className="flex justify-between gap-3">
            <span>
              {r.cantidad} × {r.nombre}
            </span>
            <span className="shrink-0 font-mono">
              {r.precio === null ? "por confirmar" : pesos(r.precio * r.cantidad)}
            </span>
          </li>
        ))}
        <li className="mt-1 flex justify-between gap-3 border-t-2 border-ink/10 pt-2 font-bold text-selva-2">
          <span>{pedido.total === null ? "Subtotal" : "Total"}</span>
          <span className="font-mono">
            {pesos(pedido.total ?? pedido.subtotal)}
            {pedido.total === null && sinPrecio && " + por confirmar"}
          </span>
        </li>
      </ul>

      <dl className="grid gap-1 text-sm">
        <div>
          <dt className="inline font-bold text-selva-2">Entrega: </dt>
          <dd className="inline">
            {pedido.entrega === "envio" ? `envío a ${pedido.direccion}` : "recoge en la sucursal"}
          </dd>
        </div>
        {pedido.nota && (
          <div>
            <dt className="inline font-bold text-selva-2">Nota: </dt>
            <dd className="inline">{pedido.nota}</dd>
          </div>
        )}
        {pedido.motivo_cancelado && (
          <div>
            <dt className="inline font-bold text-guayaba">Motivo: </dt>
            <dd className="inline">{pedido.motivo_cancelado}</dd>
          </div>
        )}
        {pedido.aviso_de_pago_en && pedido.estado === "confirmado" && (
          <div className="font-bold text-selva">
            {vendedor ? "El cliente dice que ya transfirió: revisa tu banco." : "Ya avisaste que transferiste."}
          </div>
        )}
      </dl>

      <p className="rounded-2xl bg-crema-2 px-4 py-3 text-sm">
        {vendedor ? estado.negocio : estado.cliente}
      </p>

      {!vendedor && pedido.pago && pedido.estado === "confirmado" && (
        <DatosParaTransferir pago={pedido.pago} total={pedido.total} folio={pedido.folio} />
      )}

      {!cerrado && <Acciones pedido={pedido} sinPrecio={sinPrecio} />}

      {!enChat && (
        <Link
          href={`/buzon/${pedido.conversacion_id}`}
          className="justify-self-start text-sm font-bold text-mango underline underline-offset-4"
        >
          Abrir la conversación →
        </Link>
      )}
    </article>
  );
}

/** A dónde transferir, con la CLABE para copiar de un toque. */
function DatosParaTransferir({
  pago,
  total,
  folio,
}: {
  pago: DatosDePago;
  total: number | null;
  folio: number;
}) {
  const [copiada, setCopiada] = useState(false);

  return (
    <div className="grid gap-2 rounded-2xl border-2 border-selva/30 p-4">
      <p className="font-bold text-selva-2">
        Transfiere {total !== null && <span className="font-mono">{pesos(total)}</span>} a:
      </p>
      <dl className="grid gap-0.5 text-sm">
        <div>
          <dt className="inline text-cacao/70">Banco: </dt>
          <dd className="inline font-bold">{pago.banco}</dd>
        </div>
        <div>
          <dt className="inline text-cacao/70">Titular: </dt>
          <dd className="inline font-bold">{pago.titular}</dd>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <dt className="text-cacao/70">CLABE:</dt>
          <dd className="font-mono text-base font-bold tracking-wide">{pago.clabe}</dd>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(pago.clabe).then(() => setCopiada(true), () => {});
            }}
            className="rounded-full border-2 border-mango/40 px-3 py-0.5 text-xs font-bold hover:border-mango"
          >
            {copiada ? "Copiada" : "Copiar"}
          </button>
        </div>
      </dl>
      {pago.instrucciones && <p className="text-sm whitespace-pre-line">{pago.instrucciones}</p>}
      <p className="text-xs text-cacao/70">
        En el concepto pon «Pedido {folio}». Revisa que el titular sea el de este negocio antes de
        mandar. El dinero va directo a él: la Guía del Cacao no lo cobra ni lo guarda.
      </p>
    </div>
  );
}

function Acciones({ pedido, sinPrecio }: { pedido: Pedido; sinPrecio: boolean }) {
  const [estado, accion, enviando] = useActionState(cambiarEstadoPedido, INICIAL);
  const [aviso, accionAviso, avisando] = useActionState(avisarPago, INICIAL);
  const vendedor = pedido.soy_vendedor;

  // Si falla, lo escrito vuelve a su campo (React 19 vacía el formulario).
  const [vuelta, setVuelta] = useState(0);
  const [ultimo, setUltimo] = useState(estado);
  if (estado !== ultimo) {
    setUltimo(estado);
    setVuelta((v) => v + 1);
  }
  const previo = estado.valores;
  const totalEscrito = previo?.estado === "confirmado" ? previo.total : undefined;
  const motivoEscrito = (paso: string) => (previo?.estado === paso ? previo.motivo : undefined);

  const ocultos = (
    <>
      <input type="hidden" name="pedido_id" value={pedido.id} />
      <input type="hidden" name="conversacion_id" value={pedido.conversacion_id} />
    </>
  );

  const puedeCancelar = vendedor
    ? ["nuevo", "confirmado", "pagado"].includes(pedido.estado)
    : ["nuevo", "confirmado"].includes(pedido.estado);

  return (
    <div className="grid gap-3">
      {estado.error && <Aviso>{estado.error}</Aviso>}
      {aviso.error && <Aviso>{aviso.error}</Aviso>}

      {vendedor && pedido.estado === "nuevo" && (
        <form action={accion} className="grid gap-2 rounded-2xl border-2 border-mango/40 p-4">
          {ocultos}
          <input type="hidden" name="estado" value="confirmado" />
          <label className="block">
            <span className="mb-1 block font-bold text-selva-2">
              Total a pagar{sinPrecio ? "" : " (con envío, si lleva)"}
            </span>
            <input
              key={vuelta}
              name="total"
              inputMode="decimal"
              required={sinPrecio}
              defaultValue={totalEscrito ?? (sinPrecio ? "" : String(pedido.subtotal))}
              placeholder={sinPrecio ? "Hay productos sin precio: escribe el total" : undefined}
              className="min-h-12 w-full rounded-2xl border-2 border-selva/20 bg-white px-4 font-mono text-base text-ink focus:border-selva"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-selva-2">
              Algo más para el cliente (opcional)
            </span>
            <input
              key={vuelta}
              defaultValue={motivoEscrito("confirmado")}
              name="motivo"
              maxLength={300}
              placeholder="Listo mañana a las 12, el envío tarda 2 días…"
              className="min-h-11 w-full rounded-2xl border-2 border-selva/20 bg-white px-4 text-base text-ink focus:border-selva"
            />
          </label>
          <button type="submit" disabled={enviando} className={BOTON_ORO}>
            {enviando ? "Un momento…" : "Sí lo tengo: confirmar y mandar mis datos de pago"}
          </button>
        </form>
      )}

      <div className="flex flex-wrap gap-2">
        {vendedor && pedido.estado === "confirmado" && (
          <form action={accion}>
            {ocultos}
            <input type="hidden" name="estado" value="pagado" />
            <button type="submit" disabled={enviando} className={BOTON_ORO}>
              Ya vi el pago
            </button>
          </form>
        )}

        {vendedor &&
          (pedido.estado === "pagado" ||
            (pedido.estado === "confirmado" && pedido.entrega === "recoger")) && (
            <form action={accion}>
              {ocultos}
              <input type="hidden" name="estado" value="entregado" />
              <button
                type="submit"
                disabled={enviando}
                className={pedido.estado === "pagado" ? BOTON_ORO : BOTON_SUAVE}
              >
                {pedido.estado === "pagado" ? "Entregado" : "Pagó y se lo llevó en tienda"}
              </button>
            </form>
          )}
      </div>

      {!vendedor && pedido.estado === "confirmado" && !pedido.aviso_de_pago_en && (
        <form action={accionAviso} className="flex flex-wrap items-end gap-2">
          {ocultos}
          <label className="min-w-0 flex-1">
            <span className="mb-1 block text-sm font-bold text-selva-2">
              Clave de rastreo o referencia (opcional)
            </span>
            <input
              name="referencia"
              maxLength={120}
              className="min-h-11 w-full rounded-2xl border-2 border-selva/20 bg-white px-4 text-base text-ink focus:border-selva"
            />
          </label>
          <button type="submit" disabled={avisando} className={BOTON_ORO}>
            {avisando ? "Un momento…" : "Ya transferí"}
          </button>
        </form>
      )}

      {puedeCancelar && (
        <details className="group" open={previo?.estado === "cancelado" || undefined}>
          <summary className="cursor-pointer text-sm font-bold text-cacao/70 hover:text-guayaba">
            Cancelar el pedido
          </summary>
          <form action={accion} className="mt-2 flex flex-wrap items-end gap-2">
            {ocultos}
            <input type="hidden" name="estado" value="cancelado" />
            <label className="min-w-0 flex-1">
              <span className="mb-1 block text-sm font-bold text-selva-2">
                ¿Por qué?{vendedor ? "" : " (opcional)"}
              </span>
              <input
                key={vuelta}
                defaultValue={motivoEscrito("cancelado")}
                name="motivo"
                required={vendedor}
                maxLength={300}
                placeholder={vendedor ? "Se agotó, no llegamos a esa zona…" : undefined}
                className="min-h-11 w-full rounded-2xl border-2 border-selva/20 bg-white px-4 text-base text-ink focus:border-selva"
              />
            </label>
            <button
              type="submit"
              disabled={enviando}
              className={`${BOTON} border-2 border-guayaba/50 bg-white text-guayaba hover:bg-guayaba/10`}
            >
              Cancelar pedido
            </button>
          </form>
        </details>
      )}
    </div>
  );
}
