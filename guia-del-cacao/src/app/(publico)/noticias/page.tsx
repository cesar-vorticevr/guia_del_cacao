import type { Metadata } from "next";
import { TarjetaPublicacion } from "@/components/publico/tarjeta-publicacion";
import { listarNoticias } from "@/lib/datos/publico";

export const metadata: Metadata = { title: "Noticias · Guía del Cacao" };

export default async function Noticias() {
  const noticias = await listarNoticias();

  return (
    <>
      <h1 className="pt-8 font-display text-3xl">Noticias</h1>
      <p className="mt-2 text-cacao">Lo más reciente de los negocios del cacao.</p>

      {noticias.length === 0 ? (
        <p className="mt-6 rounded-3xl bg-crema-2 p-6 text-cacao">
          Todavía no hay noticias publicadas.
        </p>
      ) : (
        <ul className="mt-6 grid gap-5 sm:grid-cols-2">
          {noticias.map((noticia) => (
            <TarjetaPublicacion key={noticia.id} publicacion={noticia} tipo="noticia" />
          ))}
        </ul>
      )}
    </>
  );
}
