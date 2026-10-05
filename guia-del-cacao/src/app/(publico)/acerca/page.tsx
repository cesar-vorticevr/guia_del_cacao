import Link from "next/link";
import type { Metadata } from "next";
import { EscudoDeMarca } from "@/components/marca";
import { CORREO_DE_CONTACTO } from "@/components/publico/pie-de-pagina";

export const metadata: Metadata = {
  title: "Acerca de nosotros · Guía del Cacao",
  description:
    "Por qué existe la Guía del Cacao: para que los negocios que sostienen el cacao de México dejen de ser invisibles.",
};

/**
 * Acerca de nosotros.
 *
 * Cuenta por qué existe esto, y lo cuenta con datos reales: los del sondeo a
 * negocios de cacao de septiembre de 2026. Nada de "somos apasionados del
 * cacao" — lo que convence a un negocio de entrar es reconocer su propio
 * problema descrito con precisión, y lo que convence a un visitante es que hay
 * algo que vale la pena encontrar.
 *
 * Las cifras que aparecen salen de ese sondeo y no de ningún sitio más. Si
 * alguna cambia, se corrige aquí: una página que presume de escuchar no puede
 * inventarse lo que oyó.
 */
export default function Acerca() {
  return (
    <div className="mx-auto max-w-3xl pb-4">
      <header className="pt-8 text-center">
        <EscudoDeMarca className="mx-auto size-28 sm:size-32" />

        <h1 className="mt-3 font-display text-3xl sm:text-4xl">
          El cacao de México ya es de primer nivel.
          <br className="hidden sm:block" /> Lo que falta es que se sepa.
        </h1>
      </header>

      {/*
        La historia. Tres párrafos: de dónde viene el cacao, qué le pasa a quien
        lo trabaja, y qué hace esta guía. Ni uno más — quien llega aquí está
        decidiendo si registrarse, no leyendo un libro.
      */}
      <div className="mt-8 grid gap-4 text-lg text-cacao">
        <p>
          El chocolate empezó aquí. En estas tierras se fermentó el primer grano,
          se molió en metate y se bebió mucho antes de que cruzara el mar. Hoy,
          en Tabasco y en Chiapas y en Oaxaca, hay familias que llevan tres
          generaciones haciendo lo mismo: una finca de noventa años, un taller
          donde se talla el molinillo a mano, una chocolatería que tuesta en
          lotes de veinte barras.
        </p>

        <p>
          Y casi nadie sabe que existen. Cuando les preguntamos, seis de cada
          diez no tenían más presencia en internet que una página de Facebook, y
          hubo quienes no tenían nada. Varios nos dijeron lo mismo con distintas
          palabras: <strong className="text-selva-2">lo más difícil es que la
          gente sepa que estoy aquí</strong>. No les falta producto, ni oficio,
          ni historia. Les falta que alguien los encuentre.
        </p>

        <p>
          Para eso es esta guía. Un solo lugar donde buscar cacao mexicano por
          lo que se quiere —una barra de origen, un taller para el sábado, un
          molinillo de madera— y llegar a quien lo hace. Sin intermediarios y
          sin comisiones: aquí no vendemos nada. Te decimos quién lo tiene,
          dónde está y cómo hablarle.
        </p>
      </div>

      <aside className="mt-8 rounded-3xl border-2 border-mango/50 bg-mango/15 p-6">
        <p className="font-display text-xl text-selva-2">
          Esto se construyó preguntando primero
        </p>
        <p className="mt-2 text-cacao">
          Antes de terminar la plataforma se le preguntó a los negocios qué
          necesitaban. Varias cosas que parecían buenas ideas se cayeron con sus
          respuestas, y otras entraron porque las pidieron ellos. Si tienes un
          negocio de cacao y algo de aquí no te sirve, queremos saberlo — se ha
          cambiado antes.
        </p>
      </aside>

      <h2 className="mt-10 font-display text-2xl">Qué encuentras aquí</h2>

      <ul className="mt-3 grid gap-3 text-cacao">
        <li>
          <strong className="text-selva-2">Un directorio</strong> con la ficha
          de cada negocio: qué hace, qué vende, dónde está y cómo llegar. Se
          busca por negocio o por producto.
        </li>
        <li>
          <strong className="text-selva-2">La agenda</strong> de catas, ferias y
          talleres, que sigue viva fuera de la temporada de la feria.
        </li>
        <li>
          <strong className="text-selva-2">La comunidad</strong>, donde los
          negocios y quienes los visitan cuentan lo suyo y se responden.
        </li>
        <li>
          <strong className="text-selva-2">Tu cuenta</strong> para guardar tus
          favoritos, calificar lo que visitas y comentar.
        </li>
      </ul>

      <h2 className="mt-10 font-display text-2xl">Si tienes un negocio</h2>

      <p className="mt-3 text-cacao">
        Cualquier negocio del cacao en México puede tener su ficha aquí:
        productoras y fincas, comercializadoras, chocolaterías, museos,
        talleres y artesanías. Se arma sin pagar, se publica cuando esté lista,
        y se prueba quince días antes de que se cobre nada.{" "}
        <Link
          href="/registro/negocio"
          className="font-bold text-selva underline"
        >
          Así se da de alta
        </Link>
        .
      </p>

      <h2 className="mt-10 font-display text-2xl">Hablar con nosotros</h2>

      <p className="mt-3 text-cacao">
        Para dudas, correcciones de una ficha o propuestas, escribe a{" "}
        <a
          href={`mailto:${CORREO_DE_CONTACTO}`}
          className="font-bold text-selva underline"
        >
          {CORREO_DE_CONTACTO}
        </a>
        . Contestamos nosotros, no un formulario.
      </p>

      {/*
        El crédito, al final y discreto. Va aquí y no en el pie de todas las
        páginas: quien visita la guía viene por el cacao, no por quién la
        programó — pero quien llega a "acerca de" sí está preguntando quién
        está detrás.
      */}
      <p className="mt-10 border-t-2 border-ink/10 pt-6 text-sm text-cacao/70">
        La Guía del Cacao es desarrollada por{" "}
        <strong className="text-selva-2">Vórtice VR</strong>.
      </p>
    </div>
  );
}
