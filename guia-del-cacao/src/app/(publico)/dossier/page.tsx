import Link from "next/link";
import type { Metadata } from "next";
import { EscudoDeMarca } from "@/components/marca";
import { Marcador } from "@/components/publico/marcador";
import { AccionesDelDossier } from "@/components/publico/acciones-del-dossier";
import { PoweredByVortice } from "@/components/experiencias/powered-by-vortice";
import { CORREO_DE_CONTACTO } from "@/components/publico/pie-de-pagina";
import { origenDelSitio } from "@/lib/auth/sesion";
import { listarDirectorio } from "@/lib/datos/publico";
import { tarjetaSocial } from "@/lib/compartir";
import { RESPONSABLE, DOMICILIO } from "@/lib/legal";
import {
  COMISION_DE_EMBAJADOR,
  DESCUENTO_DE_EMBAJADOR,
  DESCUENTO_MAXIMO_DE_VENDEDOR,
  DIAS_GRATIS,
  MESES_PAGADOS_AL_ANIO,
  PRECIO_PRO,
} from "@/lib/precios";
import { pesos } from "@/lib/tipos";

export const metadata: Metadata = tarjetaSocial({
  titulo: "Dossier",
  descripcion:
    "Qué es la Guía del Cacao, a quién sirve, cómo funciona y cuánto cuesta, en una sola página para compartir.",
  ruta: "/dossier",
});

/** Cuándo se revisó este texto. Se cambia a mano, como `ACTUALIZADO` de lo legal. */
const REVISADO = "31 de octubre de 2026";

/** El WhatsApp de quien atiende a aliados e inversionistas (el del dossier en PDF). */
const WHATSAPP = "529983448207";

/**
 * El dossier del proyecto, en el propio sitio: una página que se manda por
 * WhatsApp a quien sea —un negocio, una institución, un posible aliado— y se
 * entiende sin explicación. Reemplaza al PDF de `presentaciones/dossier`, que
 * se quedó con los planes y el convenio de antes.
 *
 * Reglas para tocarlo:
 * - **Se lee contra el código**, como las páginas legales. Precios, días de
 *   prueba y porcentajes salen de `lib/precios.ts`; los negocios y estados se
 *   cuentan en vivo. Si una función se apaga, se quita de aquí.
 * - **Frases cortas y una idea por tarjeta.** Quien lo abre en el celular
 *   decide en un minuto si sigue leyendo.
 * - Se imprime en hoja blanca (`.dossier` en los estilos de impresión de
 *   `globals.css`): «Guardar en PDF» es para quien lo quiere adjuntar.
 */
