import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { DetallePublicacion } from "@/components/publico/detalle-publicacion";
import { ComentariosDePublicacion } from "@/components/publico/comentarios-de-publicacion";
import { eventoPorId } from "@/lib/datos/publico";
import { urlDePublicacion } from "@/lib/imagenes";
import { tarjetaSocial } from "@/lib/compartir";
import { BotonCompartir } from "@/components/publico/boton-compartir";
import { origenDelSitio } from "@/lib/auth/sesion";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const evento = await eventoPorId(id);

  if (!evento) return { title: "No encontrado · Guía del Cacao" };

  /*
    El subtítulo si lo hay, y si no el principio del contenido: compartir un
    evento sin una línea que diga de qué va deja la tarjeta con el título solo,
    y el título de un evento suele ser su nombre, no su explicación.
  */
  return tarjetaSocial({
    titulo: evento.titulo,
    descripcion: evento.subtitulo ?? evento.contenido,
    imagen: urlDePublicacion(evento.imagenes?.[0]),
    ruta: `/eventos/${id}`,
    tipo: "article",
  });
}

export default async function Evento({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [evento, origen] = await Promise.all([
    eventoPorId(id),
    origenDelSitio(),
  ]);

  // Un evento de un micrositio sin publicar no se distingue de uno inventado:
  // RLS ya devolvió nada, y la misma respuesta evita delatar cuáles existen.
  if (!evento) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <DetallePublicacion publicacion={evento} tipo="evento" />

      {/*
        Compartir va entre el evento y los comentarios: quien acaba de leer de
        qué va y cuándo es, es justo quien lo reenvía. Al final, debajo de la
        conversación, no lo encuentra nadie.
      */}
      <div className="px-4 pt-5">
        <BotonCompartir
          url={`${origen}/eventos/${id}`}
          titulo={evento.titulo}
          texto="Compartir el evento"
        />
      </div>

      <ComentariosDePublicacion contexto="evento" referenciaId={id} />
    </div>
  );
}
