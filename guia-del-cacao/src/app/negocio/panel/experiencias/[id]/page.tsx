import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { origenDelSitio, perfilActual } from "@/lib/auth/sesion";
import { cupoDe, experienciaDe, experienciasDe, marcaDe } from "@/lib/datos/experiencias";
import { linkDe } from "@/lib/experiencias";
import { EditorDeExperiencia } from "@/components/experiencias/editor";

export const metadata: Metadata = { title: "Editar experiencia · Guía del Cacao" };

/** El editor de una experiencia de realidad aumentada (migración 000066). */
export default async function EditarExperiencia({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const perfil = await perfilActual();

  if (!perfil) redirect("/login");
  if (!perfil.rol_confirmado) redirect("/elegir-rol");
  if (perfil.rol !== "negocio") redirect("/cuenta");

  const marca = await marcaDe(perfil.id);
  if (!marca) redirect("/negocio/completar-marca");

  const [experiencia, todas, cupo, origen] = await Promise.all([
    experienciaDe(marca.id, id),
    experienciasDe(marca.id),
    cupoDe(marca.id),
    origenDelSitio(),
  ]);
  if (!experiencia) notFound();

  const otrasPublicadas = todas.filter((e) => e.estado === "publicada" && e.id !== experiencia.id).length;

  return (
    <EditorDeExperiencia
      experiencia={experiencia}
      link={linkDe(origen, experiencia.codigo)}
      puedePublicar={cupo > 0}
      hayLugar={otrasPublicadas < cupo}
    />
  );
}
