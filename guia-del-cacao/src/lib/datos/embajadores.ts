import { crearClienteServidor } from "@/lib/supabase/server";
import type { EstadoDeEmbajador } from "@/lib/embajadores";

/**
 * Lecturas de los Embajadores del Cacao (migración 000059).
 *
 * RLS autoriza, no acota: la lectura del embajador filtra a mano por su propio
 * id aunque la política ya lo haga, y la del administrador trae todo.
 */

export type MiEmbajada = {
  estado: EstadoDeEmbajador;
  codigo: string | null;
  titular: string | null;
  banco: string | null;
  clabe: string | null;
};

export type Referido = {
  marca: string;
  vinculadoEn: string;
  montoPagado: number | null;
  comision: number | null;
  pagadoEn: string | null;
  cobrada: boolean;
};

export type PagoRecibido = { monto: number; referencia: string | null; pagadoEn: string };

/** Todo lo del tablero de quien mira: su fila, sus referidos y sus pagos. */
export async function miEmbajada(perfilId: string) {
  const supabase = await crearClienteServidor();

  const [{ data: fila }, { data: referidos }, { data: pagos }] = await Promise.all([
    supabase
      .from("embajadores")
      .select("estado, codigo, titular, banco, clabe")
      .eq("perfil_id", perfilId)
      .maybeSingle(),
    supabase.rpc("mis_referidos"),
    supabase
      .from("pagos_a_embajadores")
      .select("monto, referencia, pagado_en")
      .eq("embajador_id", perfilId)
      .order("pagado_en", { ascending: false }),
  ]);

  return {
    embajada: (fila as MiEmbajada | null) ?? null,
    referidos: ((referidos ?? []) as {
      marca: string;
      vinculado_en: string;
      monto_pagado: number | null;
      comision: number | null;
      pagado_en: string | null;
      cobrada: boolean;
    }[]).map(
      (r): Referido => ({
        marca: r.marca,
        vinculadoEn: r.vinculado_en,
        montoPagado: r.monto_pagado === null ? null : Number(r.monto_pagado),
        comision: r.comision === null ? null : Number(r.comision),
        pagadoEn: r.pagado_en,
        cobrada: r.cobrada,
      }),
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

/** Las cuentas del tablero: lo del mes, lo que se debe y lo ya cobrado. */
export function cuentasDe(referidos: Referido[], pagos: PagoRecibido[]) {
  const mes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
  }).format(new Date());

  const delMes = referidos
    .filter((r) => r.pagadoEn && r.comision !== null)
    .filter(
      (r) =>
        new Intl.DateTimeFormat("en-CA", {
          timeZone: "America/Mexico_City",
          year: "numeric",
          month: "2-digit",
        }).format(new Date(r.pagadoEn!)) === mes,
    )
    .reduce((suma, r) => suma + (r.comision ?? 0), 0);

  const porCobrar = referidos
    .filter((r) => r.comision !== null && !r.cobrada)
    .reduce((suma, r) => suma + (r.comision ?? 0), 0);

  const cobrado = pagos.reduce((suma, p) => suma + p.monto, 0);

  return {
    delMes: Math.round(delMes * 100) / 100,
    porCobrar: Math.round(porCobrar * 100) / 100,
    cobrado: Math.round(cobrado * 100) / 100,
    negocios: referidos.length,
    esperando: referidos.filter((r) => r.montoPagado === null).length,
  };
}

export type EmbajadorParaAdmin = {
  perfilId: string;
  nombre: string;
  correo: string;
  estado: EstadoDeEmbajador;
  codigo: string | null;
  motivo: string | null;
  titular: string | null;
  banco: string | null;
  clabe: string | null;
  solicitadoEn: string;
  negocios: number;
  pagaron: number;
  porPagar: number;
  generado: number;
};

/** Para el administrador: cada embajador con lo que trajo y lo que se le debe. */
export async function embajadoresParaAdmin(): Promise<EmbajadorParaAdmin[]> {
  const supabase = await crearClienteServidor();

  const [{ data: filas }, { data: referidos }] = await Promise.all([
    supabase
      .from("embajadores")
      .select("perfil_id, estado, codigo, motivo, titular, banco, clabe, solicitado_en, perfiles(nombre, correo)")
      .order("solicitado_en", { ascending: false }),
    supabase.from("referidos").select("embajador_id, monto_pagado, comision, pago_id"),
  ]);

  const porEmbajador = new Map<string, { negocios: number; pagaron: number; porPagar: number; generado: number }>();
  for (const r of (referidos ?? []) as {
    embajador_id: string;
    monto_pagado: number | null;
    comision: number | null;
    pago_id: string | null;
  }[]) {
    const cuenta = porEmbajador.get(r.embajador_id) ?? { negocios: 0, pagaron: 0, porPagar: 0, generado: 0 };
    cuenta.negocios += 1;
    if (r.comision !== null) {
      cuenta.pagaron += 1;
      cuenta.generado += Number(r.comision);
      if (!r.pago_id) cuenta.porPagar += Number(r.comision);
    }
    porEmbajador.set(r.embajador_id, cuenta);
  }

  return ((filas ?? []) as unknown as {
    perfil_id: string;
    estado: EstadoDeEmbajador;
    codigo: string | null;
    motivo: string | null;
    titular: string | null;
    banco: string | null;
    clabe: string | null;
    solicitado_en: string;
    perfiles: { nombre: string | null; correo: string | null } | null;
  }[]).map((f) => {
    const cuenta = porEmbajador.get(f.perfil_id) ?? { negocios: 0, pagaron: 0, porPagar: 0, generado: 0 };
    return {
      perfilId: f.perfil_id,
      nombre: f.perfiles?.nombre ?? "Sin nombre",
      correo: f.perfiles?.correo ?? "",
      estado: f.estado,
      codigo: f.codigo,
      motivo: f.motivo,
      titular: f.titular,
      banco: f.banco,
      clabe: f.clabe,
      solicitadoEn: f.solicitado_en,
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
 * El embed nombra su llave: `referidos` apunta a `pagos_a_embajadores` y a
 * `embajadores`, así que hay dos caminos entre las dos tablas y PostgREST
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
