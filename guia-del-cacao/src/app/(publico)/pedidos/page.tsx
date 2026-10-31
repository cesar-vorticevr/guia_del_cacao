import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { TarjetaPedido } from "@/components/pedidos/tarjeta-pedido";
import { perfilActual } from "@/lib/auth/sesion";
import { misPedidos } from "@/lib/datos/pedidos";
import { haceCuanto } from "@/lib/tiempo";

export const metadata: Metadata = { title: "Tus pedidos · Guía del Cacao" };

/**
 * Lo que pidió quien mira (migración 000071). Cada pedido lleva a su
 * conversación con el negocio, que es donde se habla; aquí se ve en qué paso
 * va y, ya confirmado, a dónde transferir.
 *
 * Lo que le piden a un negocio no está aquí: eso vive en su panel.
 */
export default async function TusPedidos() {
  const perfil = await perfilActual();

  if (!perfil) redirect("/login?volver=/pedidos");
  if (!perfil.rol_confirmado) redirect("/elegir-rol");

  const pedidos = await misPedidos("compras");
  const abiertos = pedidos.filter((p) => p.estado !== "entregado" && p.estado !== "cancelado");
  const cerrados = pedidos.filter((p) => !abiertos.includes(p));

  return (
    <div className="mx-auto grid max-w-3xl gap-8 py-10">
      <header className="text-center">
        <p className="antetitulo">Tu cuenta</p>
        <h1 className="mt-3 font-display text-4xl font-medium tracking-tight sm:text-5xl">
          Tus <em className="texto-oro">pedidos</em>
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-pretty text-crema/75">
          Pides desde el catálogo de un negocio, él confirma que lo tiene y te pasa sus datos para
          que le transfieras directo. La Guía del Cacao no cobra ni guarda tu dinero.
        </p>
        <p className="mt-3">
          <Link
            href={perfil.rol === "negocio" ? "/negocio/panel" : "/cuenta"}
            className="text-sm font-bold text-mango underline underline-offset-4"
          >
            ← Volver a tu {perfil.rol === "negocio" ? "panel" : "cuenta"}
          </Link>
        </p>
      </header>

      {pedidos.length === 0 && (
        <p className="rounded-3xl bg-white p-6 text-center text-cacao">
          Todavía no haces ningún pedido.{" "}
          <Link href="/directorio" className="font-bold text-selva underline">
            Busca un negocio
          </Link>{" "}
          y pide desde su catálogo.
        </p>
      )}

      {abiertos.length > 0 && (
        <section className="grid gap-4">
          {abiertos.map((pedido) => (
            <TarjetaPedido key={pedido.id} pedido={pedido} cuando={haceCuanto(pedido.creado_en)} />
          ))}
        </section>
      )}

      {cerrados.length > 0 && (
        <section className="grid gap-4">
          <h2 className="font-display text-2xl">Anteriores</h2>
          {cerrados.map((pedido) => (
            <TarjetaPedido key={pedido.id} pedido={pedido} cuando={haceCuanto(pedido.creado_en)} />
          ))}
        </section>
      )}
    </div>
  );
}
