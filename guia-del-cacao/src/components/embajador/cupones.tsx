"use client";

import { useActionState, useState } from "react";
import { Aviso } from "@/components/formulario";
import { Copiar } from "@/components/embajador/formularios";
import { cambiarCuponDeVendedor, crearCuponDeVendedor } from "@/lib/embajador/acciones";
import type { CuponDeVendedor } from "@/lib/datos/embajadores";
import {
  COMISION_DE_EMBAJADOR,
  DESCUENTO_MAXIMO_DE_VENDEDOR,
  PRECIO_PRO,
  TOPE_DE_CUPONES_DE_VENDEDOR,
} from "@/lib/precios";
import { pesos } from "@/lib/tipos";

const CAMPO =
  "min-h-12 w-full rounded-2xl border-2 border-selva/20 bg-white px-4 text-base text-ink focus:border-selva";

/**
 * Armar un cupón: el código y el %. Abajo se ve, mientras se escribe, cuánto
 * paga el negocio su primer mes y cuánto le deja al vendedor ese cobro: dar
 * más descuento es ganar menos de ese primer pago, y conviene verlo antes.
 *
 * Si falla, lo escrito vuelve a los campos (la `key` cambia en el render).
 */
export function NuevoCupon({ lugares }: { lugares: number }) {
  const [estado, accion, enviando] = useActionState(crearCuponDeVendedor, {});
  const [vuelta, setVuelta] = useState(0);
  const [ultimo, setUltimo] = useState(estado);
  const [porcentaje, setPorcentaje] = useState(20);

  if (estado !== ultimo) {
    setUltimo(estado);
    setVuelta((v) => v + 1);
  }

  const cobro = Math.round(PRECIO_PRO * (1 - porcentaje / 100) * 100) / 100;
  const comision = Math.round(cobro * COMISION_DE_EMBAJADOR) / 100;

  if (lugares <= 0) {
    return (
      <p className="rounded-3xl border-2 border-mango/40 bg-white p-5 text-cacao">
        Ya tienes {TOPE_DE_CUPONES_DE_VENDEDOR} cupones activos. Desactiva uno para estrenar otro:
        quien ya lo puso conserva su descuento.
      </p>
    );
  }

  return (
    <form action={accion} className="grid gap-4 rounded-3xl border-2 border-mango/40 bg-white p-5 text-cacao">
      <div key={vuelta} className="grid gap-4 sm:grid-cols-[1fr_10rem]">
        <label className="block">
          <span className="mb-1.5 block font-bold text-selva-2">Código</span>
          <input
            name="codigo"
            required
            minLength={4}
            maxLength={20}
            pattern="[A-Za-z0-9][A-Za-z0-9\-]{2,18}[A-Za-z0-9]"
            defaultValue={estado.error ? estado.valores?.codigo : ""}
            placeholder="CACAO30"
            className={`${CAMPO} font-mono uppercase tracking-wide`}
          />
          <span className="mt-1.5 block text-sm text-cacao/70">
            De 4 a 20 letras o números; puede llevar guiones en medio.
          </span>
        </label>

        <label className="block">
          <span className="mb-1.5 block font-bold text-selva-2">Descuento</span>
          <span className="relative block">
            <input
              name="porcentaje"
              type="number"
              required
              min={1}
              max={DESCUENTO_MAXIMO_DE_VENDEDOR}
              step={1}
              defaultValue={estado.error ? estado.valores?.porcentaje : String(porcentaje)}
              onChange={(e) => {
                const n = Math.round(Number(e.target.value));
                if (n >= 1 && n <= DESCUENTO_MAXIMO_DE_VENDEDOR) setPorcentaje(n);
              }}
              className={`${CAMPO} pr-10 font-mono`}
            />
            <span className="absolute top-1/2 right-4 -translate-y-1/2 font-bold text-cacao/60">%</span>
          </span>
          <span className="mt-1.5 block text-sm text-cacao/70">Hasta {DESCUENTO_MAXIMO_DE_VENDEDOR}%.</span>
        </label>
      </div>

      <p className="rounded-2xl bg-crema-2 px-4 py-3 text-sm">
        Con {porcentaje}%, el negocio paga <strong>{pesos(cobro)}</strong> su primer mes del Pro (en
        vez de {pesos(PRECIO_PRO)}) y ese cobro te deja <strong>{pesos(comision)}</strong>. Los
        siguientes van completos y te dejan tu {COMISION_DE_EMBAJADOR}% de siempre.
      </p>

      {estado.error && <Aviso>{estado.error}</Aviso>}
      {estado.ok && (
        <p role="status" className="font-bold text-selva">
          {estado.ok}
        </p>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="boton-oro brillo min-h-12 justify-self-start rounded-full px-6 font-display text-lg font-semibold text-ink disabled:opacity-60"
      >
        {enviando ? "Un momento…" : "Crear cupón"}
      </button>
    </form>
  );
}

/** Un cupón de la lista: copiar, mandar por WhatsApp y desactivar o reactivar. */
export function TarjetaDeCupon({
  cupon,
  sitio,
  hayLugar,
  fecha,
}: {
  cupon: CuponDeVendedor;
  sitio: string;
  /** Si cabe uno más activo: sin lugar no se ofrece reactivar. */
  hayLugar: boolean;
  /** Cuándo se creó, ya escrito en el servidor. */
  fecha: string;
}) {
  const [estado, accion, enviando] = useActionState(cambiarCuponDeVendedor, {});
  const mensaje = `¡Hola! Te invito a poner tu negocio en la Guía del Cacao (${sitio}): tu página con catálogo, reseñas y un QR para tu mostrador. Son 15 días gratis y con mi código ${cupon.codigo} tienes ${cupon.porcentaje}% de descuento en tu primer pago.`;

  return (
    <li
      className={`grid gap-3 rounded-3xl border-2 bg-white p-5 text-cacao ${
        cupon.activo ? "border-mango/50" : "border-ink/10 opacity-75"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="select-all font-mono text-2xl font-bold tracking-wide text-selva-2">{cupon.codigo}</p>
          <p className="text-sm text-cacao/70">
            {cupon.porcentaje}% en el primer pago · creado el {fecha} ·{" "}
            {cupon.negocios === 0
              ? "ningún negocio todavía"
              : `${cupon.negocios} ${cupon.negocios === 1 ? "negocio lo puso" : "negocios lo pusieron"}`}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-sm font-extrabold ${
            cupon.activo ? "bg-lima/25 text-selva-2" : "bg-ink/10 text-cacao/70"
          }`}
        >
          {cupon.activo ? "Activo" : "Desactivado"}
        </span>
      </div>

      {estado.error && <Aviso>{estado.error}</Aviso>}

      <div className="flex flex-wrap gap-2">
        {cupon.activo && (
          <>
            <Copiar texto={cupon.codigo} etiqueta="Copiar" />
            <a
              href={`https://wa.me/?text=${encodeURIComponent(mensaje)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-12 items-center rounded-full border border-mango/50 px-5 font-bold transition-colors hover:border-mango hover:text-mango"
            >
              Mandar por WhatsApp
            </a>
          </>
        )}

        {(cupon.activo || hayLugar) && (
          <form action={accion}>
            <input type="hidden" name="cupon_id" value={cupon.id} />
            <input type="hidden" name="activo" value={cupon.activo ? "0" : "1"} />
            <button
              type="submit"
              disabled={enviando}
              className="min-h-12 rounded-full px-5 font-bold text-cacao/70 hover:text-guayaba disabled:opacity-60"
            >
              {cupon.activo ? "Desactivar" : "Volver a activar"}
            </button>
          </form>
        )}
      </div>
    </li>
  );
}
