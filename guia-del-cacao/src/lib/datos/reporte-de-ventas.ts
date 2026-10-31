import { crearClienteServidor } from "@/lib/supabase/server";
import {
  cuentasDe,
  embajadoresParaAdmin,
  misProspectos,
  type EmbajadorParaAdmin,
  type PagoRecibido,
  type Referido,
} from "@/lib/datos/embajadores";
import type { EtapaDeProspecto } from "@/lib/ventas";

/**
 * El reporte del equipo de ventas, solo para el administrador: cómo va cada
 * vendedor, mes por mes, y el detalle de uno. Las lecturas pasan por RLS, que
 * a quien no es admin le deja ver solo lo suyo; las páginas que lo usan ya
 * exigen el rol.
 */

const MES = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Mexico_City",
  year: "numeric",
  month: "2-digit",
});

/** «2026-10» del instante dado, en hora del centro. */
function mesDe(instante: string | Date) {
  return MES.format(typeof instante === "string" ? new Date(instante) : instante).slice(0, 7);
}

/** Los últimos `cuantos` meses, del más viejo al de hoy, como «2026-10». */
function ultimosMeses(cuantos: number) {
  const [anio, mes] = mesDe(new Date()).split("-").map(Number);
  return Array.from({ length: cuantos }, (_, i) => {
    const fecha = new Date(Date.UTC(anio, mes - 1 - (cuantos - 1 - i), 15));
    return `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

function redondear(n: number) {
  return Math.round(n * 100) / 100;
}

export type MesDeVentas = {
  mes: string;
  /** Lo que Stripe cobró a los negocios que trajeron, ya con descuento. */
  ventas: number;
  comisiones: number;
  cobros: number;
  /** Negocios que pusieron un código ese mes. */
  negociosNuevos: number;
};

export type Embudo = Record<EtapaDeProspecto, number>;

export type VendedorEnReporte = EmbajadorParaAdmin & {
  ventas: number;
  ventasDelMes: number;
  comisionDelMes: number;
  embudo: Embudo;
  /** Prospectos con seguimiento para hoy o antes que no se han cerrado. */
  atrasados: number;
  /** Lo último que hizo: tocar su libreta o traer un negocio. */
  ultimaActividad: string | null;
};

function embudoVacio(): Embudo {
  return { por_contactar: 0, contactado: 0, demo: 0, alta: 0, pago: 0, no_interesa: 0 };
}

/**
 * Los últimos seis meses, cada vendedor con su embudo y sus números, y el
 * embudo de todos. Se suma aquí y no en la base: son decenas de vendedores y
 * cientos de prospectos, no las decenas de miles de filas de `actividad`.
 */
export async function reporteDeVentas() {
  const supabase = await crearClienteServidor();

  const [vendedores, { data: comisiones }, { data: prospectos }, { data: referidos }] = await Promise.all([
    embajadoresParaAdmin(),
    supabase.from("comisiones").select("embajador_id, monto_pagado, comision, cobrado_en"),
    supabase.from("prospectos").select("embajador_id, etapa, siguiente_en, actualizado_en"),
    supabase.from("referidos").select("embajador_id, vinculado_en"),
  ]);

  const meses = ultimosMeses(6);
  const esteMes = meses[meses.length - 1];
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(new Date());

  const porMes = new Map<string, MesDeVentas>(
    meses.map((mes) => [mes, { mes, ventas: 0, comisiones: 0, cobros: 0, negociosNuevos: 0 }]),
  );
  const extra = new Map<string, Omit<VendedorEnReporte, keyof EmbajadorParaAdmin>>();
  const de = (id: string) => {
    let fila = extra.get(id);
    if (!fila) {
      fila = {
        ventas: 0,
        ventasDelMes: 0,
        comisionDelMes: 0,
        embudo: embudoVacio(),
        atrasados: 0,
        ultimaActividad: null,
      };
      extra.set(id, fila);
    }
    return fila;
  };
  const tocar = (fila: { ultimaActividad: string | null }, cuando: string) => {
    if (!fila.ultimaActividad || cuando > fila.ultimaActividad) fila.ultimaActividad = cuando;
  };

  for (const c of (comisiones ?? []) as {
    embajador_id: string;
    monto_pagado: number;
    comision: number;
    cobrado_en: string;
  }[]) {
    const mes = mesDe(c.cobrado_en);
    const fila = de(c.embajador_id);
    fila.ventas += Number(c.monto_pagado);
    if (mes === esteMes) {
      fila.ventasDelMes += Number(c.monto_pagado);
      fila.comisionDelMes += Number(c.comision);
    }
    const delMes = porMes.get(mes);
    if (delMes) {
      delMes.ventas += Number(c.monto_pagado);
      delMes.comisiones += Number(c.comision);
      delMes.cobros += 1;
    }
  }

  const embudo = embudoVacio();
  for (const p of (prospectos ?? []) as {
    embajador_id: string;
    etapa: EtapaDeProspecto;
    siguiente_en: string | null;
    actualizado_en: string;
  }[]) {
    const fila = de(p.embajador_id);
    fila.embudo[p.etapa] += 1;
    embudo[p.etapa] += 1;
    if (p.siguiente_en && p.siguiente_en <= hoy && p.etapa !== "pago" && p.etapa !== "no_interesa") {
      fila.atrasados += 1;
    }
    tocar(fila, p.actualizado_en);
  }

  for (const r of (referidos ?? []) as { embajador_id: string; vinculado_en: string }[]) {
    tocar(de(r.embajador_id), r.vinculado_en);
    const delMes = porMes.get(mesDe(r.vinculado_en));
    if (delMes) delMes.negociosNuevos += 1;
  }

  const equipo: VendedorEnReporte[] = vendedores
    .filter((v) => v.estado === "activo" || v.estado === "pausado")
    .map((v) => {
      const fila = de(v.perfilId);
      return {
        ...v,
        ...fila,
        ventas: redondear(fila.ventas),
        ventasDelMes: redondear(fila.ventasDelMes),
        comisionDelMes: redondear(fila.comisionDelMes),
      };
    })
    .sort((a, b) => b.ventas - a.ventas || b.negocios - a.negocios || b.prospectos - a.prospectos);

  return {
    meses: [...porMes.values()].map((m) => ({
      ...m,
      ventas: redondear(m.ventas),
      comisiones: redondear(m.comisiones),
    })),
    equipo,
    embudo,
  };
}

/** Un negocio que trajo un vendedor, con su micrositio si está publicado. */
export type ReferidoDeVendedor = Referido & { slug: string | null };

/**
 * Todo de un vendedor: su cuenta, los negocios que trajo con lo que llevan
 * pagado, sus meses, su libreta completa y lo que se le ha transferido. Lo
 * mismo que ve él en /ventas, más lo que solo ve el administrador.
 */
export async function detalleDeVendedor(perfilId: string) {
  const supabase = await crearClienteServidor();

  const vendedor = (await embajadoresParaAdmin()).find((v) => v.perfilId === perfilId);
  if (!vendedor) return null;

  const [{ data: referidos }, { data: comisiones }, { data: pagos }, prospectos] = await Promise.all([
    supabase
      .from("referidos")
      .select("marca_id, vinculado_en, marcas(nombre_comercial)")
      .eq("embajador_id", perfilId)
      .order("vinculado_en", { ascending: false }),
    supabase
      .from("comisiones")
      .select("marca_id, monto_pagado, comision, cobrado_en, pago_id")
      .eq("embajador_id", perfilId),
    supabase
      .from("pagos_a_embajadores")
      .select("monto, referencia, pagado_en")
      .eq("embajador_id", perfilId)
      .order("pagado_en", { ascending: false }),
    misProspectos(perfilId),
  ]);

  const filas = (referidos ?? []) as unknown as {
    marca_id: string;
    vinculado_en: string;
    marcas: { nombre_comercial: string } | null;
  }[];
  const cobros = (comisiones ?? []) as {
    marca_id: string;
    monto_pagado: number;
    comision: number;
    cobrado_en: string;
    pago_id: string | null;
  }[];
  const marcas = filas.map((f) => f.marca_id);

  // «Sigue pagando» como en `mis_referidos`: alguna sucursal con un plan
  // activo que cobra.
  const { data: sucursales } = marcas.length
    ? await supabase.from("sucursales").select("id, marca_id, slug, estado").in("marca_id", marcas)
    : { data: [] };
  const deSucursales = (sucursales ?? []) as { id: string; marca_id: string; slug: string; estado: string }[];
  const { data: activas } = deSucursales.length
    ? await supabase
        .from("suscripciones")
        .select("sucursal_id")
        .in("sucursal_id", deSucursales.map((s) => s.id))
        .eq("estado", "activo")
        .gt("monto_por_cobro", 0)
    : { data: [] };
  const quePagan = new Set(((activas ?? []) as { sucursal_id: string }[]).map((a) => a.sucursal_id));

  const negocios: ReferidoDeVendedor[] = filas.map((f) => {
    const suyos = cobros.filter((c) => c.marca_id === f.marca_id);
    const sus = deSucursales.filter((s) => s.marca_id === f.marca_id);
    return {
      marca: f.marcas?.nombre_comercial ?? "Negocio",
      slug: sus.find((s) => s.estado === "publicado")?.slug ?? null,
      vinculadoEn: f.vinculado_en,
      cobros: suyos.length,
      totalPagado: redondear(suyos.reduce((s, c) => s + Number(c.monto_pagado), 0)),
      totalComision: redondear(suyos.reduce((s, c) => s + Number(c.comision), 0)),
      porCobrar: redondear(suyos.filter((c) => !c.pago_id).reduce((s, c) => s + Number(c.comision), 0)),
      ultimoCobro: suyos.map((c) => c.cobrado_en).sort().at(-1) ?? null,
      siguePagando: sus.some((s) => quePagan.has(s.id)),
    };
  });

  const meses: MesDeVentas[] = ultimosMeses(6).map((mes) => {
    const delMes = cobros.filter((c) => mesDe(c.cobrado_en) === mes);
    return {
      mes,
      ventas: redondear(delMes.reduce((s, c) => s + Number(c.monto_pagado), 0)),
      comisiones: redondear(delMes.reduce((s, c) => s + Number(c.comision), 0)),
      cobros: delMes.length,
      negociosNuevos: filas.filter((f) => mesDe(f.vinculado_en) === mes).length,
    };
  });

  const recibidos = ((pagos ?? []) as { monto: number; referencia: string | null; pagado_en: string }[]).map(
    (p): PagoRecibido => ({ monto: Number(p.monto), referencia: p.referencia, pagadoEn: p.pagado_en }),
  );

  return {
    vendedor,
    negocios,
    meses,
    prospectos,
    pagos: recibidos,
    cuentas: cuentasDe(
      negocios,
      cobros.map((c) => ({ comision: Number(c.comision), cobradoEn: c.cobrado_en, cubierta: c.pago_id !== null })),
      recibidos,
    ),
  };
}
