import { perfilActual } from "@/lib/auth/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";

export type EstadoDePedido = "nuevo" | "confirmado" | "pagado" | "entregado" | "cancelado";

export type DatosDePago = {
  banco: string;
  titular: string;
  clabe: string;
  instrucciones: string | null;
};

export type Pedido = {
  id: string;
  folio: number;
  soy_vendedor: boolean;
  estado: EstadoDePedido;
  entrega: "recoger" | "envio";
  direccion: string | null;
  nota: string | null;
  subtotal: number;
  total: number | null;
  motivo_cancelado: string | null;
  aviso_de_pago_en: string | null;
  creado_en: string;
  actualizado_en: string;
  conversacion_id: string;
  /** El cliente para el negocio; la marca para el cliente. */
  otro_nombre: string;
  marca_nombre: string;
  sucursal_nombre: string;
  sucursal_slug: string;
  renglones: { nombre: string; precio: number | null; cantidad: number }[];
  /** Solo llega si el pedido ya se confirmó, o si quien mira es el negocio. */
  pago: DatosDePago | null;
};

/**
 * Los pedidos de quien mira: los que hizo (`compras`), los que le hacen a su
 * negocio (`ventas`) o los dos. Con `conversacion`, solo los de ese chat.
 *
 * Sale de `mis_pedidos()` y no de la tabla: filtra por quien pregunta (RLS deja
 * pasar al administrador) y no entrega la CLABE antes de que se confirme.
 */
export async function misPedidos(lado: "compras" | "ventas" | null = null, conversacion?: string) {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.rpc("mis_pedidos", {
    p_lado: lado,
    p_conversacion: conversacion ?? null,
  });

  return ((data ?? []) as Pedido[]).map((p) => ({
    ...p,
    folio: Number(p.folio),
    subtotal: Number(p.subtotal),
    total: p.total === null ? null : Number(p.total),
    renglones: p.renglones.map((r) => ({
      ...r,
      precio: r.precio === null ? null : Number(r.precio),
    })),
  }));
}

/** Cuántos pedidos nuevos, sin confirmar, tiene el negocio de quien mira. */
export async function pedidosPorAtender() {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.rpc("pedidos_por_atender");
  return Number(data ?? 0);
}

/** Los datos de pago de una marca. Solo los lee su dueño (RLS). */
export async function datosDePagoDe(marcaId: string) {
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from("datos_de_pago")
    .select("banco, titular, clabe, instrucciones, recibe_pedidos")
    .eq("marca_id", marcaId)
    .maybeSingle();

  return data as (DatosDePago & { recibe_pedidos: boolean }) | null;
}

/**
 * Si el negocio de quien mira ya anotó sus datos de pago. Filtra por dueño a
 * mano: RLS deja leerlos también al administrador.
 */
export async function tengoDatosDePago() {
  const perfil = await perfilActual();
  if (!perfil) return false;

  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from("datos_de_pago")
    .select("marca_id, marcas!inner(perfil_id)")
    .eq("marcas.perfil_id", perfil.id)
    .limit(1);

  return (data ?? []).length > 0;
}

/** Si una sucursal recibe pedidos: la pregunta el micrositio para enseñar el carrito. */
export async function sucursalVende(sucursalId: string) {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.rpc("sucursal_vende", { p_sucursal: sucursalId });
  return Boolean(data);
}

/** Por qué no vende, o null si vende. El texto lo escribe la base. */
export async function porQueNoVende(sucursalId: string) {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.rpc("por_que_no_vende", { p_sucursal: sucursalId });
  return (data as string | null) ?? null;
}
