import Link from "next/link";
import type { Metadata } from "next";
import { CORREO_DE_CONTACTO } from "@/components/publico/pie-de-pagina";
import { ACTUALIZADO, DOMICILIO, RESPONSABLE } from "@/lib/legal";
import { PAGO_SIMULADO } from "@/lib/pagos";

export const metadata: Metadata = {
  title: "Condiciones del Servicio · Guía del Cacao",
  description:
    "Las reglas de uso de la Guía del Cacao: qué es y qué no es la plataforma, qué puedes hacer con tu cuenta, cómo funcionan los planes de los negocios y qué contenido se permite.",
};

/**
 * Las condiciones del servicio.
 *
 * Describe lo que la plataforma hace **hoy** de verdad —una reseña por negocio,
 * una publicación al día, cinco comentarios por publicación, el plan por
 * sucursal con quince días de prueba— para que no prometa nada que el código no
 * cumpla. Cada regla de aquí tiene detrás un trigger o una política; si alguna
 * cambia en la base, este texto se queda mintiendo y hay que corregirlo.
 *
 * Dos cosas se leen del código y no se escriben a mano, a propósito:
 *
 * - **El cobro**, desde `PAGO_SIMULADO`. Hoy no hay cargo real, y decir que sí
 *   lo hay sería ofrecer un trato que no existe; el día que entre la pasarela,
 *   esa bandera cambia y el texto la sigue.
 * - **Las mazorcas y los cupones ya no salen.** Estaban descritos con detalle
 *   —el tope de tres al día, que un canje no se devuelve— y son justo las
 *   funciones apagadas en `lib/funciones.ts`. Un contrato que regula algo que
 *   no existe es peor que uno corto.
 */
