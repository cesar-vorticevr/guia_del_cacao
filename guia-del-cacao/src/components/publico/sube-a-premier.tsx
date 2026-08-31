import Link from "next/link";

/**
 * La invitación a Premier, donde se publica.
 *
 * Va donde el negocio venía a hacer algo y no puede, no en la página de planes:
 * es el único momento en que la ventaja se entiende sola, porque acaba de
 * toparse con ella. Y dice qué gana, no qué le falta — "tu plan no lo incluye"
 * es la misma frase leída como una puerta cerrada.
 */
export function SubeAPremier({
  /** Qué venía a publicar: cambia el ejemplo, no el argumento. */
  que,
}: {
  que: "eventos" | "noticias";
}) {
  const esEvento = que === "eventos";

  return (
    <div className="max-w-2xl rounded-3xl border-2 border-mango/50 bg-mango/15 p-6">
      <p className="font-display text-xl font-semibold text-selva-2">
        {esEvento
          ? "Llena tu cata sin pagar publicidad"
          : "Cuenta lo tuyo donde ya te están leyendo"}
      </p>

      <p className="mt-2 text-cacao">
        {esEvento
          ? "Con Premier tus catas, talleres y ferias salen en la agenda de la Guía y en el muro de la comunidad, delante de gente que ya anda buscando qué hacer con el cacao este fin de semana."
          : "Con Premier tus noticias salen en el muro de la comunidad y en tu micrositio, delante de gente que ya vino a buscar cacao de Tabasco."}
      </p>

      {/*
        Ya no se nombra el foro: desde la migración 000029 abrir un tema y
        publicar son lo mismo, y ponerlo aquí como ventaja aparte prometía dos
        cosas donde hay una.
      */}
      <p className="mt-2 text-cacao">
        También te deja dar mazorcas en veinte sucursales y salir en el banner de
        la portada.
      </p>

      <Link
        href="/negocio/panel/cuenta"
        className="mt-4 inline-block min-h-12 rounded-full bg-mango px-6 py-3 font-bold text-ink shadow-dura-sm transition-transform active:translate-y-0.5"
      >
        Pasarme a Premier
      </Link>
    </div>
  );
}
