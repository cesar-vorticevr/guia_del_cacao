import { crearClienteServidor } from "@/lib/supabase/server";
import type { EstadoDeEmbajador } from "@/lib/embajadores";
import type { EtapaDeProspecto, Prospecto } from "@/lib/ventas";

/**
 * Lecturas de los Embajadores del Cacao (migración 000059).
 *
 * RLS autoriza, no acota: la lectura del embajador filtra a mano por su propio
 * id aunque la política ya lo haga, y la del administrador trae todo.
 */

export type MiEmbajada = {
  estado: EstadoDeEmbajador;
  codigo: string | null;
  /** El segundo código: sin descuento, deja al negocio en «Destacados» (000070). */
  codigo_destacado: string | null;
  titular: string | null;
  banco: string | null;
  clabe: string | null;
  /** Último día cuyos cobros le dejan comisión (000067). */
  comision_hasta: string;
};

/** Un negocio que trajo, con lo que lleva pagado y lo que le ha dejado (000065). */
export type Referido = {
  marca: string;
  vinculadoEn: string;
  cobros: number;
  totalPagado: number;
  totalComision: number;
  porCobrar: number;
  ultimoCobro: string | null;
  siguePagando: boolean;
  /** Qué código puso: el de descuento o el destacado (000070). */
  tipo: "descuento" | "destacado";
};

/** Una comisión: un cobro confirmado por Stripe de un negocio referido. */
export type Comision = { comision: number; cobradoEn: string; cubierta: boolean };

export type PagoRecibido = { monto: number; referencia: string | null; pagadoEn: string };

/** Todo lo del tablero de quien mira: su fila, sus referidos y sus pagos. */
export async function miEmbajada(perfilId: string) {
  const supabase = await crearClienteServidor();

  const [{ data: fila }, { data: referidos }, { data: pagos }, { data: comisiones }] = await Promise.all([
    supabase
      .from("embajadores")
      .select("estado, codigo, codigo_destacado, titular, banco, clabe, comision_hasta")
      .eq("perfil_id", perfilId)
      .maybeSingle(),
    supabase.rpc("mis_referidos"),
    supabase
      .from("pagos_a_embajadores")
      .select("monto, referencia, pagado_en")
      .eq("embajador_id", perfilId)
      .order("pagado_en", { ascending: false }),
    supabase
      .from("comisiones")
      .select("comision, cobrado_en, pago_id")
      .eq("embajador_id", perfilId),
  ]);

  return {
    embajada: (fila as MiEmbajada | null) ?? null,
    referidos: ((referidos ?? []) as {
      marca: string;
      vinculado_en: string;
      cobros: number;
      total_pagado: number;
      total_comision: number;
      por_cobrar: number;
      ultimo_cobro: string | null;
      sigue_pagando: boolean;
      tipo: "descuento" | "destacado";
    }[]).map(
      (r): Referido => ({
        marca: r.marca,
        vinculadoEn: r.vinculado_en,
        cobros: Number(r.cobros),
        totalPagado: Number(r.total_pagado),
        totalComision: Number(r.total_comision),
        porCobrar: Number(r.por_cobrar),
        ultimoCobro: r.ultimo_cobro,
        siguePagando: r.sigue_pagando,
        tipo: r.tipo ?? "descuento",
      }),
    ),
    comisiones: ((comisiones ?? []) as { comision: number; cobrado_en: string; pago_id: string | null }[]).map(
      (c): Comision => ({ comision: Number(c.comision), cobradoEn: c.cobrado_en, cubierta: c.pago_id !== null }),
    ),
    pagos: ((pagos ?? []) as { monto: number; referencia: string | null; pagado_en: string }[]).map(
      (p): PagoRecibido => ({
        monto: Number(p.monto),
        referencia: p.referencia,
        pagadoEn: p.pagado_en,
      }),
    ),
  };
}