export default function Terminos() {
  return (
    <div className="mx-auto max-w-3xl pb-4">
      <h1 className="pt-8 font-display text-3xl">Condiciones del Servicio</h1>

      <p className="mt-2 font-mono text-xs tracking-wide text-cacao/70 uppercase">
        Última actualización: {ACTUALIZADO}
      </p>

      <p className="mt-4 text-lg text-cacao">
        Estas condiciones son el acuerdo entre tú y{" "}
        <strong className="text-selva-2">{RESPONSABLE}</strong> —con domicilio en{" "}
        {DOMICILIO}— para usar la Guía del Cacao. Al crear una cuenta o usar el
        sitio las aceptas. Están escritas en claro y sin letra chica: si algo no
        se entiende, es un defecto nuestro y queremos saberlo.
      </p>

      <h2 className="mt-8 font-display text-2xl">Qué es esta plataforma</h2>
      <p className="mt-3 text-cacao">
        Un <strong className="text-selva-2">directorio</strong> de negocios del
        cacao en México, con la ficha de cada uno, una agenda de eventos y un
        espacio de comunidad.
      </p>
      <p className="mt-3 text-cacao">
        <strong className="text-selva-2">No es una tienda.</strong> Aquí no se
        vende nada, no se cobra ninguna comisión y no se procesan pedidos ni
        pagos entre tú y un negocio. Lo que ves en un catálogo es información que
        publica el propio negocio para que sepas qué tiene y cómo contactarlo; lo
        que ocurra después es un trato directo entre ustedes dos, y la guía no es
        parte de él.
      </p>
      <p className="mt-3 text-cacao">
        Cada negocio es responsable de lo que publica: sus datos, sus precios,
        sus horarios, sus fotos y sus eventos. No revisamos uno por uno antes de
        que salgan, así que{" "}
        <strong className="text-selva-2">
          no garantizamos que la información esté correcta ni al día
        </strong>
        . Si encuentras algo equivocado, dínoslo y lo corregimos o le pedimos al
        negocio que lo haga.
      </p>

      <h2 className="mt-8 font-display text-2xl">Tu cuenta</h2>
      <ul className="mt-3 grid gap-2 text-cacao">
        <li>
          Para tener cuenta hacen falta{" "}
          <strong className="text-selva-2">catorce años</strong> cumplidos.
        </li>
        <li>Los datos que registras deben ser tuyos y verdaderos.</li>
        <li>
          Eres responsable de lo que se haga desde tu cuenta. Cuida tu
          contraseña; si crees que alguien entró, cámbiala desde tu cuenta y
          avísanos.
        </li>
        <li>
          Puedes entrar con tu correo o con Google. En los dos casos eliges
          después si la usas <strong className="text-selva-2">como visitante</strong>{" "}
          o <strong className="text-selva-2">como negocio</strong>: son cuentas
          distintas y no se mezclan. Si necesitas las dos, usa dos correos.
        </li>
        <li>
          Una cuenta de negocio solo puede administrar las marcas y sucursales de
          las que su titular es dueño o representante.
        </li>
        <li>
          Puedes cerrar tu cuenta cuando quieras escribiéndonos. Qué pasa con lo
          que dejaste publicado está en el{" "}
          <Link href="/privacidad" className="font-bold text-selva underline">
            aviso de privacidad
          </Link>
          .
        </li>
      </ul>

      <h2 className="mt-8 font-display text-2xl">Reseñas y calificaciones</h2>
      <ul className="mt-3 grid gap-2 text-cacao">
        <li>
          Cada persona tiene{" "}
          <strong className="text-selva-2">una reseña y una calificación</strong>{" "}
          por negocio, y puede corregirlas una vez al día. No se acumulan: lo que
          se lee es lo que piensas hoy.
        </li>
        <li>
          <strong className="text-selva-2">No hay reseña sin estrellas.</strong>{" "}
          La nota es parte de la opinión y es lo que suma al promedio.
        </li>
        <li>
          Escribe sobre tu propia experiencia. No se permiten insultos, datos
          personales de terceros, ni reseñas pagadas, inventadas o escritas por
          el propio negocio o su competencia.
        </li>
        <li>
          Las reseñas están disponibles en los micrositios cuyo plan las
          incluye. El negocio puede responder a la tuya, pero{" "}
          <strong className="text-selva-2">no puede borrarla ni editarla</strong>.
        </li>
      </ul>

      <h2 className="mt-8 font-display text-2xl">La comunidad</h2>
      <ul className="mt-3 grid gap-2 text-cacao">
        <li>
          Publica quien quiera, con un tope de{" "}
          <strong className="text-selva-2">una publicación al día</strong> por
          cuenta. Es lo que evita que el muro lo acapare una sola persona.
        </li>
        <li>
          Cada publicación admite hasta{" "}
          <strong className="text-selva-2">cinco comentarios</strong> por
          persona, y en un evento se comenta una vez.
        </li>
        <li>
          Puedes dar corazones y etiquetar con arroba, pero{" "}
          <strong className="text-selva-2">
            solo a quien ya participó en esa conversación
          </strong>
          . No hay forma de etiquetar a desconocidos, y es a propósito.
        </li>
        <li>
          Sube solo fotos tuyas o que tengas derecho a usar. Nada de material con
          derechos de otro, ni fotos de personas que no autorizaron aparecer.
        </li>
        <li>
          Quien escribió algo puede editarlo, ocultarlo o borrarlo. Un negocio
          puede ocultar comentarios en sus propias publicaciones, y quien lo
          escribió lo sigue viendo con su aviso: no se esconde nada en silencio.
        </li>
      </ul>

      <h2 className="mt-8 font-display text-2xl">Lo que no se permite</h2>
      <p className="mt-3 text-cacao">
        Podemos retirar contenido o suspender una cuenta, con aviso cuando sea
        posible, por cualquiera de estas cosas:
      </p>
      <ul className="mt-3 grid gap-2 text-cacao">
        <li>
          Suplantar a una persona o a un negocio, o publicar una ficha de un
          negocio que no es tuyo.
        </li>
        <li>
          Acoso, amenazas, discurso de odio, o publicar datos privados de alguien
          más.
        </li>
        <li>Spam, publicidad ajena al cacao, o contenido repetido a propósito.</li>
        <li>Contenido sexual, violento o ilegal.</li>
        <li>
          Intentar romper el sitio: raspar el contenido en masa, saltarse los
          límites de la cuenta, probar contraseñas ajenas o atacar la
          infraestructura.
        </li>
      </ul>
      <p className="mt-3 text-cacao">
        Si crees que algo incumple esto, escríbenos a{" "}
        <a
          href={`mailto:${CORREO_DE_CONTACTO}`}
          className="font-bold text-selva underline"
        >
          {CORREO_DE_CONTACTO}
        </a>{" "}
        con el enlace. Y si te suspendimos y crees que fue un error, contéstanos
        por ahí mismo: lo revisamos.
      </p>

      <h2 className="mt-8 font-display text-2xl">De quién es lo que publicas</h2>
      <p className="mt-3 text-cacao">
        <strong className="text-selva-2">Tuyo.</strong> Lo que escribes y las
        fotos que subes siguen siendo tuyos. Al publicarlos nos das permiso para
        mostrarlos dentro de la guía y en sus enlaces compartidos, mientras estén
        publicados; nada más. No los vendemos, no los licenciamos a terceros y no
        los usamos en publicidad.
      </p>
      <p className="mt-3 text-cacao">
        El nombre, el logotipo y el diseño de la Guía del Cacao son nuestros. Los
        nombres y logotipos de cada negocio son de su dueño.
      </p>

      <h2 className="mt-8 font-display text-2xl">Si tienes un negocio</h2>
      <p className="mt-3 text-cacao">
        Armar el micrositio no cuesta nada y puedes dejarlo a medias: lo que
        captures se guarda. Para{" "}
        <strong className="text-selva-2">salir en el directorio</strong> hacen
        falta dos cosas, y las dos las comprueba el sistema al publicar:
      </p>
      <ul className="mt-3 grid gap-2 text-cacao">
        <li>
          El micrositio completo: nombre, descripción, logotipo y al menos un
          producto elegido para esa sucursal.
        </li>
        <li>Un plan vigente para esa sucursal.</li>
      </ul>

      <h3 className="mt-6 font-display text-xl">Los planes</h3>
      <p className="mt-3 text-cacao">
        Son tres, y{" "}
        <strong className="text-selva-2">el plan es de cada sucursal</strong>, no
        de la cuenta: un negocio con tres locales paga tres, y puede tener uno
        publicado y otro en borrador.
      </p>
      <ul className="mt-3 grid gap-2 text-cacao">
        <li>
          <strong className="text-selva-2">Básico, $99 al mes</strong> — la ficha
          en el directorio y el micrositio con catálogo.
        </li>
        <li>
          <strong className="text-selva-2">Plus, $199 al mes</strong> — lo
          anterior y las reseñas de tus clientes en tu micrositio.
        </li>
        <li>
          <strong className="text-selva-2">Premier, $299 al mes</strong> — lo
          anterior y anunciar tus eventos en la agenda.
        </li>
      </ul>
      <p className="mt-3 text-cacao">
        Cada sucursal estrena{" "}
        <strong className="text-selva-2">quince días de prueba</strong>, con
        todas las funciones de su plan. El conteo empieza cuando la sucursal
        queda aprobada, no cuando eliges el plan: no se te van los días mientras
        esperas. Durante la prueba puedes cambiar de plan sin costo.
      </p>

      <h3 className="mt-6 font-display text-xl">
        {PAGO_SIMULADO ? "Cómo se paga hoy" : "Cobro y cancelación"}
      </h3>
      {PAGO_SIMULADO ? (
        <>
          <p className="mt-3 text-cacao">
            <strong className="text-selva-2">
              Todavía no hay pago en línea.
            </strong>{" "}
            La plataforma no captura tarjetas ni hace cargos: al elegir un plan
            queda registrado cuál es y desde cuándo, y el pago se acuerda
            directamente con nosotros por correo. Mientras esto siga así, no se
            te cobrará nada desde el sitio.
          </p>
          <p className="mt-3 text-cacao">
            Cuando entre el cobro automático te avisaremos antes de que aplique,
            con las condiciones de cobro y cancelación por escrito, y tendrás que
            aceptarlas para que se te cargue algo.
          </p>
        </>
      ) : (
        <p className="mt-3 text-cacao">
          El plan se cobra por mes y por sucursal, y se renueva solo hasta que lo
          canceles. Puedes cancelar cuando quieras desde tu panel: el micrositio
          sigue publicado hasta el final del periodo ya pagado, y no se devuelven
          los días no usados del mes en curso.
        </p>
      )}

      <h3 className="mt-6 font-display text-xl">Si bajas o cancelas el plan</h3>
      <p className="mt-3 text-cacao">
        <strong className="text-selva-2">
          Lo que ya publicaste deja de verse, pero no se borra
        </strong>
        : sigue en tu panel y vuelve a mostrarse en cuanto recuperes el plan que
        lo incluye, tal como estaba. Y siempre puedes borrar tus propias
        publicaciones, con plan o sin él — cobrarte por limpiar no tendría
        sentido.
      </p>
      <p className="mt-3 text-cacao">
        Una{" "}
        <strong className="text-selva-2">pausa puesta por moderación</strong> es
        distinta: no se levanta pagando. Si te suspendimos por incumplir estas
        condiciones, se resuelve hablando.
      </p>

      <h2 className="mt-8 font-display text-2xl">
        Hasta dónde respondemos nosotros
      </h2>
      <p className="mt-3 text-cacao">
        El servicio se ofrece tal como está. Hacemos lo que podemos por tenerlo
        en pie y correcto, pero no prometemos que esté disponible sin
        interrupciones ni que la información de cada negocio sea exacta.
      </p>
      <p className="mt-3 text-cacao">
        No respondemos por lo que ocurra en un trato entre tú y un negocio —lo
        que compres, lo que te cobren, lo que te entreguen o un evento que se
        cancele—, ni por el contenido que publica un tercero. Nada de esto
        limita los derechos que te da la ley como consumidor, que siguen
        valiendo aunque aquí no se mencionen.
      </p>

      <h2 className="mt-8 font-display text-2xl">Cambios a estas condiciones</h2>
      <p className="mt-3 text-cacao">
        Pueden cambiar. Lo publicamos en esta página y actualizamos la fecha de
        arriba; si el cambio te afecta de fondo —los precios, lo que incluye tu
        plan, o algo que ya aceptaste— te avisamos por correo antes de que
        aplique. Seguir usando el sitio después de eso es aceptar la versión
        nueva.
      </p>

      <h2 className="mt-8 font-display text-2xl">Ley aplicable</h2>
      <p className="mt-3 text-cacao">
        Estas condiciones se rigen por las leyes de los Estados Unidos
        Mexicanos. Para cualquier controversia, las partes se someten a los
        tribunales competentes de Villahermosa, Tabasco, sin perjuicio de que,
        como consumidor, puedas acudir a la Procuraduría Federal del Consumidor.
      </p>

      <h2 className="mt-8 font-display text-2xl">Contacto</h2>
      <p className="mt-3 text-cacao">
        Para dudas, reportes o cualquier cosa de aquí, escribe a{" "}
        <a
          href={`mailto:${CORREO_DE_CONTACTO}`}
          className="font-bold text-selva underline"
        >
          {CORREO_DE_CONTACTO}
        </a>
        . También puedes leer el{" "}
        <Link href="/privacidad" className="font-bold text-selva underline">
          aviso de privacidad
        </Link>
        .
      </p>
    </div>
  );
}
