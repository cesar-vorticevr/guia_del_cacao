import type { Metadata } from "next";
import { CORREO_DE_CONTACTO } from "@/components/publico/pie-de-pagina";

export const metadata: Metadata = { title: "Términos de Uso · Guía del Cacao" };

/**
 * Borrador de los términos.
 *
 * Describe lo que la plataforma hace hoy de verdad —los topes de monedas, la
 * regla de una reseña por negocio, que publicar exige suscripción activa— para
 * que no prometa nada que el código no cumpla. **Falta revisión legal antes de
 * salir a producción**, y por eso el aviso se lee en la propia página en vez de
 * esconderse en un comentario.
 */
export default function Terminos() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="pt-8 font-display text-3xl">Términos de Uso</h1>

      <p className="mt-4 rounded-3xl border-2 border-mango bg-crema-2 p-5 text-cacao">
        <strong className="text-selva-2">Documento en preparación.</strong> Este
        texto describe cómo funciona hoy la plataforma y todavía no ha pasado por
        revisión legal. Si algo aquí no coincide con lo que ves en el sitio,
        escríbenos y lo corregimos.
      </p>

      <h2 className="mt-8 font-display text-2xl">Qué es esta plataforma</h2>
      <p className="mt-3 text-cacao">
        La Guía del Cacao es un directorio de negocios del cacao en Tabasco. Cada
        negocio es responsable de la información de su micrositio: sus datos, sus
        precios, sus horarios y sus publicaciones. La guía no vende los productos
        que aparecen ni interviene en la relación entre un negocio y sus
        clientes.
      </p>

      <h2 className="mt-8 font-display text-2xl">Tu cuenta</h2>
      <ul className="mt-3 grid gap-2 text-cacao">
        <li>Los datos que registras deben ser tuyos y verdaderos.</li>
        <li>Eres responsable de lo que se haga desde tu cuenta.</li>
        <li>
          Una cuenta de negocio solo puede administrar las marcas y sucursales de
          las que su titular es dueño.
        </li>
      </ul>

      <h2 className="mt-8 font-display text-2xl">Monedas de chocolate</h2>
      <p className="mt-3 text-cacao">
        Las monedas son un reconocimiento de la plataforma, no dinero: no se
        compran, no se venden, no se cambian por efectivo y no caducan mientras
        la cuenta siga activa. Las abona el negocio que visitas cuando confirma
        tu solicitud, con un tope de tres por persona, por marca y por día. Una
        moneda usada para apoyar un tema del foro se transfiere a quien lo
        escribió y no se devuelve.
      </p>
      <p className="mt-3 text-cacao">
        Pedir monedas por visitas que no ocurrieron, o con comprobantes ajenos o
        alterados, es motivo para retirarlas y suspender la cuenta.
      </p>

      <h2 className="mt-8 font-display text-2xl">Reseñas y contenido</h2>
      <ul className="mt-3 grid gap-2 text-cacao">
        <li>
          Cada persona tiene una reseña y una calificación por negocio, y puede
          corregirlas una vez al día.
        </li>
        <li>
          Escribe sobre tu propia experiencia. No se permiten insultos, datos
          personales de terceros, ni reseñas pagadas o escritas por el propio
          negocio.
        </li>
        <li>
          Lo que publicas sigue siendo tuyo; al publicarlo nos autorizas a
          mostrarlo dentro de la guía.
        </li>
        <li>
          Un negocio puede ocultar comentarios en sus propias publicaciones y
          quien modera puede retirar contenido que incumpla estas reglas. Lo
          oculto lo sigue viendo quien lo escribió.
        </li>
      </ul>

      <h2 className="mt-8 font-display text-2xl">Publicar un negocio</h2>
      <p className="mt-3 text-cacao">
        Para salir en el directorio hacen falta dos cosas: una suscripción activa
        y el micrositio completo —nombre, descripción, logotipo y al menos un
        producto—. Una pausa puesta por moderación no se levanta pagando.
      </p>

      <h2 className="mt-8 font-display text-2xl">Cambios y contacto</h2>
      <p className="mt-3 text-cacao">
        Estos términos pueden cambiar; avisaremos en el sitio cuando ocurra. Para
        cualquier duda escribe a{" "}
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
