import { perfilActual } from "@/lib/auth/sesion";
import { reporteDeVentas } from "@/lib/datos/reporte-de-ventas";

/**
 * El reporte del equipo de ventas en una hoja: un renglón por vendedor con lo
 * que vendió, lo que ganó, lo que se le debe y en qué paso va su libreta.
 *
 * El layout de /admin no protege una ruta de API, así que el rol se comprueba
 * aquí. Y la consulta va por RLS: sin ser admin, solo saldría lo propio.
 */
export async function GET() {
  const perfil = await perfilActual();
  if (perfil?.rol !== "admin") {
    return new Response("No autorizado", { status: 403 });
  }

  const { equipo } = await reporteDeVentas();
  const celda = (valor: string | number | null | undefined) =>
    `"${String(valor ?? "").replaceAll('"', '""')}"`;

  const filas = [
    [
      "Vendedor",
      "Correo",
      "Código",
      "Estado",
      "Vendido este mes",
      "Vendido en total",
      "Comisión este mes",
      "Comisión total",
      "Por pagar",
      "Negocios traídos",
      "Negocios que pagaron",
      "Prospectos",
      "Por contactar",
      "Contactado",
      "Demo",
      "Se dio de alta",
      "Pagó",
      "No le interesa",
      "Seguimientos atrasados",
      "Última actividad",
      "Comisión hasta",
    ],
    ...equipo.map((e) => [
      e.nombre,
      e.correo,
      e.codigo,
      e.estado,
      e.ventasDelMes,
      e.ventas,
      e.comisionDelMes,
      e.generado,
      e.porPagar,
      e.negocios,
      e.pagaron,
      e.prospectos,
      e.embudo.por_contactar,
      e.embudo.contactado,
      e.embudo.demo,
      e.embudo.alta,
      e.embudo.pago,
      e.embudo.no_interesa,
      e.atrasados,
      e.ultimaActividad?.slice(0, 10),
      e.comisionHasta,
    ]),
  ];

  // El BOM es para que Excel lea los acentos como UTF-8 y no como «Ã©».
  const csv = "﻿" + filas.map((f) => f.map(celda).join(",")).join("\r\n");
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(new Date());

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ventas-${hoy}.csv"`,
    },
  });
}
