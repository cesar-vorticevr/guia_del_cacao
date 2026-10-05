import type { numerosDeSucursales } from "@/lib/datos/actividad";

const NUMERO = new Intl.NumberFormat("es-MX");

/**
 * Lo que la guía le trajo al negocio en los últimos treinta días.
 *
 * Va arriba del panel y no en una pestaña aparte: es la respuesta a «¿para qué
 * estoy aquí?», y la que hace que un negocio decida seguir pagando o subir de plan. Los
 * contactos van primero y grandes porque son los que se traducen en ventas;
 * las visitas solas dicen que alguien miró.
 */
export function TusNumeros({
  numeros,
}: {
  numeros: Awaited<ReturnType<typeof numerosDeSucursales>>;
}) {
  const { conteo, contactos, favoritos } = numeros;

  const detalle = [
    { cifra: conteo.vista_micrositio, texto: "visitas a tu página" },
    { cifra: conteo.whatsapp, texto: "por WhatsApp" },
    { cifra: conteo.mapa, texto: "pidieron cómo llegar" },
    { cifra: (conteo.telefono ?? 0) + (conteo.correo ?? 0), texto: "por teléfono o correo" },
    { cifra: conteo.red, texto: "fueron a tus redes" },
    { cifra: conteo.compartir, texto: "te compartieron" },
    { cifra: conteo.catalogo_pdf, texto: "bajaron tu catálogo" },
    { cifra: favoritos, texto: "te guardaron en favoritos" },
  ];

  return (
    <section
      aria-labelledby="tus-numeros"
      className="rounded-3xl bg-selva p-6 text-crema"
    >
      <h2 id="tus-numeros" className="font-display text-xl font-semibold text-crema">
        Lo que te trajo la guía
      </h2>
      <p className="text-sm text-crema/80">Últimos 30 días</p>

      <p className="mt-4">
        <span className="font-mono text-5xl font-bold">
          {NUMERO.format(contactos)}
        </span>{" "}
        <span className="text-crema/90">
          {contactos === 1
            ? "persona quiso contactarte"
            : "personas quisieron contactarte"}
        </span>
      </p>

      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        {detalle.map((dato) => (
          <div key={dato.texto} className="flex flex-col-reverse">
            <dt className="text-sm text-crema/80">{dato.texto}</dt>
            <dd className="font-mono text-2xl font-bold">
              {NUMERO.format(dato.cifra ?? 0)}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
