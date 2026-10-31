import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { FormularioDatosDePago } from "@/components/pedidos/datos-de-pago";
import { TarjetaPedido } from "@/components/pedidos/tarjeta-pedido";
import { perfilActual } from "@/lib/auth/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { misSucursales } from "@/lib/datos/sucursales";
import { datosDePagoDe, misPedidos, porQueNoVende } from "@/lib/datos/pedidos";
import { haceCuanto } from "@/lib/tiempo";

export const metadata: Metadata = { title: "Pedidos · Guía del Cacao" };

/**
 * Los pedidos que le hacen al negocio (migración 000071), sus datos de pago y
 * qué sucursales están vendiendo.
 *
 * Vende quien paga el plan: la prueba Gratis enseña su catálogo, pero sin el
 * botón de pedir. Por qué una sucursal no vende lo dice la base
 * (`por_que_no_vende`), y aquí se enseña tal cual.
 */
export default async function PanelPedidos({
  searchParams,
}: {
  searchParams: Promise<{ ver?: string }>;
}) {
  const { ver } = await searchParams;
  const perfil = await perfilActual();

  if (!perfil) redirect("/login");
  if (!perfil.rol_confirmado) redirect("/elegir-rol");
  if (perfil.rol !== "negocio") redirect("/cuenta");

  const supabase = await crearClienteServidor();
  const { data: marca } = await supabase
    .from("marcas")
    .select("id")
    .eq("perfil_id", perfil.id)
    .order("fecha_registro")
    .limit(1)
    .maybeSingle();

  if (!marca) redirect("/negocio/completar-marca");

  const [sucursales, pedidos, datos] = await Promise.all([
    misSucursales(perfil.id),
    misPedidos("ventas"),
    datosDePagoDe(marca.id),
  ]);

  const motivos = await Promise.all(sucursales.map((s) => porQueNoVende(s.id)));
  const venden = sucursales.filter((_, i) => motivos[i] === null).length;
  const faltaPlan = motivos.some((m) => m?.includes("Gratis"));

  const todos = ver === "todos";
  const abiertos = pedidos.filter((p) => p.estado !== "entregado" && p.estado !== "cancelado");
  const lista = todos ? pedidos : abiertos;

  return (
    <div className="grid gap-10">
      <section className="grid gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl">Pedidos</h1>
            <p className="mt-1 max-w-prose text-crema/75">
              Te piden desde tu catálogo, confirmas que lo tienes y el cliente te transfiere
              directo. La Guía no cobra comisión ni toca el dinero.
            </p>
          </div>
          <div className="flex gap-2 text-sm font-bold">
            <Link
              href="/negocio/panel/pedidos"
              className={`rounded-full px-4 py-2 ${!todos ? "bg-mango text-ink" : "border-2 border-mango/40"}`}
            >
              Por atender ({abiertos.length})
            </Link>
            <Link
              href="/negocio/panel/pedidos?ver=todos"
              className={`rounded-full px-4 py-2 ${todos ? "bg-mango text-ink" : "border-2 border-mango/40"}`}
            >
              Todos ({pedidos.length})
            </Link>
          </div>
        </div>

        {lista.length === 0 ? (
          <p className="rounded-3xl bg-white p-6 text-cacao">
            {venden > 0
              ? "No hay pedidos por atender. Cuando alguien pida desde tu catálogo, sale aquí y en tu buzón."
              : "Todavía no recibes pedidos: mira abajo qué falta."}
          </p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {lista.map((pedido) => (
              <TarjetaPedido key={pedido.id} pedido={pedido} cuando={haceCuanto(pedido.creado_en)} />
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-4">
        <h2 className="font-display text-2xl">¿Quién está vendiendo?</h2>
        <ul className="grid gap-2">
          {sucursales.map((s, i) => (
            <li
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 border-ink/10 bg-white px-4 py-3 text-cacao"
            >
              <span className="font-bold text-selva-2">{s.nombre_sucursal}</span>
              <span className={motivos[i] ? "text-sm" : "font-bold text-selva"}>
                {motivos[i] ?? "Recibe pedidos"}
              </span>
            </li>
          ))}
        </ul>
        {faltaPlan && (
          <Link
            href="/negocio/panel/cuenta?ver=plan"
            className="boton-oro brillo justify-self-start rounded-full px-6 py-3 font-display text-lg font-semibold text-ink"
          >
            Pasar al plan Pro para vender
          </Link>
        )}
      </section>

      <section id="datos-de-pago" className="grid scroll-mt-24 gap-4">
        <div>
          <h2 className="font-display text-2xl">Tus datos de pago</h2>
          <p className="mt-1 max-w-prose text-crema/75">
            A dónde te transfieren. El cliente los ve hasta que confirmas su pedido, y le llegan al
            chat en ese momento.
          </p>
        </div>
        <FormularioDatosDePago datos={datos} />
      </section>
    </div>
  );
}
