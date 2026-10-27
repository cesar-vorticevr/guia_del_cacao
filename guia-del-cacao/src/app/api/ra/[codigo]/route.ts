import { crearClienteServidor } from "@/lib/supabase/server";
import { BUCKET_EXPERIENCIAS, urlDeArchivo } from "@/lib/experiencias";

/**
 * Lo que pinta el visor de realidad aumentada (`public/ra/visor.html`).
 *
 * Contesta con la forma que espera el visor de Vórtice VR (`title`, `items`,
 * `buttons`, `img`) más las direcciones de sus archivos en Supabase Storage.
 * Si se ve o no lo decide la base (`experiencia_publica`): publicada, con plan
 * y dentro del cupo. Su dueña la ve aunque no, para probarla antes.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  if (!/^[a-z0-9]{6,12}$/.test(codigo)) return Response.json({ error: "No existe." }, { status: 404 });

  const supabase = await crearClienteServidor();
  const { data } = await supabase.rpc("experiencia_publica", { p_codigo: codigo });
  const fila = (data as Record<string, unknown>[] | null)?.[0];
  if (!fila || !fila.imagen || !fila.objetivo) {
    return Response.json({ error: "No existe." }, { status: 404 });
  }

  const v = encodeURIComponent(String(fila.actualizada_en));
  return Response.json(
    {
      codigo: fila.codigo,
      title: fila.titulo || "Realidad aumentada",
      items: fila.elementos,
      buttons: fila.botones,
      img: { w: fila.imagen_ancho, h: fila.imagen_alto },
      image: `${urlDeArchivo(fila.imagen as string)}?v=${v}`,
      target: `${urlDeArchivo(fila.objetivo as string)}?v=${v}`,
      files: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET_EXPERIENCIAS}/${fila.marca_id}/${fila.id}/`,
      marca: fila.marca,
      slug: fila.slug,
      preview: !fila.se_ve,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** Una vista más: el visor la manda al abrir la cámara. */
export async function POST(_request: Request, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  if (!/^[a-z0-9]{6,12}$/.test(codigo)) return new Response(null, { status: 204 });

  const supabase = await crearClienteServidor();
  await supabase.rpc("contar_vista_de_experiencia", { p_codigo: codigo });
  return new Response(null, { status: 204 });
}
