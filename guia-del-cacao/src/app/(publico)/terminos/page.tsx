import type { Metadata } from "next";
import { CORREO_DE_CONTACTO } from "@/components/publico/pie-de-pagina";

export const metadata: Metadata = {
  title: "Condiciones del Servicio · Guía del Cacao",
};

/**
 * Borrador de las condiciones.
 *
 * Describe lo que la plataforma hace hoy de verdad —los topes de mazorcas, que
 * un cupón canjeado no se devuelve, que publicar exige plan activo— para que no
 * prometa nada que el código no cumpla. Cada regla de aquí tiene detrás un
 * trigger o una política; si alguna cambia en la base, este texto se queda
 * mintiendo y hay que corregirlo.
 *
 * **Falta revisión legal antes de salir a producción**, y por eso el aviso se
 * lee en la propia página en vez de esconderse en un comentario.
 */
export default function Terminos() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="pt-8 font-display text-3xl">Condiciones del Servicio</h1>

      <p className="mt-4 rounded-3xl border-2 border-mango bg-crema-2 p-5 text-cacao">
        <strong className="text-selva-2">Documento en preparación.</strong> Este
        texto describe cómo funciona hoy la plataforma y todavía no ha pasado
        por revisión legal. Si algo aquí no coincide con lo que ves en el sitio,
        escríbenos y lo corregimos.
      </p>

      <h2 className="mt-8 font-display text-2xl">Qué es esta plataforma</h2>
      <p className="mt-3 text-cacao">
        La Guía del Cacao es un directorio de negocios del cacao en Tabasco.
        Cada negocio es responsable de la información de su micrositio: sus
        datos, sus precios, sus horarios y sus publicaciones. La guía no vende
        los productos que aparecen ni interviene en la relación entre un negocio
        y sus clientes.
      </p>

      <h2 className="mt-8 font-display text-2xl">Tu cuenta</h2>
      <ul className="mt-3 grid gap-2 text-cacao">
        <li>Los datos que registras deben ser tuyos y verdaderos.</li>
        <li>Eres responsable de lo que se haga desde tu cuenta.</li>
        <li>
          Puedes entrar con tu correo o con Google. En los dos casos eliges
          después si usas la plataforma como visitante o como negocio: son
          cuentas distintas y no se pueden mezclar.
        </li>
        <li>
          Una cuenta de negocio solo puede administrar las marcas y sucursales
          de las que su titular es dueño.
        </li>
      </ul>

      <h2 className="mt-8 font-display text-2xl">Mazorcas de cacao</h2>
      <p className="mt-3 text-cacao">
        Las mazorcas son un reconocimiento de la plataforma, no dinero: no se
        compran, no se venden, no se cambian por efectivo y no caducan mientras
        la cuenta siga activa.
      </p>
      <ul className="mt-3 grid gap-2 text-cacao">
        <li>
          <strong className="text-selva-2">Las abona el negocio</strong> que
          visitas cuando confirma tu solicitud, con un tope de tres por persona,
          por marca y por día.
        </li>
        <li>
          <strong className="text-selva-2">
            La plataforma regala cinco al día
          </strong>{" "}
          a cada cuenta para repartir en la comunidad, como máximo una a la
          misma persona. Las que no repartes ese día no se acumulan.
        </li>
        <li>
          <strong className="text-selva-2">Publicar cuesta una</strong> si eres
          visitante, y la recuperas si alguien apoya lo que escribiste. Para un
          negocio, publicar viene con su plan.
        </li>
        <li>
          Pedir mazorcas por visitas que no ocurrieron, o con comprobantes
          ajenos o alterados, es motivo para retirarlas y suspender la cuenta.
        </li>
      </ul>

      <h2 className="mt-8 font-display text-2xl">Cupones</h2>
      <p className="mt-3 text-cacao">
        Un negocio puede ofrecer cupones a cambio de mazorcas. La oferta es
        suya: él decide qué incluye, cuánto cuesta y hasta cuándo sirve, y es
        quien la entrega en su sucursal. La guía no responde por lo que se
        entregue ni por su calidad.
      </p>
      <ul className="mt-3 grid gap-2 text-cacao">
        <li>
          Al canjear, las mazorcas se descuentan en ese momento y{" "}
          <strong className="text-selva-2">el canje no se devuelve</strong>.
          Preséntalo en la sucursal antes de que termine su vigencia.
        </li>
        <li>Un cupón es uno por persona.</li>
        <li>
          Un cupón publicado{" "}
          <strong className="text-selva-2">no se edita</strong>: si alguien ya
          lo canjeó, cambiarle el precio o las condiciones sería cambiarle el
          trato a quien pagó. El negocio puede retirarlo, y quien ya lo canjeó
          lo conserva.
        </li>
      </ul>

      <h2 className="mt-8 font-display text-2xl">Reseñas y contenido</h2>
      <ul className="mt-3 grid gap-2 text-cacao">
        <li>
          Cada persona tiene una reseña y una calificación por negocio, y puede
          corregirlas una vez al día. No hay reseña sin estrellas: la nota es
          parte de la opinión.
        </li>
        <li>
          Escribe sobre tu propia experiencia. No se permiten insultos, datos
          personales de terceros, ni reseñas pagadas o escritas por el propio
          negocio.
        </li>
        <li>
          En la comunidad se publica con título, contenido y de una a cuatro
          fotos. Sube solo imágenes tuyas o que tengas derecho a usar.
        </li>
        <li>
          Lo que publicas sigue siendo tuyo; al publicarlo nos autorizas a
          mostrarlo dentro de la guía.
        </li>
        <li>
          Puedes ocultar o borrar lo que escribiste. Un negocio puede ocultar
          comentarios en sus propias publicaciones, y quien modera puede retirar
          contenido que incumpla estas reglas. Lo oculto lo sigue viendo quien
          lo escribió.
        </li>
      </ul>

      <h2 className="mt-8 font-display text-2xl">Publicar un negocio</h2>
      <p className="mt-3 text-cacao">
        Para salir en el directorio hacen falta dos cosas: un plan activo y el
        micrositio completo —nombre, descripción, logotipo y al menos un
        producto—. Cada plan incluye distintas cosas: cuántas sucursales, si
        puede dar mazorcas y si puede publicar en la comunidad y en la agenda.
      </p>
      <p className="mt-3 text-cacao">
        Si un negocio baja a un plan que no incluye publicar,{" "}
        <strong className="text-selva-2">
          lo que ya publicó deja de verse pero no se borra
        </strong>
        : sigue en su panel y vuelve a mostrarse en cuanto recupere el plan. Una
        pausa puesta por moderación no se levanta pagando.
      </p>

      <h2 className="mt-8 font-display text-2xl">Cambios y contacto</h2>
      <p className="mt-3 text-cacao">
        Estas condiciones pueden cambiar; avisaremos en el sitio cuando ocurra.
        Para cualquier duda escribe a{" "}
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
