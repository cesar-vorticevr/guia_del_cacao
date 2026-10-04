import { perfilActual } from "@/lib/auth/sesion";
import { todosLosConvenios } from "@/lib/datos/admin";
import { normalizarCodigo } from "@/lib/tipos";

/**
 * Los negocios que publicaron con un código, para el reporte a la Secretaría.
 *
 * El layout de /admin no protege una ruta de API, así que el rol se comprueba
 * aquí. Y la consulta va por RLS: sin ser admin, `convenios` viene vacía.
 */
export async function GET(peticion: Request) {
  const perfil = await perfilActual();
  if (perfil?.rol !== "admin") {
    return new Response("No autorizado", { status: 403 });
  }

  const codigo = normalizarCodigo(
    new URL(peticion.url).searchParams.get("codigo") ?? "",
  );
  const convenio = (await todosLosConvenios()).find((c) => c.codigo === codigo);
  if (!convenio) return new Response("No existe ese código", { status: 404 });

  const celda = (valor: string | null | undefined) =>
    `"${(valor ?? "").replaceAll('"', '""')}"`;

  const filas = [
    ["Negocio", "Sucursal", "Estado", "Desde", "Precio de convenio hasta"],
    ...convenio.suscripciones.map((uso) => [
      uso.sucursales?.marcas?.nombre_comercial,
      uso.sucursales?.nombre_sucursal,
      uso.sucursales?.estado,
      uso.fecha_inicio.slice(0, 10),
      uso.precio_convenio_hasta?.slice(0, 10),
    ]),
  ];

  // El BOM es para que Excel lea los acentos como UTF-8 y no como «Ã©».
  const csv = "\uFEFF" + filas.map((f) => f.map(celda).join(",")).join("\r\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="convenio-${codigo.toLowerCase()}.csv"`,
    },
  });
}
