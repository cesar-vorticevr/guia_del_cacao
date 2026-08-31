import { redirect } from "next/navigation";

/** Cada noticia es ahora una publicación de la comunidad. */
export default async function NoticiaVieja({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/comunidad/${id}`);
}