/** Las cuentas del tablero: lo del mes, lo acumulado, lo que se debe y lo ya cobrado. */
export function cuentasDe(referidos: Referido[], comisiones: Comision[], pagos: PagoRecibido[]) {
  const mes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
  }).format(new Date());

  const delMes = comisiones
    .filter(
      (c) =>
        new Intl.DateTimeFormat("en-CA", {
          timeZone: "America/Mexico_City",
          year: "numeric",
          month: "2-digit",
        }).format(new Date(c.cobradoEn)) === mes,
    )
    .reduce((suma, c) => suma + c.comision, 0);

  const acumulado = comisiones.reduce((suma, c) => suma + c.comision, 0);
  const porCobrar = comisiones.filter((c) => !c.cubierta).reduce((suma, c) => suma + c.comision, 0);

  const cobrado = pagos.reduce((suma, p) => suma + p.monto, 0);

  return {
    delMes: Math.round(delMes * 100) / 100,
    acumulado: Math.round(acumulado * 100) / 100,
    porCobrar: Math.round(porCobrar * 100) / 100,
    cobrado: Math.round(cobrado * 100) / 100,
    negocios: referidos.length,
    esperando: referidos.filter((r) => r.cobros === 0).length,
    pagando: referidos.filter((r) => r.siguePagando).length,
  };
}

export type EmbajadorParaAdmin = {
  perfilId: string;
  nombre: string;
  correo: string;
  estado: EstadoDeEmbajador;
  codigo: string | null;
  /** El código destacado (000070). */
  codigoDestacado: string | null;
  motivo: string | null;
  titular: string | null;
  banco: string | null;
  clabe: string | null;
  solicitadoEn: string;
  comisionHasta: string;
  /** Cuántos negocios lleva apuntados en su libreta. */
  prospectos: number;
  negocios: number;
  pagaron: number;
  porPagar: number;
  generado: number;
};

/** Para el administrador: cada embajador con lo que trajo y lo que se le debe. */
export async function embajadoresParaAdmin(): Promise<EmbajadorParaAdmin[]> {
  const supabase = await crearClienteServidor();

  const [{ data: filas }, { data: referidos }, { data: comisiones }, { data: prospectos }] = await Promise.all([
    supabase
      .from("embajadores")
      .select("perfil_id, estado, codigo, codigo_destacado, motivo, titular, banco, clabe, solicitado_en, comision_hasta, perfiles(nombre, correo)")
      .order("solicitado_en", { ascending: false }),
    supabase.from("referidos").select("embajador_id, marca_id"),
    // Las comisiones de cada cobro (000065), no la del primer pago de `referidos`.
    supabase.from("comisiones").select("embajador_id, marca_id, comision, pago_id"),
    supabase.from("prospectos").select("embajador_id"),
  ]);

  const prospectosDe = new Map<string, number>();
  for (const p of (prospectos ?? []) as { embajador_id: string }[]) {
    prospectosDe.set(p.embajador_id, (prospectosDe.get(p.embajador_id) ?? 0) + 1);
  }

  const nueva = () => ({ negocios: 0, pagaron: 0, porPagar: 0, generado: 0, marcas: new Set<string>() });
  const porEmbajador = new Map<string, ReturnType<typeof nueva>>();
  for (const r of (referidos ?? []) as { embajador_id: string }[]) {
    const cuenta = porEmbajador.get(r.embajador_id) ?? nueva();
    cuenta.negocios += 1;
    porEmbajador.set(r.embajador_id, cuenta);
  }
  for (const c of (comisiones ?? []) as {
    embajador_id: string;
    marca_id: string;
    comision: number;
    pago_id: string | null;
  }[]) {
    const cuenta = porEmbajador.get(c.embajador_id) ?? nueva();
    cuenta.marcas.add(c.marca_id);
    cuenta.pagaron = cuenta.marcas.size;
    cuenta.generado += Number(c.comision);
    if (!c.pago_id) cuenta.porPagar += Number(c.comision);
    porEmbajador.set(c.embajador_id, cuenta);
  }

  return ((filas ?? []) as unknown as {
    perfil_id: string;
    estado: EstadoDeEmbajador;
    codigo: string | null;
    codigo_destacado: string | null;
    motivo: string | null;
    titular: string | null;
    banco: string | null;
    clabe: string | null;
    solicitado_en: string;
    comision_hasta: string;
    perfiles: { nombre: string | null; correo: string | null } | null;
  }[]).map((f) => {
    const cuenta = porEmbajador.get(f.perfil_id) ?? nueva();
    return {
      perfilId: f.perfil_id,
      nombre: f.perfiles?.nombre ?? "Sin nombre",
      correo: f.perfiles?.correo ?? "",
      estado: f.estado,
      codigo: f.codigo,
      codigoDestacado: f.codigo_destacado,
      motivo: f.motivo,
      titular: f.titular,
      banco: f.banco,
      clabe: f.clabe,
      solicitadoEn: f.solicitado_en,
      comisionHasta: f.comision_hasta,
      prospectos: prospectosDe.get(f.perfil_id) ?? 0,
      negocios: cuenta.negocios,
      pagaron: cuenta.pagaron,
      porPagar: Math.round(cuenta.porPagar * 100) / 100,
      generado: Math.round(cuenta.generado * 100) / 100,
    };
  });
}

