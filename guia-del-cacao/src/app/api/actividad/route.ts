import { crearClienteServidor } from "@/lib/supabase/server";
import { esTipoDeActividad } from "@/lib/actividad";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Recibe las anotaciones del navegador (`lib/actividad.ts`).
 *
 * Siempre contesta 204, también si algo no cuadra: es un faro, nadie espera la
 * respuesta, y un error aquí no debe asomarse en la consola de quien visita.
 * La base vuelve a filtrar: no cuenta al dueño ni al administrador.
 */
export async function POST(peticion: Request) {
  try {
    const datos = await peticion.json();

    if (esTipoDeActividad(datos?.tipo)) {
      const supabase = await crearClienteServidor();

      await supabase.rpc("anotar", {
        p_tipo: datos.tipo,
        p_sucursal: UUID.test(datos.sucursal ?? "") ? datos.sucursal : null,
        p_evento: UUID.test(datos.evento ?? "") ? datos.evento : null,
        p_detalle:
          typeof datos.detalle === "string" ? datos.detalle.slice(0, 120) : null,
      });
    }
  } catch {
    // Un cuerpo que no es JSON es ruido, no un error.
  }

  return new Response(null, { status: 204 });
}
