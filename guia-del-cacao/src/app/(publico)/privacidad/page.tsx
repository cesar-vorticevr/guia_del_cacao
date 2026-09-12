import Link from "next/link";
import type { Metadata } from "next";
import { CORREO_DE_CONTACTO } from "@/components/publico/pie-de-pagina";
import { ACTUALIZADO, DOMICILIO, RESPONSABLE } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Aviso de Privacidad · Guía del Cacao",
  description:
    "Qué datos personales trata la Guía del Cacao, para qué, con quién se comparten y cómo ejercer tus derechos de acceso, rectificación, cancelación y oposición.",
};

/**
 * El aviso de privacidad.
 *
 * Enumera los datos que la plataforma trata **hoy**, no los que se imaginó
 * tratar: cada punto corresponde a una tabla o a un bucket que existe. Si se
 * agrega algo que guarde información de una persona, se agrega aquí.
 *
 * Tres cosas que se dicen porque son ciertas y se pueden comprobar en el código,
 * y que hay que **corregir aquí el día que dejen de serlo**:
 *
 * - No hay pasarela de pago, así que no se tratan datos bancarios. Se verificó
 *   que no existe Stripe, Conekta ni ninguna otra en el repositorio.
 * - No hay analítica ni cookies de publicidad. Tampoco Vercel Analytics.
 * - Las mazorcas, los cupones y los rangos están apagados
 *   (`lib/funciones.ts`), así que no se recaba nada de ellos. Estuvieron
 *   descritos aquí y era la parte que ya no decía la verdad.
 */
