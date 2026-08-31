import type { Metadata } from "next";
import { CORREO_DE_CONTACTO } from "@/components/publico/pie-de-pagina";

export const metadata: Metadata = { title: "Privacidad y Cookies · Guía del Cacao" };

/**
 * Borrador del aviso de privacidad, en el molde de la LFPDPPP: qué se recoge,
 * para qué, con quién se comparte y cómo se ejercen los derechos ARCO.
 *
 * Solo enumera datos que la plataforma pide de verdad hoy. **Falta revisión
 * legal y falta el domicilio del responsable**, que no está en el repositorio y
 * nadie debería inventar; el hueco se señala en la página, no se rellena.
 */
export default function Privacidad() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="pt-8 font-display text-3xl">Privacidad y Cookies</h1>

      <p className="mt-4 rounded-3xl border-2 border-mango bg-crema-2 p-5 text-cacao">
        <strong className="text-selva-2">Documento en preparación.</strong> Este
        aviso todavía no ha pasado por revisión legal y le falta el domicilio del
        responsable. Describe los datos que la plataforma trata hoy.
      </p>

      <h2 className="mt-8 font-display text-2xl">Quién trata tus datos</h2>
      <p className="mt-3 text-cacao">
        La Guía del Cacao es responsable del tratamiento de los datos personales
        que recabamos en este sitio. Para cualquier asunto relacionado con tu
        privacidad, escribe a{" "}
        <a
          href={`mailto:${CORREO_DE_CONTACTO}`}
          className="font-bold text-selva underline"
        >
          {CORREO_DE_CONTACTO}
        </a>
        .
      </p>

      <h2 className="mt-8 font-display text-2xl">Qué datos recabamos</h2>
      <ul className="mt-3 grid gap-2 text-cacao">
        <li>
          <strong className="text-selva-2">De cualquier cuenta:</strong> nombre y
          correo electrónico. Si entras con Google, lo que esa cuenta nos comparte
          al identificarte.
        </li>
        <li>
          <strong className="text-selva-2">De un negocio:</strong> los datos de
          contacto de la marca y sus sucursales, que son públicos por su
          naturaleza — se publican para que la gente pueda encontrarte.
        </li>
        <li>
          <strong className="text-selva-2">De tu actividad:</strong> las mazorcas
          que juntas, tus reseñas y calificaciones, y lo que escribes en el foro.
        </li>
        <li>
          <strong className="text-selva-2">Comprobantes de compra:</strong> si
          adjuntas la foto de un ticket al pedir mazorcas.
        </li>
      </ul>

      <h2 className="mt-8 font-display text-2xl">Para qué los usamos</h2>
      <p className="mt-3 text-cacao">
        Para identificarte al entrar, llevar la cuenta de tus mazorcas y tu rango,
        mostrar tus reseñas en el micrositio del negocio y permitir que quien
        atiende confirme tu visita. No vendemos tus datos ni los usamos para
        publicidad de terceros.
      </p>

      <h2 className="mt-8 font-display text-2xl">Qué se hace público</h2>
      <p className="mt-3 text-cacao">
        Tu nombre y tu rango aparecen junto a las reseñas y los temas que
        publicas. Tu correo no se muestra nunca.
      </p>
      <p className="mt-3 text-cacao">
        <strong className="text-selva-2">Los comprobantes son privados.</strong>{" "}
        Un ticket puede traer tu nombre o los últimos dígitos de una tarjeta, así
        que se guardan aparte y solo los ve, por un momento, el negocio al que le
        pediste las mazorcas. Nadie más tiene acceso.
      </p>

      <h2 className="mt-8 font-display text-2xl">Tus derechos</h2>
      <p className="mt-3 text-cacao">
        Puedes pedir acceder a tus datos, rectificarlos si son incorrectos,
        cancelarlos u oponerte a su uso, así como revocar tu consentimiento.
        Escríbenos al correo de arriba y te respondemos con lo que necesitamos
        para atender tu solicitud.
      </p>

      <h2 className="mt-8 font-display text-2xl">Cookies</h2>
      <p className="mt-3 text-cacao">
        Usamos las cookies necesarias para mantener tu sesión iniciada. Sin ellas
        el sitio no puede recordar quién eres entre una página y otra. No usamos
        cookies de publicidad ni de seguimiento entre sitios. Puedes borrarlas
        desde tu navegador; si lo haces, tendrás que volver a entrar.
      </p>

      <h2 className="mt-8 font-display text-2xl">Cambios</h2>
      <p className="mt-3 text-cacao">
        Si este aviso cambia, lo publicaremos en esta misma página.
      </p>
    </div>
  );
}
