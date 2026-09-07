import type { Metadata } from "next";
import { CORREO_DE_CONTACTO } from "@/components/publico/pie-de-pagina";

export const metadata: Metadata = {
  title: "Política de Privacidad · Guía del Cacao",
};

/**
 * Borrador del aviso de privacidad.
 *
 * Enumera los datos que la plataforma trata **hoy**, no los que se imaginó
 * tratar: cada punto corresponde a una tabla o a un bucket que existe. Si se
 * agrega uno nuevo que guarde algo de una persona, se agrega aquí.
 *
 * **Falta revisión legal y el domicilio del responsable** antes de salir a
 * producción; el aviso se lee en la propia página.
 */
export default function Privacidad() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="pt-8 font-display text-3xl">Política de Privacidad</h1>

      <p className="mt-4 rounded-3xl border-2 border-mango bg-crema-2 p-5 text-cacao">
        <strong className="text-selva-2">Documento en preparación.</strong> Este
        aviso todavía no ha pasado por revisión legal y le falta el domicilio
        del responsable. Describe los datos que la plataforma trata hoy.
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
          <strong className="text-selva-2">De cualquier cuenta:</strong> nombre
          y correo electrónico. Si entras con Google, lo que esa cuenta nos
          comparte al identificarte: tu nombre, tu correo y tu foto de perfil.
        </li>
        <li>
          <strong className="text-selva-2">De un negocio:</strong> los datos de
          contacto de la marca y sus sucursales, que son públicos por su
          naturaleza — se publican para que la gente pueda encontrarte.
        </li>
        <li>
          <strong className="text-selva-2">De tu actividad:</strong> las
          mazorcas que juntas y tu rango, tus reseñas y calificaciones, lo que
          publicas y comentas en la comunidad, y las mazorcas que regalas o
          recibes.
        </li>
        <li>
          <strong className="text-selva-2">Fotos que subes:</strong> las de tus
          publicaciones en la comunidad y, si eres negocio, las de tu
          micrositio, tu catálogo, tus eventos y tus cupones.
        </li>
        <li>
          <strong className="text-selva-2">Cupones que canjeas:</strong> cuál,
          cuándo y cuántas mazorcas costó.
        </li>
        <li>
          <strong className="text-selva-2">Comprobantes de compra:</strong> si
          adjuntas la foto de un ticket al pedir mazorcas.
        </li>
      </ul>

      <h2 className="mt-8 font-display text-2xl">Para qué los usamos</h2>
      <p className="mt-3 text-cacao">
        Para identificarte al entrar, llevar la cuenta de tus mazorcas y tu
        rango, mostrar tus reseñas y publicaciones donde corresponde, permitir
        que quien atiende confirme tu visita y que el negocio te entregue el
        cupón que canjeaste. No vendemos tus datos ni los usamos para publicidad
        de terceros.
      </p>

      <h2 className="mt-8 font-display text-2xl">Qué se hace público</h2>
      <p className="mt-3 text-cacao">
        Tu nombre y tu rango aparecen junto a las reseñas, las publicaciones y
        los comentarios que escribes. Tu correo no se muestra nunca.
      </p>
      <p className="mt-3 text-cacao">
        <strong className="text-selva-2">Al canjear un cupón</strong>, el
        negocio que lo ofrece ve tu nombre y qué canjeaste: lo necesita para
        entregártelo en el mostrador. No ve tu correo ni el resto de tu
        actividad.
      </p>
      <p className="mt-3 text-cacao">
        <strong className="text-selva-2">Los comprobantes son privados.</strong>{" "}
        Un ticket puede traer tu nombre o los últimos dígitos de una tarjeta,
        así que se guardan aparte y solo los ve, por un momento, el negocio al
        que le pediste las mazorcas. Nadie más tiene acceso.
      </p>

      <h2 className="mt-8 font-display text-2xl">
        Cuánto tiempo los guardamos
      </h2>
      <p className="mt-3 text-cacao">
        Mientras tu cuenta siga activa. Si la cierras, se borra lo que te
        identifica; lo que ya se entregó —un cupón canjeado, las mazorcas que un
        negocio abonó— queda como registro de que ocurrió, porque es la
        constancia de un intercambio entre dos partes.
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
        Usamos las cookies necesarias para mantener tu sesión iniciada. Sin
        ellas el sitio no puede recordar quién eres entre una página y otra. No
        usamos cookies de publicidad ni de seguimiento entre sitios. Puedes
        borrarlas desde tu navegador; si lo haces, tendrás que volver a entrar.
      </p>

      <h2 className="mt-8 font-display text-2xl">Cambios</h2>
      <p className="mt-3 text-cacao">
        Si este aviso cambia, lo publicaremos en esta misma página.
      </p>
    </div>
  );
}