export type PagoHecho = { nombre: string; monto: number; referencia: string | null; pagadoEn: string };

/**
 * Las transferencias que ha registrado el administrador, la más nueva arriba.
 *
 * El embed nombra su llave: `referidos` y `comisiones` apuntan a
 * `pagos_a_embajadores` y a `embajadores`, así que hay varios caminos entre
 * las dos tablas y PostgREST
 * respondería PGRST201 —la lista saldría vacía—. Es el tropiezo de AGENTS.md.
 */
export async function pagosHechos(limite = 20): Promise<PagoHecho[]> {
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from("pagos_a_embajadores")
    .select("monto, referencia, pagado_en, embajadores!pagos_a_embajadores_embajador_id_fkey(perfiles(nombre))")
    .order("pagado_en", { ascending: false })
    .limit(limite);

  return ((data ?? []) as unknown as {
    monto: number;
    referencia: string | null;
    pagado_en: string;
    embajadores: { perfiles: { nombre: string | null } | null } | null;
  }[]).map((p) => ({
    nombre: p.embajadores?.perfiles?.nombre ?? "Embajador",
    monto: Number(p.monto),
    referencia: p.referencia,
    pagadoEn: p.pagado_en,
  }));
}

/** ¿Quien mira tiene cuenta de ventas? Activa o en pausa: rechazada no cuenta. */
export async function esVendedor(perfilId: string) {
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from("embajadores")
    .select("estado")
    .eq("perfil_id", perfilId)
    .maybeSingle();
  const estado = (data as { estado: EstadoDeEmbajador } | null)?.estado;
  return estado === "activo" || estado === "pausado";
}

/** La libreta de quien mira, lo que se tocó al último arriba. */
export async function misProspectos(perfilId: string): Promise<Prospecto[]> {
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from("prospectos")
    .select("id, negocio, contacto, telefono, ciudad, etapa, nota, siguiente_en, actualizado_en")
    .eq("embajador_id", perfilId)
    .order("actualizado_en", { ascending: false });

  return ((data ?? []) as {
    id: string;
    negocio: string;
    contacto: string | null;
    telefono: string | null;
    ciudad: string | null;
    etapa: EtapaDeProspecto;
    nota: string | null;
    siguiente_en: string | null;
    actualizado_en: string;
  }[]).map((p) => ({
    id: p.id,
    negocio: p.negocio,
    contacto: p.contacto,
    telefono: p.telefono,
    ciudad: p.ciudad,
    etapa: p.etapa,
    nota: p.nota,
    siguienteEn: p.siguiente_en,
    actualizadoEn: p.actualizado_en,
  }));
}
