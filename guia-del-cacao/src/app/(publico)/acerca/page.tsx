import Link from "next/link";
import type { Metadata } from "next";
import { CORREO_DE_CONTACTO } from "@/components/publico/pie-de-pagina";

export const metadata: Metadata = { title: "Acerca de nosotros · Guía del Cacao" };

export default function Acerca() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="pt-8 font-display text-3xl">Acerca de nosotros</h1>

      <p className="mt-4 text-lg text-cacao">
        La Guía del Cacao reúne en un solo lugar a quienes hacen el cacao de
        México: productoras y fincas, comercializadoras, chocolaterías, museos y
        artesanías.
      </p>

      <h2 className="mt-8 font-display text-2xl">Qué encuentras aquí</h2>

      <ul className="mt-3 grid gap-3 text-cacao">
        <li>
          <strong className="text-selva-2">Un directorio</strong> con el
          micrositio de cada negocio: qué hace, dónde está y cómo llegar.
        </li>
        <li>
          <strong className="text-selva-2">La agenda</strong> de catas, ferias y
          talleres, que sigue viva fuera de la temporada de la feria.
        </li>
        <li>
          <strong className="text-selva-2">Tu cuenta</strong> para calificar y
          reseñar lo que visitas, y para comentar en los eventos a los que
          piensas ir.
        </li>
      </ul>

      <h2 className="mt-8 font-display text-2xl">Para los negocios</h2>

      <p className="mt-3 text-cacao">
        Cualquier negocio del cacao en México puede publicar su micrositio y
        anunciar sus catas, talleres y ferias.{" "}
        <Link href="/registro/negocio" className="font-bold text-selva underline">
          Así se da de alta
        </Link>
        .
      </p>

      <h2 className="mt-8 font-display text-2xl">Hablar con nosotros</h2>

      <p className="mt-3 text-cacao">
        Para dudas, correcciones de una ficha o propuestas, escribe a{" "}
        <a
          href={`mailto:${CORREO_DE_CONTACTO}`}
          className="font-bold text-selva underline"
        >
          {CORREO_DE_CONTACTO}
        </a>
        .
      </p>
    </div>
  );
}
