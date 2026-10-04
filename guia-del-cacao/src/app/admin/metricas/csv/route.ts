import { perfilActual } from "@/lib/auth/sesion";
import { esPeriodo, tableroDeActividad } from "@/lib/datos/actividad";

const ENCABEZADO = [
  "Negocio",
  "Sucursal",
  "Estado",
  "Visitas",
  "WhatsApp",
  "Teléfono",
  "Correo",
  "Cómo llegar",
  "Redes",
  "Compartir",
  "Catálogo PDF",
  "Visitas a eventos",
  "Contactos (total)",
  "Reseñas",
  "Calificaciones",
  "Promedio",
  "Favoritos",
];

/**
 * La tabla por negocio de /admin/metricas, para el reporte a la Secretaría.
 * El layout de /admin no protege una ruta de API: el rol se comprueba aquí, y
 * las funciones de la base lo vuelven a comprobar.
 */
export async function GET(peticion: Request) {
  const perfil = await perfilActual();
  if (perfil?.rol !== "admin") {
    return new Response("No autorizado", { status: 403 });
  }

  const pedido = new URL(peticion.url).searchParams.get("periodo") ?? "";
  const periodo = esPeriodo(pedido) ? pedido : "30";
  const t = await tableroDeActividad(periodo);

  const celda = (valor: string | number | null | undefined) =>
    `"${String(valor ?? "").replaceAll('"', '""')}"`;

  const filas = [
    ENCABEZADO,
    ...t.negocios.map((f) => [
      f.negocio,
      f.sucursal,
      f.estado,
      f.actividad.vista_micrositio ?? 0,
      f.actividad.whatsapp ?? 0,
      f.actividad.telefono ?? 0,
      f.actividad.correo ?? 0,
      f.actividad.mapa ?? 0,
      f.actividad.red ?? 0,
      f.actividad.compartir ?? 0,
      f.actividad.catalogo_pdf ?? 0,
      f.actividad.vista_evento ?? 0,
      f.contactos,
      f.resenas,
      f.calificaciones,
      f.promedio === null ? "" : f.promedio.toFixed(1),
      f.favoritos,
    ]),
  ];

  // El BOM es para que Excel lea los acentos como UTF-8 y no como «Ã©».
  const csv = "﻿" + filas.map((f) => f.map(celda).join(",")).join("\r\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="metricas-${periodo}.csv"`,
    },
  });
}