export default async function Dossier() {
  const [listado, origen] = await Promise.all([listarDirectorio(), origenDelSitio()]);
  const reales = listado.filter((s) => !s.marcas?.es_demo);
  const estados = new Set(reales.map((s) => s.entidad).filter(Boolean)).size;
  const url = `${origen}/dossier`;
  const anual = PRECIO_PRO * MESES_PAGADOS_AL_ANIO;

  return (
    <article className="dossier mx-auto grid max-w-5xl grid-cols-[minmax(0,1fr)] gap-16 py-10">
      {/* ---------------------------------------------------------------- portada */}
      <header className="grid justify-items-center gap-5 text-center">
        <EscudoDeMarca className="size-28 motion-safe:animate-flota drop-shadow-[0_0_30px_rgba(255,183,3,0.55)] sm:size-32" />
        <p className="antetitulo">Dossier del proyecto</p>
        <h1 className="max-w-3xl text-balance font-display text-4xl leading-[1.05] font-medium sm:text-6xl">
          El <em className="texto-oro pr-1">cacao</em> de México, en un solo lugar
        </h1>
        <p className="max-w-2xl text-pretty text-lg text-crema/80">
          Una plataforma donde la gente encuentra fincas, chocolaterías, museos y talleres de
          cacao, les compra directo y vive su historia. Y donde cada negocio tiene su página, sus
          pedidos y sus números, sin saber de tecnología.
        </p>

        {(reales.length > 0 || estados > 0) && (
          <dl className="flex flex-wrap justify-center gap-3">
            {[
              { valor: reales.length, texto: reales.length === 1 ? "negocio publicado" : "negocios publicados" },
              { valor: estados, texto: estados === 1 ? "estado" : "estados" },
              { valor: 32, texto: "estados donde se puede estar" },
            ].map((dato) => (
              <div
                key={dato.texto}
                className="flex min-w-36 flex-col-reverse rounded-2xl border border-mango/30 bg-white/5 px-4 py-3"
              >
                <dt className="text-xs font-bold tracking-wider text-crema/70 uppercase">{dato.texto}</dt>
                <dd className="font-display text-4xl font-bold text-mango">
                  <Marcador valor={dato.valor} />
                </dd>
              </div>
            ))}
          </dl>
        )}

        <AccionesDelDossier url={url} />
        <p className="text-sm text-crema/60">
          guiadelcacao.com · En funcionamiento · Revisado el {REVISADO}
        </p>
      </header>

      {/* ---------------------------------------------------------------- 1 */}
      <Seccion numero="01" antetitulo="En una frase" titulo="Una vitrina permanente para el cacao mexicano">
        <p className="max-w-3xl text-pretty text-lg text-crema/85">
          La Guía del Cacao reúne en un solo sitio a quienes siembran, transforman, venden y
          cuentan el cacao, en los 32 estados. Está hecha primero para el celular: se usa de pie en
          una feria, en la calle o antes de salir de viaje. Explorar es gratis y no pide registro.
        </p>
      </Seccion>

      {/* ---------------------------------------------------------------- 2 */}
      <Seccion numero="02" antetitulo="El problema" titulo="El cacao tiene historia, pero no tiene vitrina">
        <div className="grid gap-4 sm:grid-cols-3">
          <Cifra valor="63%" texto="no tiene página web propia: solo redes sociales, o nada." />
          <Cifra valor="63%" texto="no tiene punto de venta fijo: vende en ferias y por encargo." />
          <Cifra valor="68%" texto="lleva más de tres años operando. Hay oficio; falta que se vea." />
        </div>
        <p className="mt-5 max-w-3xl text-crema/80">
          Lo que más pidieron fue <strong className="text-mango">que los encuentren</strong>: 9 de
          19 negocios eligieron «aparecer en el directorio» como lo indispensable.
        </p>
        <p className="mt-2 text-sm text-crema/55">
          Fuente: encuesta propia a 19 negocios de cacao de Tabasco y sondeo a chocolateras,
          septiembre de 2026.
        </p>
      </Seccion>

      {/* ---------------------------------------------------------------- 3 */}
      <Seccion numero="03" antetitulo="Para quien visita" titulo="Encontrar, pedir y vivir el cacao">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Tarjeta icono="🧭" titulo="Encuentra">
            Por estado, por tipo de negocio o por lo que se te antoje: barra, cacao en polvo,
            molinillo.
          </Tarjeta>
          <Tarjeta icono="🛒" titulo="Pide directo">
            Arma tu pedido desde el catálogo, platica con el negocio y págale directo. Sin
            intermediarios.
          </Tarjeta>
          <Tarjeta icono="✉️" titulo="Platica">
            Un buzón para escribirle a cada negocio, con fotos, videos o PDF.
          </Tarjeta>
          <Tarjeta icono="🎡" titulo="Gira y gana">
            Muchos negocios tienen su Ruleta Mágica con premios de verdad que se canjean en tienda.
          </Tarjeta>
          <Tarjeta icono="✨" titulo="Mira cobrar vida">
            Carteles y empaques con realidad aumentada: se enfocan con el celular y aparecen videos.
          </Tarjeta>
          <Tarjeta icono="⭐" titulo="Opina">
            Estrellas y reseñas con foto o video. El negocio responde en público.
          </Tarjeta>
        </div>
      </Seccion>

      {/* ---------------------------------------------------------------- 4 */}
      <Seccion numero="04" antetitulo="Para el negocio" titulo="Su propia página, sus pedidos y sus números">
        <p className="mb-5 max-w-3xl text-crema/80">
          El dueño la arma desde el celular en una tarde. Para publicar basta con logo, una
          descripción y un producto.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Tarjeta icono="🏡" titulo="Micrositio">Su historia, fotos, ubicación y contacto con un toque.</Tarjeta>
          <Tarjeta icono="📦" titulo="Catálogo y pedidos">Productos con precio, descargable en PDF, y pedidos directos.</Tarjeta>
          <Tarjeta icono="📅" titulo="Eventos">Catas, talleres y ferias en la agenda de la guía.</Tarjeta>
          <Tarjeta icono="🎡" titulo="Ruleta Mágica">Premios para que la gente vuelva, con su código de canje.</Tarjeta>
          <Tarjeta icono="✨" titulo="Realidad aumentada">Su cartel o empaque cobra vida en el celular.</Tarjeta>
          <Tarjeta icono="🖨️" titulo="QR para el mostrador">Un tarjetón listo para imprimir que lleva a su página.</Tarjeta>
          <Tarjeta icono="✉️" titulo="Buzón">Conversaciones con clientes que no se pierden.</Tarjeta>
          <Tarjeta icono="📊" titulo="Sus números">Visitas, mensajes por WhatsApp, rutas al mapa y más.</Tarjeta>
        </div>
      </Seccion>

      {/* ---------------------------------------------------------------- 5 */}
      <Seccion numero="05" antetitulo="Cómo funciona un pedido" titulo="El dinero va directo al negocio">
        <ol className="grid gap-4 sm:grid-cols-4">
          {[
            ["Pide", "El cliente arma su pedido desde el catálogo. Todavía no paga."],
            ["Confirma", "El negocio confirma que lo tiene y fija el total, con envío si lleva."],
            ["Transfiere", "Solo entonces el cliente ve la cuenta y le transfiere directo."],
            ["Entrega", "El negocio marca pagado al ver el dinero, y entrega o envía."],
          ].map(([titulo, texto], i) => (
            <li key={titulo} className="rounded-3xl border border-mango/30 bg-white p-5">
              <span className="grid size-10 place-items-center rounded-full bg-mango font-display text-lg font-bold text-ink">
                {i + 1}
              </span>
              <strong className="mt-3 block font-display text-xl">{titulo}</strong>
              <span className="mt-1 block text-cacao">{texto}</span>
            </li>
          ))}
        </ol>
        <p className="mt-5 max-w-3xl text-crema/80">
          <strong className="text-mango">La guía no cobra comisión por venta</strong> ni toca el
          dinero. Todo queda escrito en la conversación, y cualquier abuso se reporta.
        </p>
      </Seccion>

      {/* ---------------------------------------------------------------- 6 */}
      <Seccion numero="06" antetitulo="Cuánto cuesta" titulo="Una membresía, por sucursal">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-3xl border border-mango/30 bg-white p-6">
            <p className="antetitulo">Promoción de entrada</p>
            <p className="mt-2 font-display text-5xl font-bold text-selva-2">1 mes gratis</p>
            <p className="mt-1 font-bold text-cacao">{DIAS_GRATIS} días con todo, sin tarjeta</p>
            <p className="mt-3 text-cacao">
              La membresía empieza gratis. Quien mete su tarjeta antes no pierde días: el primer cobro llega al acabar el mes, y el banner de estelares se le enciende desde ese momento. Si al
              terminar no se paga, la página se oculta —no se borra— y vuelve al pagar.
            </p>
          </div>
          <div className="rounded-3xl border-2 border-mango bg-white p-6 shadow-[0_0_40px_rgb(255_183_3/0.2)]">
            <p className="antetitulo">Membresía</p>
            <p className="mt-2 font-display text-5xl font-bold text-selva-2">
              {pesos(PRECIO_PRO)}
              <span className="text-lg font-medium text-cacao"> /mes</span>
            </p>
            <p className="mt-1 font-bold text-cacao">
              o {pesos(anual)} al año (dos meses gratis) · IVA incluido
            </p>
            <p className="mt-3 text-cacao">
              Directorio, micrositio, catálogo, pedidos, reseñas, eventos, Ruleta Mágica, realidad
              aumentada y sus números. Para quien visita, la guía es siempre gratis.
            </p>
          </div>
        </div>
        <p className="mt-4 text-sm text-crema/70">
          Cada sucursal tiene su plan. El pago es con tarjeta, por Stripe; la guía nunca ve la
          tarjeta.
        </p>
      </Seccion>

      {/* ---------------------------------------------------------------- 7 */}
      <Seccion numero="07" antetitulo="Para aliados" titulo="Instituciones, ferias y asesores">
        <div className="grid gap-4 sm:grid-cols-2">
          <Tarjeta icono="🏛️" titulo="Instituciones y ferias">
            Un padrón vivo de negocios del cacao, un canal para sus campañas y el reporte de
            visitas y contactos que generó cada negocio. Solo cifras: sin datos personales ni
            cookies de publicidad.
          </Tarjeta>
          <Tarjeta icono="🤝" titulo="Red de asesores">
            Asesores de ventas que suman negocios con su código: {DESCUENTO_DE_EMBAJADOR}% en el
            primer pago, o cupones propios de hasta {DESCUENTO_MAXIMO_DE_VENDEDOR}%. Ganan el{" "}
            {COMISION_DE_EMBAJADOR}% de cada pago del negocio que trajeron.
          </Tarjeta>
        </div>
      </Seccion>

      {/* ---------------------------------------------------------------- 8 */}
      <Seccion numero="08" antetitulo="Dónde va" titulo="Construida, publicada y lista para crecer">
        <ol className="grid gap-4 sm:grid-cols-3">
          <Etapa estado="Hecho" titulo="Plataforma en línea">
            Directorio, micrositios, pedidos, buzón, reseñas, eventos, ruleta, realidad aumentada,
            planes con cobro por tarjeta y métricas.
          </Etapa>
          <Etapa estado="Ahora" titulo="Tabasco y el Festival">
            Primeros negocios publicados y red de asesores sumando negocios de cacao.
          </Etapa>
          <Etapa estado="Siguiente" titulo="Todo México">
            Convocatoria en los demás estados cacaoteros: Chiapas, Oaxaca y Veracruz.
          </Etapa>
        </ol>
      </Seccion>

      {/* ---------------------------------------------------------------- contacto */}
      <section className="grid justify-items-center gap-5 rounded-[2.5rem] border border-mango/40 bg-white px-6 py-12 text-center shadow-[0_0_60px_rgb(255_183_3/0.15)]">
        <p className="antetitulo">Hablemos</p>
        <h2 className="max-w-2xl text-balance font-display text-3xl sm:text-4xl">
          Súmate a la <em className="texto-oro pr-1">Guía del Cacao</em>
        </h2>
        <p className="max-w-xl text-cacao">
          Para dar de alta tu negocio, alianzas con instituciones, ferias o inversión.
        </p>
        <div className="no-imprimir flex flex-wrap justify-center gap-3">
          <Link
            href="/soy-negocio"
            className="boton-oro brillo inline-flex min-h-12 items-center rounded-full px-6 font-display text-lg font-semibold text-ink"
          >
            Registrar mi negocio gratis
          </Link>
          <a
            href={`https://wa.me/${WHATSAPP}?text=${encodeURIComponent("Hola, vi el dossier de la Guía del Cacao y me interesa platicar.")}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-12 items-center rounded-full border-2 border-mango/50 px-6 font-bold text-selva-2 hover:border-mango hover:text-mango"
          >
            Escribir por WhatsApp
          </a>
          <Link
            href="/directorio"
            className="inline-flex min-h-12 items-center rounded-full px-6 font-bold text-selva-2 hover:text-mango"
          >
            Explorar la guía →
          </Link>
        </div>
        <p className="text-sm text-cacao/80">
          Mtro. César Adrián García Martínez · {RESPONSABLE} · {DOMICILIO}
          <br />
          <a href={`mailto:${CORREO_DE_CONTACTO}`} className="underline">
            {CORREO_DE_CONTACTO}
          </a>{" "}
          · WhatsApp 99 83 44 82 07 · guiadelcacao.com
        </p>
        <PoweredByVortice compacto />
      </section>
    </article>
  );
}

function Seccion({
  numero,
  antetitulo,
  titulo,
  children,
}: {
  numero: string;
  antetitulo: string;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="dossier-seccion grid gap-5">
      <div className="flex items-end gap-4">
        <span aria-hidden="true" className="font-display text-6xl leading-none font-bold text-mango/40">
          {numero}
        </span>
        <div>
          <p className="antetitulo">{antetitulo}</p>
          <h2 className="mt-1 text-balance font-display text-3xl sm:text-4xl">{titulo}</h2>
        </div>
      </div>
      <div>{children}</div>
    </section>
  );
}

function Tarjeta({ icono, titulo, children }: { icono: string; titulo: string; children: React.ReactNode }) {
  return (
    <div className="tarjeta-magica rounded-3xl border border-ink/10 bg-white p-5">
      <span aria-hidden="true" className="text-3xl">
        {icono}
      </span>
      <strong className="mt-2 block font-display text-xl text-selva-2">{titulo}</strong>
      <p className="mt-1 text-cacao">{children}</p>
    </div>
  );
}

function Cifra({ valor, texto }: { valor: string; texto: string }) {
  return (
    <div className="rounded-3xl border border-mango/30 bg-white p-5">
      <strong className="font-display text-5xl font-bold text-mango">{valor}</strong>
      <p className="mt-2 text-cacao">{texto}</p>
    </div>
  );
}

function Etapa({ estado, titulo, children }: { estado: string; titulo: string; children: React.ReactNode }) {
  return (
    <li className="rounded-3xl border border-ink/10 bg-white p-5">
      <span
        className={`rounded-full px-3 py-1 text-xs font-extrabold tracking-wide uppercase ${
          estado === "Hecho" ? "bg-lima/30 text-selva-2" : estado === "Ahora" ? "bg-mango text-ink" : "bg-ink/10 text-cacao"
        }`}
      >
        {estado}
      </span>
      <strong className="mt-3 block font-display text-xl text-selva-2">{titulo}</strong>
      <p className="mt-1 text-cacao">{children}</p>
    </li>
  );
}