export default function Privacidad() {
  return (
    <div className="mx-auto max-w-3xl pb-4">
      <h1 className="pt-8 font-display text-3xl">Aviso de Privacidad</h1>

      <p className="mt-2 font-mono text-xs tracking-wide text-cacao/70 uppercase">
        Última actualización: {ACTUALIZADO}
      </p>

      <p className="mt-4 text-lg text-cacao">
        Este aviso explica qué datos personales recabamos en la Guía del Cacao,
        para qué los usamos, con quién se comparten y cómo puedes controlarlos.
        Está escrito para leerse, no para cumplir un trámite.
      </p>

      <h2 className="mt-8 font-display text-2xl">
        Quién es responsable de tus datos
      </h2>
      <p className="mt-3 text-cacao">
        <strong className="text-selva-2">{RESPONSABLE}</strong>, con domicilio en{" "}
        {DOMICILIO}, es responsable del tratamiento de los datos personales que
        se recaban en este sitio, en los términos de la Ley Federal de
        Protección de Datos Personales en Posesión de los Particulares.
      </p>
      <p className="mt-3 text-cacao">
        Para cualquier asunto relacionado con tu privacidad —incluido ejercer
        los derechos que se describen más abajo— escribe a{" "}
        <a
          href={`mailto:${CORREO_DE_CONTACTO}`}
          className="font-bold text-selva underline"
        >
          {CORREO_DE_CONTACTO}
        </a>
        . Contesta una persona, no un formulario.
      </p>

      <h2 className="mt-8 font-display text-2xl">Qué datos recabamos</h2>
      <p className="mt-3 text-cacao">
        Solo los que hacen falta para que el sitio funcione. No pedimos tu CURP,
        tu RFC, tu domicilio ni tu fecha de nacimiento.
      </p>

      <ul className="mt-3 grid gap-3 text-cacao">
        <li>
          <strong className="text-selva-2">Para tener cuenta:</strong> tu nombre
          y tu correo electrónico. Si entras con Google, recibimos de esa cuenta
          tu nombre, tu correo y —si la tienes— tu foto de perfil. Las
          contraseñas las guarda cifradas nuestro proveedor de autenticación;
          nosotros no las vemos ni podemos recuperarlas.
        </li>
        <li>
          <strong className="text-selva-2">Si registras un negocio:</strong> el
          nombre de la marca, sus sucursales y los datos de contacto que decidas
          publicar —teléfono, correo, redes sociales, ubicación—, su descripción,
          su catálogo y sus fotos. Esto es información de negocio y{" "}
          <strong className="text-selva-2">se publica a propósito</strong>: es
          para que la gente te encuentre.
        </li>
        <li>
          <strong className="text-selva-2">De lo que haces en el sitio:</strong>{" "}
          tus reseñas y calificaciones, tus publicaciones y comentarios en la
          comunidad, los corazones que das, y los negocios que guardas en
          favoritos.
        </li>
        <li>
          <strong className="text-selva-2">Cuándo abriste qué:</strong> la fecha
          en que entras a cada publicación de la comunidad. Sirve para una sola
          cosa: saber si hay comentarios que todavía no has visto. No se usa para
          perfilarte ni se comparte con nadie.
        </li>
        <li>
          <strong className="text-selva-2">Las fotos que subes:</strong> a tus
          publicaciones, y si tienes negocio, a tu micrositio, tu catálogo y tus
          eventos.
        </li>
        <li>
          <strong className="text-selva-2">Tu plan, si tienes negocio:</strong>{" "}
          qué plan tiene cada sucursal, desde cuándo y en qué estado está.
        </li>
      </ul>

      <h2 className="mt-8 font-display text-2xl">
        Lo que no recabamos, y conviene que sepas
      </h2>
      <ul className="mt-3 grid gap-3 text-cacao">
        <li>
          <strong className="text-selva-2">Datos bancarios: ninguno.</strong> No
          hay pago en línea en la plataforma, así que aquí no se captura ni se
          guarda ningún número de tarjeta ni de cuenta.
        </li>
        <li>
          <strong className="text-selva-2">
            Sin analítica y sin publicidad.
          </strong>{" "}
          No usamos Google Analytics ni ninguna herramienta parecida, no te
          seguimos entre sitios y no hay anuncios de terceros.
        </li>
        <li>
          <strong className="text-selva-2">Sin datos sensibles.</strong> No
          pedimos ni tratamos información de salud, origen étnico, creencias,
          opiniones políticas ni preferencia sexual.
        </li>
      </ul>

      <h2 className="mt-8 font-display text-2xl">Para qué los usamos</h2>
      <ul className="mt-3 grid gap-2 text-cacao">
        <li>Identificarte al entrar y mantener tu sesión abierta.</li>
        <li>
          Publicar el directorio y los micrositios, que es de lo que sirve el
          sitio.
        </li>
        <li>
          Mostrar tus reseñas, publicaciones y comentarios donde corresponde, con
          tu nombre.
        </li>
        <li>Guardar tus favoritos para que los encuentres al volver.</li>
        <li>
          Avisarte por correo de lo que pasa en tu cuenta: confirmar tu
          dirección, recuperar tu contraseña y, si tienes negocio, cuando alguien
          te deja una reseña.
        </li>
        <li>
          Atender lo que nos escribas y responder a un reporte de contenido.
        </li>
      </ul>
      <p className="mt-3 text-cacao">
        <strong className="text-selva-2">
          No vendemos ni rentamos tus datos
        </strong>{" "}
        a nadie, y no los usamos para publicidad de terceros. No tomamos
        decisiones automatizadas que te afecten.
      </p>

      <h2 className="mt-8 font-display text-2xl">Qué se ve y qué no</h2>
      <p className="mt-3 text-cacao">
        <strong className="text-selva-2">Se ve públicamente</strong> tu nombre y
        tu foto de perfil junto a las reseñas, publicaciones y comentarios que
        escribas, y el contenido mismo. Si etiquetas a alguien con un arroba, ese
        nombre queda escrito en tu comentario.
      </p>
      <p className="mt-3 text-cacao">
        <strong className="text-selva-2">No se ve nunca</strong> tu correo
        electrónico, tu contraseña, ni la lista de negocios que guardaste en
        favoritos: los favoritos son privados y solo los ve tu propia cuenta.
      </p>
      <p className="mt-3 text-cacao">
        Los comentarios que un negocio oculta en su publicación dejan de verse
        para el resto, pero{" "}
        <strong className="text-selva-2">
          quien los escribió los sigue viendo
        </strong>
        : preferimos eso a esconderte lo tuyo sin decírtelo.
      </p>

      <h2 className="mt-8 font-display text-2xl">
        Con quién se comparten, y dónde viven
      </h2>
      <p className="mt-3 text-cacao">
        No compartimos tus datos con nadie que no haga falta para operar el
        sitio. Los que sí hacen falta son tres proveedores de infraestructura,
        que los tratan por encargo nuestro y no para sus propios fines:
      </p>
      <ul className="mt-3 grid gap-3 text-cacao">
        <li>
          <strong className="text-selva-2">Supabase</strong> — guarda la base de
          datos, las cuentas y los archivos que se suben.
        </li>
        <li>
          <strong className="text-selva-2">Vercel</strong> — sirve el sitio y
          sus páginas.
        </li>
        <li>
          <strong className="text-selva-2">Google</strong> — solo si eliges
          entrar con tu cuenta de Google, y solo para identificarte.
        </li>
      </ul>
      <p className="mt-3 text-cacao">
        <strong className="text-selva-2">
          Esos servidores están fuera de México
        </strong>{" "}
        —principalmente en Estados Unidos—, así que usar la plataforma implica
        una transferencia internacional de tus datos a esos proveedores, en los
        términos del artículo 37 de la ley. No se requiere tu consentimiento
        aparte para esta transferencia porque es necesaria para el servicio que
        estás pidiendo, y no habilita ningún otro uso.
      </p>
      <p className="mt-3 text-cacao">
        Además entregaremos información si una autoridad competente nos lo exige
        por escrito y conforme a la ley.
      </p>

      <h2 className="mt-8 font-display text-2xl">Cuánto tiempo los guardamos</h2>
      <p className="mt-3 text-cacao">
        Mientras tengas cuenta. Si nos pides cerrarla, borramos lo que te
        identifica —tu nombre, tu correo, tu foto— y las cosas privadas que
        guardaste, como tus favoritos.
      </p>
      <p className="mt-3 text-cacao">
        Lo que escribiste en público puede quedarse{" "}
        <strong className="text-selva-2">sin tu nombre</strong>, o borrarse
        completo si nos lo pides: una conversación en la que alguien te contestó
        deja de entenderse si desaparece la mitad, así que te preguntamos qué
        prefieres antes de hacerlo. Las fichas de un negocio se conservan
        mientras el negocio siga publicado.
      </p>

      <h2 className="mt-8 font-display text-2xl">
        Tus derechos: acceso, rectificación, cancelación y oposición
      </h2>
      <p className="mt-3 text-cacao">
        En cualquier momento puedes pedirnos:
      </p>
      <ul className="mt-3 grid gap-2 text-cacao">
        <li>
          <strong className="text-selva-2">Acceder</strong> a los datos que
          tenemos de ti.
        </li>
        <li>
          <strong className="text-selva-2">Rectificarlos</strong> si están
          equivocados o incompletos.
        </li>
        <li>
          <strong className="text-selva-2">Cancelarlos</strong>, es decir, que
          los borremos.
        </li>
        <li>
          <strong className="text-selva-2">Oponerte</strong> a que los usemos
          para algo concreto, y{" "}
          <strong className="text-selva-2">revocar tu consentimiento</strong>.
        </li>
      </ul>
      <p className="mt-3 text-cacao">
        Escribe a{" "}
        <a
          href={`mailto:${CORREO_DE_CONTACTO}`}
          className="font-bold text-selva underline"
        >
          {CORREO_DE_CONTACTO}
        </a>{" "}
        desde el correo con el que te registraste, o dinos cuál es para poder
        confirmar que la cuenta es tuya, y explica qué quieres. Te contestamos en
        un plazo máximo de{" "}
        <strong className="text-selva-2">veinte días hábiles</strong>, y si
        procede lo aplicamos dentro de los quince días hábiles siguientes.
      </p>
      <p className="mt-3 text-cacao">
        Mucho de esto no necesita pedírnoslo a nadie: desde{" "}
        <Link href="/cuenta" className="font-bold text-selva underline">
          tu cuenta
        </Link>{" "}
        puedes cambiar tus datos y tu contraseña, quitar tus favoritos, y editar
        o borrar tus reseñas, publicaciones y comentarios.
      </p>
      <p className="mt-3 text-cacao">
        Si no te convence nuestra respuesta, puedes acudir al{" "}
        <strong className="text-selva-2">INAI</strong>, el organismo que vigila
        esto en México.
      </p>

      <h2 className="mt-8 font-display text-2xl">Cookies</h2>
      <p className="mt-3 text-cacao">
        Usamos <strong className="text-selva-2">solo las necesarias</strong> para
        mantener tu sesión iniciada. Sin ellas el sitio no puede recordar quién
        eres al pasar de una página a otra, y por eso no hay forma de rechazarlas
        y seguir con la sesión abierta — tampoco te pedimos consentimiento con
        una ventana encima del contenido, porque no hay nada más que consentir.
      </p>
      <p className="mt-3 text-cacao">
        No hay cookies de publicidad, de analítica ni de seguimiento entre
        sitios. Puedes borrar las nuestras desde tu navegador cuando quieras; si
        lo haces, tendrás que volver a entrar.
      </p>

      <h2 className="mt-8 font-display text-2xl">Menores de edad</h2>
      <p className="mt-3 text-cacao">
        La plataforma es para mayores de catorce años. No recabamos datos de
        menores a sabiendas; si crees que un menor a tu cargo creó una cuenta,
        escríbenos y la cerramos.
      </p>

      <h2 className="mt-8 font-display text-2xl">Seguridad</h2>
      <p className="mt-3 text-cacao">
        El sitio va cifrado de punta a punta (HTTPS), las contraseñas se guardan
        cifradas y el acceso a cada dato lo decide la propia base de datos, no
        solo la pantalla: una cuenta no puede leer lo privado de otra aunque
        conozca su dirección. Ningún sistema es infalible, y si alguna vez
        ocurriera una violación de seguridad que afecte tus datos, te lo diremos.
      </p>

      <h2 className="mt-8 font-display text-2xl">Cambios a este aviso</h2>
      <p className="mt-3 text-cacao">
        Si cambia, lo publicamos en esta misma página y actualizamos la fecha de
        arriba. Si el cambio es de fondo —un dato nuevo, un uso nuevo, un
        proveedor nuevo— te avisamos por correo antes de que aplique.
      </p>

      <p className="mt-10 border-t-2 border-ink/10 pt-6 text-sm text-cacao/70">
        ¿Algo de esto no te queda claro? Escribe a{" "}
        <a
          href={`mailto:${CORREO_DE_CONTACTO}`}
          className="font-bold text-selva underline"
        >
          {CORREO_DE_CONTACTO}
        </a>{" "}
        y te lo explicamos. También puedes leer las{" "}
        <Link href="/terminos" className="font-bold text-selva underline">
          condiciones del servicio
        </Link>
        .
      </p>
    </div>
  );
}
