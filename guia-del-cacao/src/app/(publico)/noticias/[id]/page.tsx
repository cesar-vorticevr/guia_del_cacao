import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { DetallePublicacion } from "@/components/publico/detalle-publicacion";
import { ComentariosDePublicacion } from "@/components/publico/comentarios-de-publicacion";
import { noticiaPorId } from "@/lib/datos/publico";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const noticia = await noticiaPorId(id);

  if (!noticia) return { title: "No encontrado · Guía del Cacao" };

  return {
    title: `${noticia.titulo} · Guía del Cacao`,
    description: noticia.subtitulo ?? undefined,
  };
}

export default async function Noticia({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const noticia = await noticiaPorId(id);

  if (!noticia) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <DetallePublicacion publicacion={noticia} tipo="noticia" />
      <ComentariosDePublicacion contexto="noticia" referenciaId={id} />
    </div>
  );
}
