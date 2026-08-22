import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { DetallePublicacion } from "@/components/publico/detalle-publicacion";
import { ComentariosDePublicacion } from "@/components/publico/comentarios-de-publicacion";
import { eventoPorId } from "@/lib/datos/publico";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const evento = await eventoPorId(id);

  if (!evento) return { title: "No encontrado · Guía del Cacao" };

  return {
    title: `${evento.titulo} · Guía del Cacao`,
    description: evento.subtitulo ?? undefined,
  };
}

export default async function Evento({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const evento = await eventoPorId(id);

  // Un evento de un micrositio sin publicar no se distingue de uno inventado:
  // RLS ya devolvió nada, y la misma respuesta evita delatar cuáles existen.
  if (!evento) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <DetallePublicacion publicacion={evento} tipo="evento" />
      <ComentariosDePublicacion contexto="evento" referenciaId={id} />
    </div>
  );
}
