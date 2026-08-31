import { redirect } from "next/navigation";

/** El editor se mudó a /eventos/[id]/editar, junto a la agenda. */
export default async function EditarEventoViejo({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/eventos/${id}/editar`);
}
