import { MensajeListo } from "@/components/embajador/formularios";
import {
  COMISION_DE_EMBAJADOR,
  DESCUENTO_DE_EMBAJADOR,
  DIAS_GRATIS,
  MESES_DE_DESTACADO,
  MESES_PAGADOS_AL_ANIO,
} from "@/lib/precios";
import { pesos } from "@/lib/tipos";

/** Lo que cuesta el Pro al mes. La base lo tiene en `tiers` (000059). */
const PRECIO_PRO = 499;

const centavos = (n: number) => Math.round(n * 100) / 100;

/**
 * El kit de venta: todo lo que el vendedor necesita tener a mano frente a un
 * negocio. Precios con y sin su código, cuánto gana él, los pasos del alta, el
 * guion, las objeciones de siempre y los mensajes ya escritos.
 *
 * Los números salen de las mismas constantes que la pantalla de planes: si
 * cambia el precio o el descuento, el kit no se queda diciendo otro.
 */
export function KitDeVenta({
  codigo,
  codigoDestacado = null,
  sitio,
  demo,
}: {
  codigo: string;
  /** El segundo código: sin descuento, «Destacados» en la portada (000070). */
  codigoDestacado?: string | null;
  sitio: string;
  demo: string;
}) {
  const anual = PRECIO_PRO * MESES_PAGADOS_AL_ANIO;
  const conCodigoMes = centavos(PRECIO_PRO * (1 - DESCUENTO_DE_EMBAJADOR / 100));
  const conCodigoAnio = centavos(anual * (1 - DESCUENTO_DE_EMBAJADOR / 100));
  const comision = (monto: number) => centavos((monto * COMISION_DE_EMBAJADOR) / 100);

  const mensajes = [
    {
      titulo: "Primer contacto",
      texto: `¡Hola! Soy de la Guía del Cacao (${sitio}), el directorio de negocios de cacao y chocolate de México. Te armamos tu página con catálogo, reseñas, agenda de eventos y un QR para tu mostrador, para que te encuentren todo el año. Son ${DIAS_GRATIS} días gratis y con mi código ${codigo} tienes ${DESCUENTO_DE_EMBAJADOR}% de descuento en tu primer pago. ¿Te enseño en 5 minutos cómo se ve?`,
    },
    {
      titulo: "Para que vea un ejemplo",
      texto: `Así se ve un negocio en la Guía: ${demo}\nCatálogo con precios, WhatsApp, ubicación, reseñas y hasta una ruleta de premios para tus clientes. ¿Armamos la tuya?`,
    },
    {
      titulo: "Seguimiento (no contestó)",
      texto: `¡Hola de nuevo! Te escribo por lo de la Guía del Cacao. Empezar no cuesta nada: son ${DIAS_GRATIS} días gratis y sin tarjeta. Si me dices qué día te queda, paso y te la dejo lista en 15 minutos.`,
    },
    {
      titulo: "Antes de que acabe su prueba",
      texto: `¡Hola! Tu página en la Guía del Cacao termina su prueba en unos días. Para que siga visible, entra a tu panel → Plan y paga el Pro: ${pesos(PRECIO_PRO)} al mes o ${pesos(anual)} al año (dos meses gratis), IVA incluido. Con mi código ${codigo} tu primer pago queda en ${pesos(conCodigoMes)}. Si necesitas factura, también se puede.`,
    },
    ...(codigoDestacado
      ? [
          {
            titulo: "Con el código destacado",
            texto: `¡Hola! Soy de la Guía del Cacao (${sitio}). Te armamos tu página con catálogo, reseñas y un QR para tu mostrador. Son ${DIAS_GRATIS} días gratis, y si la publicas con mi código ${codigoDestacado} tu negocio sale en Destacados, en la portada de la Guía, durante ${MESES_DE_DESTACADO} meses. ¿Te enseño cómo se ve?`,
          },
        ]
      : []),
  ];

  return (
    <div className="grid gap-8">
      {codigoDestacado && (
        <section className="grid gap-4">
          <h3 className="font-display text-2xl">¿Descuento o destacado?</h3>
          <p className="rounded-3xl border border-mango/30 bg-white p-5">
            Tienes dos códigos y a cada negocio le das <strong>uno</strong>. Con{" "}
            <strong className="font-mono">{codigo}</strong> ahorra {DESCUENTO_DE_EMBAJADOR}% en su
            primer pago; con <strong className="font-mono">{codigoDestacado}</strong> paga el
            precio normal pero sale en <strong>Destacados</strong> de la portada{" "}
            {MESES_DE_DESTACADO} meses. Tú ganas tu {COMISION_DE_EMBAJADOR}% con los dos. El
            descuento convence a quien cuida el precio; el destacado, a quien quiere que lo
            vean.
          </p>
        </section>
      )}

      <section className="grid gap-4">
        <h3 className="font-display text-2xl">La oferta, en una frase</h3>
        <p className="rounded-3xl border border-mango/30 bg-white p-5 text-lg">
          «Tu negocio en la Guía del Cacao: página propia con catálogo, reseñas,
          agenda, ruleta de premios y realidad aumentada. {DIAS_GRATIS} días
          gratis, y luego {pesos(PRECIO_PRO)} al mes.»
        </p>
      </section>

      <section className="grid gap-4">
        <h3 className="font-display text-2xl">Precios (IVA incluido)</h3>
        <div className="overflow-x-auto rounded-3xl border-2 border-ink/10 bg-white">
          <table className="w-full min-w-[30rem] text-left">
            <thead className="text-sm uppercase tracking-wider text-cacao/70">
              <tr>
                <th className="p-4">Plan</th>
                <th className="p-4">Precio</th>
                <th className="p-4">Primer pago con {codigo}</th>
                <th className="p-4">Tú ganas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/10">
              <tr>
                <td className="p-4 font-bold">Gratis</td>
                <td className="p-4">{DIAS_GRATIS} días, sin tarjeta</td>
                <td className="p-4">—</td>
                <td className="p-4 text-cacao/70">Tu código ya queda ligado</td>
              </tr>
              <tr>
                <td className="p-4 font-bold">Pro mensual</td>
                <td className="p-4">{pesos(PRECIO_PRO)} /mes</td>
                <td className="p-4">{pesos(conCodigoMes)}</td>
                <td className="p-4 font-bold text-mango">
                  {pesos(comision(conCodigoMes))} y luego {pesos(comision(PRECIO_PRO))} cada mes
                </td>
              </tr>
              <tr>
                <td className="p-4 font-bold">Pro anual</td>
                <td className="p-4">{pesos(anual)} /año · 2 meses gratis</td>
                <td className="p-4">{pesos(conCodigoAnio)}</td>
                <td className="p-4 font-bold text-mango">{pesos(comision(conCodigoAnio))}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-sm text-crema/70">
          El precio es por sucursal. Si piden factura: se la mandamos; que
          la pidan desde su panel (Mi cuenta → Tu plan → «Pedir factura») con su constancia de
          situación fiscal.
        </p>
      </section>

      <section className="grid gap-4">
        <h3 className="font-display text-2xl">Qué incluye el Pro</h3>
        <ul className="grid gap-2 sm:grid-cols-2">
          {[
            "Su página propia: logo, fotos, ubicación, WhatsApp y redes",
            "Catálogo con fotos y precios, que se descarga en PDF",
            "Reseñas y estrellas de sus clientes",
            "Sus catas, talleres y eventos en la agenda",
            "El banner de la portada",
            "La Ruleta Mágica: premios para que sus clientes vuelvan",
            "3 experiencias de realidad aumentada (powered by Vórtice VR)",
            "Tarjetón con QR para su mostrador, listo para imprimir",
            "Sus números: cuántos lo vieron y le escribieron",
          ].map((cosa) => (
            <li key={cosa} className="rounded-2xl border-2 border-ink/10 bg-white px-4 py-3">
              ✓ {cosa}
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-4">
        <h3 className="font-display text-2xl">Cómo darlo de alta, en su celular</h3>
        <ol className="grid gap-3">
          {[
            ["Entra a la Guía", `En ${sitio}, toca «Agregar mi negocio» y crea la cuenta como negocio, con su correo.`],
            ["Confirma el correo", "Le llega un enlace: ábrelo ahí mismo para que su cuenta quede lista."],
            ["Arma su página", "Logo, una foto de portada, qué hace, su WhatsApp y al menos un producto con precio."],
            ["Publica con tu código", `Al publicar pregunta «¿Tienes un código?»: escribe ${codigo}. Aunque empiece con los ${DIAS_GRATIS} días gratis, tu código ya queda ligado.`],
            ["Imprime su tarjetón", "En su panel, «Tarjetón con QR». Que lo ponga en el mostrador."],
          ].map(([titulo, texto], i) => (
            <li key={titulo} className="flex gap-4 rounded-3xl border-2 border-ink/10 bg-white p-5">
              <span className="font-display text-3xl text-mango">{i + 1}</span>
              <span>
                <strong className="block font-display text-lg">{titulo}</strong>
                <span className="text-cacao">{texto}</span>
              </span>
            </li>
          ))}
        </ol>
        <p className="text-sm text-crema/70">
          La regla: no te vayas sin su página publicada. Un negocio que ve su
          página bonita paga; uno con la página vacía, no.
        </p>
      </section>

      <section className="grid gap-4">
        <h3 className="font-display text-2xl">El guion de 30 segundos</h3>
        <p className="rounded-3xl border-2 border-ink/10 bg-white p-5">
          «Hola, soy de la Guía del Cacao, el directorio de negocios de cacao y
          chocolate. Te armamos tu página con catálogo, reseñas y un QR para tu
          mostrador; la gente que busca chocolate te encuentra todo el año. Son{" "}
          {DIAS_GRATIS} días gratis y te la dejo lista ahorita. ¿Te enseño cómo
          se ve? Mira, este es un ejemplo…» <em>(y abres la demo)</em>
        </p>
        <p>
          <a href={demo} target="_blank" rel="noreferrer" className="font-bold text-mango underline">
            Abrir el negocio de demostración →
          </a>
        </p>
      </section>

      <section className="grid gap-4">
        <h3 className="font-display text-2xl">Cuando te dicen…</h3>
        <dl className="grid gap-3">
          {[
            ["«Está caro»", `Son ${pesos(Math.round(PRECIO_PRO / 30))} al día, menos que un café. Pagando el año salen dos meses gratis, y con mi código el primer pago baja a ${pesos(conCodigoMes)}. Y los primeros ${DIAS_GRATIS} días no cuestan nada.`],
            ["«Ya tengo Facebook»", "Facebook lo ve quien ya te sigue. La Guía la ve quien está buscando chocolate y no te conoce. Además tienes catálogo con precios, reseñas y tu QR."],
            ["«No sé de tecnología»", "Por eso vengo: te la armo ahorita en tu celular, tú solo me das las fotos."],
            ["«Déjame pensarlo»", `Empieza con los ${DIAS_GRATIS} días gratis, sin tarjeta. Si no te convence, no pagas y no pasa nada.`],
            ["«¿Me dan factura?»", "Sí. Los precios ya traen IVA; pides la factura desde tu panel con tu constancia de situación fiscal."],
            ["«¿Y si dejo de pagar?»", "Tu página se oculta, pero no se borra nada. Pagas y vuelve tal cual."],
          ].map(([pregunta, respuesta]) => (
            <div key={pregunta} className="rounded-3xl border-2 border-ink/10 bg-white p-5">
              <dt className="font-display text-lg font-semibold">{pregunta}</dt>
              <dd className="mt-1 text-cacao">{respuesta}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="grid gap-4">
        <h3 className="font-display text-2xl">Mensajes listos</h3>
        <div className="grid gap-3 lg:grid-cols-2">
          {mensajes.map((m) => (
            <MensajeListo key={m.titulo} titulo={m.titulo} texto={m.texto} />
          ))}
        </div>
      </section>
    </div>
  );
}
