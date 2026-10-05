"use client";

import { EditarFotos } from "@/components/publico/editar-fotos";
import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import {
  Area,
  Aviso,
  BotonEnviar,
  Campo,
  CampoFoto,
  Casilla,
  Selector,
} from "@/components/formulario";
import {
  agregarAGaleria,
  cambiarFotoPublicacion,
  crearEvento,
  editarEvento,
  crearNoticia,
  crearSucursal,
  eliminarPublicacion,
  guardarMicrositio,
  publicarSucursal,
  subirImagen,
  consultarCodigo,
  type EstadoAccion,
} from "@/lib/negocio/acciones";
import { type Sucursal, type Tier } from "@/lib/tipos";
import {
  DESCUENTO_ANUAL,
  fechaDeOferta,
  precioDe,
  textoDePrecio,
  type Oferta,
  type Periodo,
} from "@/lib/precios";
import { cancelarPlan, contratarPlan } from "@/lib/negocio/plan";
import { ENTIDADES } from "@/lib/entidades";
import { FUNCIONES } from "@/lib/funciones";
import { LIMITES } from "@/lib/limites";
import { REDES } from "@/lib/redes";
import { MEDIDAS, PROPORCIONES } from "@/lib/imagenes";

const INICIAL: EstadoAccion = {};

function Resultado({ estado }: { estado: EstadoAccion }) {
  if (estado.error) return <Aviso>{estado.error}</Aviso>;
  if (estado.ok) {
    return (
      <p
        role="status"
        className="rounded-2xl border-2 border-lima/50 bg-lima/15 px-4 py-3 font-bold text-selva-2"
      >
        {estado.ok}
      </p>
    );
  }
  return null;
}

export function FormularioNuevaSucursal() {
  const [estado, accion] = useActionState(crearSucursal, INICIAL);

  return (
    <form action={accion} className="grid gap-4">
      <Resultado estado={estado} />
      <Campo
        nombre="nombre_sucursal"
        etiqueta="Nombre de la sucursal"
        ayuda="Por ejemplo: Matriz Villahermosa, o Sucursal Comalcalco."
      />
      {/*
        La base exige la entidad desde el alta (migración 000035): sin ella el
        insert choca con el not null y solo se veía «No se pudo crear».
      */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Selector
          nombre="entidad"
          etiqueta="Estado"
          opciones={ENTIDADES.map((nombre) => ({ valor: nombre, texto: nombre }))}
        />
        <Campo
          nombre="ciudad"
          etiqueta="Ciudad o municipio"
          requerido={false}
          marcador="Comalcalco"
        />
      </div>
      <BotonEnviar>Crear sucursal</BotonEnviar>
    </form>
  );
}

export function FormularioMicrositio({
  sucursal,
  /**
   * Paso al que saltar después de guardar, durante el alta guiada. Sin esto el
   * botón solo guarda, que es lo que hace falta al editar una ficha ya hecha.
   */
  continuarA,
}: {
  sucursal: Sucursal;
  continuarA?: string;
}) {
  const [estado, accion] = useActionState(guardarMicrositio, INICIAL);

  return (
    <form action={accion} className="grid gap-4">
      <input type="hidden" name="sucursal_id" value={sucursal.id} />
      {continuarA && (
        <input type="hidden" name="continuar_a" value={continuarA} />
      )}
      <Resultado estado={estado} />

      <Campo
        nombre="nombre_sucursal"
        etiqueta="Nombre de la sucursal"
        valor={sucursal.nombre_sucursal}
      />
      <Area
        nombre="acerca_de"
        etiqueta="Acerca de"
        valor={sucursal.acerca_de}
        ayuda="Qué hacen, qué los distingue, desde cuándo."
        filas={5}
        limite={LIMITES.acercaDe}
      />
      {/*
        Dónde está. Desde que la guía es nacional esto no es un dato de
        contacto más: es por lo que filtra quien busca, y sin ello la ficha no
        aparece cuando alguien elige su estado.
      */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Selector
          nombre="entidad"
          etiqueta="Estado"
          valor={sucursal.entidad}
          opciones={ENTIDADES.map((nombre) => ({ valor: nombre, texto: nombre }))}
        />
        <Campo
          nombre="ciudad"
          etiqueta="Ciudad o municipio"
          requerido={false}
          valor={sucursal.ciudad}
          marcador="Comalcalco"
        />
      </div>

      <Campo
        nombre="ubicacion_maps_url"
        etiqueta="Ubicación"
        requerido={false}
        valor={sucursal.ubicacion_maps_url}
        marcador="https://maps.app.goo.gl/…"
        ayuda="Pega el enlace de Google Maps de este local."
      />

      <fieldset className="grid gap-4 rounded-3xl border-2 border-selva/15 p-5">
        <legend className="px-2 font-display text-lg font-semibold text-selva-2">
          Contacto y redes
        </legend>

        <p className="text-sm text-cacao">
          Lo que pongas aquí sale como botón en tu micrositio. En las redes basta
          tu usuario —<span className="font-mono">@lamazorca</span>—; si prefieres,
          pega el enlace completo de tu página.
        </p>

        <Campo
          nombre="telefono"
          etiqueta="Teléfono"
          tipo="tel"
          requerido={false}
          valor={sucursal.telefono}
        />
        <Campo
          nombre="correo_contacto"
          etiqueta="Correo de contacto"
          tipo="email"
          requerido={false}
          valor={sucursal.correo_contacto}
        />

        {/*
          Las redes salen de `REDES`, la misma lista con la que el micrositio
          arma los enlaces: si algún día se agrega una, se agrega en un sitio.

          Y cada una lleva su marcador, que es lo que faltaba. Eran cinco campos
          vacíos titulados "Instagram", y cada negocio adivinaba: unos ponían la
          dirección completa, otros el usuario y otros el nombre de su página
          con espacios. Ahora se ve qué se espera, y `enlaceDeRed` aguanta las
          otras formas de escribirlo.
        */}
        {REDES.map(({ campo, texto, marcador, ayuda }) => (
          <Campo
            key={campo}
            nombre={campo}
            etiqueta={texto}
            tipo={campo === "whatsapp" ? "tel" : "text"}
            requerido={false}
            valor={sucursal[campo]}
            marcador={marcador}
            ayuda={ayuda}
          />
        ))}
      </fieldset>

      {/*
        Va aquí, en el paso de datos y pegado al contacto, y no en el paso del
        catálogo: lo que se decide no es qué productos hay sino si tu lista de
        precios —con tu teléfono al pie— puede salir de la plataforma en un
        archivo. Esa es una decisión de contacto, no de inventario.
      */}
      <fieldset className="grid gap-4 rounded-3xl border-2 border-selva/15 p-5">
        <legend className="px-2 font-display text-lg font-semibold text-selva-2">
          Tu catálogo en PDF
        </legend>

        <Casilla
          nombre="catalogo_descargable"
          etiqueta="Deja que cualquiera baje tu catálogo"
          marcada={sucursal.catalogo_descargable}
          ayuda="Aparece un botón en tu micrositio que arma un PDF con tus productos, tus precios, tus datos de contacto y la fecha del día. Sirve para que te compartan por WhatsApp o te impriman en el mostrador. Desmárcala si prefieres que tu lista de precios no ande en un archivo suelto."
        />
      </fieldset>

      <BotonEnviar>
        {continuarA ? "Guardar y continuar" : "Guardar cambios"}
      </BotonEnviar>
    </form>
  );
}

export function FormularioImagen({
  sucursalId,
  campo,
  etiqueta,
  uso,
}: {
  sucursalId: string;
  campo: "logo" | "imagen_fondo";
  etiqueta: string;
  uso: string;
}) {
  const [estado, accion] = useActionState(subirImagen, INICIAL);
  const medida = campo === "logo" ? MEDIDAS.logo : MEDIDAS.fondo;

  return (
    <form action={accion} className="grid gap-3">
      <input type="hidden" name="sucursal_id" value={sucursalId} />
      <input type="hidden" name="campo" value={campo} />
      <Resultado estado={estado} />

      <CampoFoto
        nombre="archivo"
        etiqueta={etiqueta}
        proporcion={campo === "logo" ? PROPORCIONES.logo : PROPORCIONES.fondo}
        ayuda={`${uso} ${medida}`}
        autoEnviar
      />
    </form>
  );
}

/**
 * Elegir plan y mandar la sucursal a revisión.
 *
 * El plan se elige aquí y no en la cuenta porque desde la spec v2 el cobro es
 * por sucursal: dos locales de la misma marca pueden estar en planes distintos,
 * así que la pregunta solo tiene respuesta parada frente a una de ellas.
 *
 * No se pide tarjeta. Se abren quince días de prueba y ya.
 */
export function FormularioPublicar({
  sucursalId,
  tiers,
}: {
  sucursalId: string;
  tiers: Tier[];
}) {
  const [estado, accion] = useActionState(publicarSucursal, INICIAL);
  const [oferta, setOferta] = useState<Oferta | null>(null);
  const [periodo, setPeriodo] = useState<Periodo>("mensual");

  return (
    <form action={accion} className="grid gap-4">
      <input type="hidden" name="sucursal_id" value={sucursalId} />
      <input type="hidden" name="codigo_convenio" value={oferta?.codigo ?? ""} />
      <Resultado estado={estado} />

      {/*
        El código va arriba: cambia los precios de abajo, y quien lo trae llega
        buscándolo. Al aplicarlo, los planes enseñan ya el precio de la oferta,
        antes de contratar nada.
      */}
      <CodigoDeConvenio oferta={oferta} alCambiar={setOferta} />

      <ElegirPeriodo periodo={periodo} alCambiar={setPeriodo} />

      {/* `Planes` ya trae dentro el radio `tier_id` y el `periodo`. */}
      <Planes tiers={tiers} periodo={periodo} oferta={oferta} />

      <p className="rounded-2xl bg-crema-2 px-4 py-3 text-sm text-cacao">
        Pruebas tu plan quince días sin pagar y sin dejar tarjeta. Si al
        terminar no has pagado, tu micrositio sale del directorio, pero no se
        borra nada y vuelve en cuanto pagues.
      </p>

      <BotonEnviar>Publicar mi micrositio</BotonEnviar>
    </form>
  );
}

/**
 * «¿Tienes un código?»: se escribe, se aplica y aparece la oferta.
 *
 * Se consulta con su propio botón y no al enviar el formulario: la gracia es
 * ver los precios con descuento **antes** de elegir. El código que viaja al
 * publicar es el que quedó aplicado, y la base lo vuelve a revisar.
 */
function CodigoDeConvenio({
  oferta,
  alCambiar,
}: {
  oferta: Oferta | null;
  alCambiar: (oferta: Oferta | null) => void;
}) {
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [revisando, iniciar] = useTransition();

  function aplicar() {
    setError(null);
    iniciar(async () => {
      const respuesta = await consultarCodigo(codigo);
      if (respuesta.oferta) {
        alCambiar(respuesta.oferta);
      } else {
        setError(respuesta.error ?? "No se pudo revisar el código.");
      }
    });
  }

  if (oferta) {
    return (
      <div
        role="status"
        className="rounded-2xl border-2 border-lima/60 bg-lima/20 px-4 py-3 text-cacao"
      >
        <p className="font-bold text-selva-2">
          Código {oferta.codigo} aplicado
        </p>
        <p className="text-sm">{oferta.descripcion}</p>
        <ul className="mt-2 grid gap-0.5 text-sm">
          {oferta.basicoGratisHasta && (
            <li>
              ✓ Básico gratis hasta el {fechaDeOferta(oferta.basicoGratisHasta)}
            </li>
          )}
          {oferta.descuento > 0 && (
            <li>✓ {oferta.descuento}% de descuento en Plus y Premier</li>
          )}
        </ul>
        <button
          type="button"
          onClick={() => {
            alCambiar(null);
            setCodigo("");
          }}
          className="mt-2 text-sm font-bold text-selva underline"
        >
          Quitar el código
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border-2 border-dashed border-selva/25 p-4">
      <label htmlFor="codigo" className="mb-1.5 block font-bold text-selva-2">
        ¿Tienes un código?
      </label>
      <div className="flex gap-2">
        <input
          id="codigo"
          value={codigo}
          onChange={(evento) => setCodigo(evento.target.value)}
          onKeyDown={(evento) => {
            // Enter aquí aplica el código; publicaría el formulario entero.
            if (evento.key === "Enter") {
              evento.preventDefault();
              aplicar();
            }
          }}
          autoComplete="off"
          maxLength={40}
          placeholder="FESTIVALCHOCOLATE"
          aria-invalid={error ? true : undefined}
          className={`min-w-0 flex-1 rounded-2xl border-2 bg-white px-4 py-3 font-mono text-base uppercase text-ink ${error ? "border-guayaba focus:border-guayaba" : "border-selva/20 focus:border-selva"}`}
        />
        <button
          type="button"
          onClick={aplicar}
          disabled={revisando || !codigo.trim()}
          className="min-h-12 shrink-0 rounded-full bg-selva px-5 font-bold text-crema disabled:opacity-50"
        >
          {revisando ? "Revisando…" : "Aplicar"}
        </button>
      </div>
      <p className={`mt-1.5 text-sm ${error ? "font-bold text-guayaba" : "text-cacao/70"}`}>
        {error ?? "Si vienes por un convenio, como el del Festival del Chocolate, escríbelo aquí para ver tus precios."}
      </p>
    </div>
  );
}

/** Mensual o anual. El anual va con su descuento a la vista. */
function ElegirPeriodo({
  periodo,
  alCambiar,
}: {
  periodo: Periodo;
  alCambiar: (periodo: Periodo) => void;
}) {
  const opciones: { valor: Periodo; texto: string }[] = [
    { valor: "mensual", texto: "Pago mensual" },
    { valor: "anual", texto: `Pago anual · ${DESCUENTO_ANUAL}% menos` },
  ];

  return (
    <fieldset className="flex flex-wrap gap-2">
      <legend className="sr-only">Cómo quieres pagar</legend>
      {opciones.map((opcion) => (
        <label
          key={opcion.valor}
          className={`flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-full border-2 px-4 text-center text-sm font-bold ${
            periodo === opcion.valor
              ? "border-selva bg-selva text-crema"
              : "border-selva/20 bg-white text-selva-2"
          }`}
        >
          <input
            type="radio"
            name="periodo_vista"
            value={opcion.valor}
            checked={periodo === opcion.valor}
            onChange={() => alCambiar(opcion.valor)}
            className="sr-only"
          />
          {opcion.texto}
        </label>
      ))}
    </fieldset>
  );
}

export function FormularioGaleria({ sucursalId }: { sucursalId: string }) {
  const [estado, accion] = useActionState(agregarAGaleria, INICIAL);

  return (
    <form action={accion} className="grid gap-3">
      <input type="hidden" name="sucursal_id" value={sucursalId} />
      <Resultado estado={estado} />

      <CampoFoto
        nombre="archivo"
        etiqueta="Agregar fotos"
        proporcion={PROPORCIONES.galeria}
        varias
        autoEnviar
        ayuda={`Puedes elegir varias de una vez. Hasta 8 en total, en el orden en que las subes. ${MEDIDAS.galeria}`}
      />
    </form>
  );
}

export function FormularioEvento({ sucursales }: { sucursales: Sucursal[] }) {
  const [estado, accion] = useActionState(crearEvento, INICIAL);

  return (
    <form action={accion} className="grid gap-4">
      <Resultado estado={estado} />

      <Selector
        nombre="sucursal_id"
        etiqueta="Sucursal que publica"
        opciones={sucursales.map((s) => ({
          valor: s.id,
          texto: s.nombre_sucursal,
        }))}
      />

      <Campo nombre="titulo" etiqueta="Título" />
      <Campo nombre="subtitulo" etiqueta="Subtítulo" requerido={false} />
      <Area
        nombre="contenido"
        etiqueta="Contenido"
        ayuda="Hasta 1500 caracteres."
        filas={5}
      />

      <CampoFoto
        nombre="imagen"
        etiqueta={
          <>
            Foto <span className="font-normal text-cacao/70">(opcional)</span>
          </>
        }
        proporcion={PROPORCIONES.publicacion}
        ayuda={MEDIDAS.publicacion}
      />
      <Campo
        nombre="fecha_evento"
        etiqueta="Fecha del evento"
        tipo="datetime-local"
      />
      {/*
        Ya no se pregunta si el evento es exclusivo de algún rango. Los rangos
        del cliente salieron del producto con las mazorcas (spec v2), y sin
        ellos esa opción solo servía para dejar un evento invisible para todos.
      */}

      <BotonEnviar>Publicar evento</BotonEnviar>
    </form>
  );
}

export function FormularioNoticia({ sucursales }: { sucursales: Sucursal[] }) {
  const [estado, accion] = useActionState(crearNoticia, INICIAL);

  return (
    <form action={accion} className="grid gap-4">
      <Resultado estado={estado} />

      <Selector
        nombre="sucursal_id"
        etiqueta="Sucursal que publica"
        opciones={sucursales.map((s) => ({
          valor: s.id,
          texto: s.nombre_sucursal,
        }))}
      />

      <Campo nombre="titulo" etiqueta="Título" />
      <Campo nombre="subtitulo" etiqueta="Subtítulo" requerido={false} />
      <Area
        nombre="contenido"
        etiqueta="Contenido"
        ayuda="Hasta 1500 caracteres."
        filas={5}
      />

      <CampoFoto
        nombre="imagen"
        etiqueta={
          <>
            Foto <span className="font-normal text-cacao/70">(opcional)</span>
          </>
        }
        proporcion={PROPORCIONES.publicacion}
        ayuda={MEDIDAS.publicacion}
      />

      <BotonEnviar>Publicar noticia</BotonEnviar>
    </form>
  );
}

/**
 * Una publicación ya hecha, con lo que se puede hacerle: cambiar la foto o
 * borrarla.
 *
 * Hasta ahora los eventos y las noticias solo se podían crear. Quien publicó
 * antes de que existiera el campo de foto no tenía forma de agregarle una, y
 * quien se equivocó en el título no tenía forma de deshacerlo.
 */
export function PublicacionPropia({
  publicacion,
  clase,
  foto,
  editable = true,
}: {
  publicacion: {
    id: string;
    titulo: string;
    fecha: string;
    sucursal: string;
    paso?: boolean;
  };
  clase: "evento" | "noticia";
  /** URL de la portada, ya armada por el servidor. */
  foto: string | null;
  /**
   * Si el plan de la marca deja tocarla.
   *
   * Cambiar la foto es una edición y la base la rechaza sin plan, así que el
   * formulario no se pinta. Eliminar sí se queda: son sus publicaciones y
   * cobrarle por poder tirar algo que ya no se ve sería cobrarle por limpiar.
   */
  editable?: boolean;
}) {
  const [estado, accion] = useActionState(cambiarFotoPublicacion, INICIAL);

  return (
    <li className="grid gap-3 rounded-2xl border-2 border-selva/15 bg-white p-4">
      <div className="flex items-start gap-4">
        {foto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={foto}
            alt=""
            className="size-16 shrink-0 rounded-xl border-2 border-selva/10 object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="grid size-16 shrink-0 place-items-center rounded-xl border-2 border-dashed border-selva/25 text-xs text-cacao/50"
          >
            Sin foto
          </span>
        )}

        <div className="min-w-0 flex-1">
          <p className="font-bold text-selva-2">{publicacion.titulo}</p>
          <p className="font-mono text-xs text-cacao/70">
            {new Date(publicacion.fecha).toLocaleDateString("es-MX", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
            {publicacion.sucursal && ` · ${publicacion.sucursal}`}
          </p>

          {publicacion.paso && (
            <p className="mt-1 text-xs text-cacao/70">
              Ya pasó: dejó de salir en tu micrositio, pero sigue en la sección
              de eventos.
            </p>
          )}
        </div>
      </div>

      {editable && <Resultado estado={estado} />}

      {editable && (
        <form action={accion} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="clase" value={clase} />
          <input type="hidden" name="publicacion_id" value={publicacion.id} />

          <CampoFoto
            nombre="imagen"
            proporcion={PROPORCIONES.publicacion}
            peso={null}
            clase="min-w-0 flex-1"
          />

          <BotonEnviarChico>
            {foto ? "Cambiar foto" : "Subir foto"}
          </BotonEnviarChico>
        </form>
      )}

      <form action={eliminarPublicacion}>
        <input type="hidden" name="clase" value={clase} />
        <input type="hidden" name="publicacion_id" value={publicacion.id} />
        <button
          type="submit"
          className="min-h-11 rounded-full border-2 border-guayaba/50 px-4 text-sm font-bold text-cacao"
        >
          Eliminar
        </button>
      </form>
    </li>
  );
}

/** Botón de envío que cabe al lado de un campo, no debajo. */
function BotonEnviarChico({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-11 shrink-0 rounded-full bg-selva px-4 text-sm font-bold text-crema disabled:opacity-60"
    >
      {pending ? "Subiendo…" : children}
    </button>
  );
}

/**
 * Los planes, para elegir uno.
 *
 * Es el mismo listado que usa el alta y el cambio de plan: la diferencia entre
 * las dos pantallas es a qué acción apunta y qué dice el botón, no cómo se
 * pinta un plan. Duplicarlo garantizaba que un día uno enseñara una ventaja que
 * el otro no.
 */
/**
 * Los planes, uno a la vez.
 *
 * Antes se pintaban los tres apilados con todas sus ventajas: media pantalla
 * de lista para elegir entre tres cosas, y para comparar el primero con el
 * ultimo habia que desplazarse. Ahora la fila de arriba es el menu —nombre y
 * precio, que es con lo que se decide— y debajo se ve solo el elegido.
 *
 * El plan actual viene marcado y es el que abre. Quien entra a mirar no tiene
 * que buscar en cual esta.
 */
function Planes({
  tiers,
  actual,
  inicial,
  periodo = "mensual",
  oferta = null,
}: {
  tiers: Tier[];
  actual?: number;
  /** Cuál viene abierto. Sin él, el que ya se tiene. */
  inicial?: number;
  periodo?: Periodo;
  /** El convenio aplicado, si hay: cambia los precios que se enseñan. */
  oferta?: Oferta | null;
}) {
  const [elegido, setElegido] = useState(inicial ?? actual ?? tiers[0]?.id);
  const tier = tiers.find((t) => t.id === elegido) ?? tiers[0];

  if (!tier) return null;

  const precio = precioDe(tier, tiers, periodo, oferta);

  /*
    Ya no se anuncia un tope de sucursales: desde la spec v2 el cobro es por
    sucursal y no hay tope. "Hasta 20 sucursales" en un plan que se paga por
    cada una prometía un permiso que no es del plan.
  */
  const ventajas = [
    {
      hay: true,
      texto: "Tu micrositio en el directorio, con catálogo y contacto",
    },
    {
      hay: tier.permite_resenas,
      texto: "Recibe reseñas de tus clientes y respóndeles",
    },
    // Las mazorcas están apagadas: anunciarlas como ventaja de un plan sería
    // cobrar por algo que nadie puede usar todavía.
    ...(FUNCIONES.mazorcas
      ? [
          {
            hay: tier.puede_dar_puntos,
            texto: "Da mazorcas de cacao a tus clientes",
          },
        ]
      : []),
    {
      hay: tier.puede_publicar_contenido,
      texto: "Anuncia tus catas, talleres y ferias en la agenda",
    },
    {
      hay: tier.en_banner_principal,
      texto: "Aparece en el banner de la portada",
    },
  ];

  return (
    <fieldset className="grid gap-4">
      <legend className="sr-only">Elige un plan</legend>
      <input type="hidden" name="periodo" value={periodo} />

      {/*
        El radio va oculto pero sigue ahi: es lo que viaja en el formulario y lo
        que hace que las flechas del teclado recorran los planes. La fila de
        botones es su etiqueta, no un sustituto.
      */}
      <div className="flex flex-wrap gap-2">
        {tiers.map((opcion) => {
          const suyo = precioDe(opcion, tiers, periodo, oferta);

          return (
            <label
              key={opcion.id}
              className={`flex min-h-12 flex-1 cursor-pointer flex-col justify-center rounded-2xl border-2 px-4 py-2 text-center transition-colors ${
                opcion.id === elegido
                  ? "border-selva bg-selva text-crema"
                  : "border-selva/20 bg-white text-selva-2 hover:border-selva/50"
              }`}
            >
              <input
                type="radio"
                name="tier_id"
                value={opcion.id}
                checked={opcion.id === elegido}
                onChange={() => setElegido(opcion.id)}
                className="sr-only"
              />
              <span className="font-display font-semibold">{opcion.nombre}</span>
              <span
                className={`font-mono text-xs ${
                  opcion.id === elegido ? "text-crema/80" : "text-cacao/70"
                }`}
              >
                {textoDePrecio(suyo.cobro, suyo.periodo)}
              </span>
            </label>
          );
        })}
      </div>

      <div className="rounded-3xl border-2 border-ink/10 bg-white p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className="font-display text-xl font-semibold text-selva-2">
            {tier.nombre}
            {tier.id === actual && (
              <span className="ml-2 rounded-full bg-lima/40 px-2.5 py-0.5 align-middle font-mono text-xs font-bold text-selva-2">
                Tu plan
              </span>
            )}
          </p>
          <p className="text-right font-mono text-lg font-bold text-selva">
            {precio.antes !== null && (
              <span className="mr-2 text-sm font-normal text-cacao/60 line-through">
                {textoDePrecio(precio.antes, precio.periodo)}
              </span>
            )}
            {textoDePrecio(precio.cobro, precio.periodo)}
          </p>
        </div>

        {/* Lo que el precio solo no dice: hasta cuándo, o cuánto es al mes. */}
        {precio.gratisHasta ? (
          <p className="mt-1 text-sm text-cacao/80">
            Gratis hasta el {fechaDeOferta(precio.gratisHasta)}. Después, $99 al
            mes para seguir en el directorio.
          </p>
        ) : precio.periodo === "anual" && precio.cobro > 0 ? (
          <p className="mt-1 text-sm text-cacao/80">
            Equivale a {textoDePrecio(Math.round(precio.cobro / 12), "mensual")}, en
            un solo pago al año.
          </p>
        ) : null}

        <ul className="mt-3 grid gap-1 text-cacao">
          {ventajas.map((ventaja) => (
            <li
              key={ventaja.texto}
              className={ventaja.hay ? "" : "text-cacao/50"}
            >
              {ventaja.hay ? "✓" : "—"} {ventaja.texto}
            </li>
          ))}
        </ul>
      </div>
    </fieldset>
  );
}

export function FormularioCambiarPlan({
  tiers,
  tierActual,
  preseleccion,
  oferta = null,
}: {
  tiers: Tier[];
  tierActual?: number;
  /**
   * Con cuál abrir. Llegando desde "cámbiate a Premier" es Premier: quien tocó
   * ese anuncio ya eligió, y hacerle elegir otra vez desde su plan actual es
   * pedirle la misma decisión dos veces.
   */
  preseleccion?: number;
  /** El convenio con el que entró, para enseñar sus precios. */
  oferta?: Oferta | null;
}) {
  const [estado, accion] = useActionState(contratarPlan, INICIAL);
  const [periodo, setPeriodo] = useState<Periodo>("mensual");

  return (
    <form action={accion} className="grid gap-4">
      <Resultado estado={estado} />

      <ElegirPeriodo periodo={periodo} alCambiar={setPeriodo} />

      <Planes
        tiers={tiers}
        actual={tierActual}
        inicial={preseleccion}
        periodo={periodo}
        oferta={oferta}
      />

      <BotonEnviar>Cambiar de plan</BotonEnviar>
    </form>
  );
}

/**
 * Baja de la suscripción.
 *
 * La casilla no es un trámite: es lo que obliga a leer qué pasa después. Sin
 * ella el botón queda a un dedo de distancia de sacar el negocio del directorio
 * sin que nadie se entere de que eso era lo que hacía.
 */
export function FormularioCancelarSuscripcion() {
  const [estado, accion] = useActionState(cancelarPlan, INICIAL);

  return (
    <form action={accion} className="grid gap-4">
      <Resultado estado={estado} />

      <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-white p-4">
        <input
          type="checkbox"
          name="entendido"
          value="si"
          className="mt-0.5 size-5 shrink-0 accent-selva"
        />
        <span className="text-cacao">
          Entiendo que al cancelar{" "}
          <strong>dejo de aparecer en el directorio</strong> y que no se me
          volverá a cobrar. Mi micrositio vuelve a borrador con todo lo que
          armé, y puedo publicarlo otra vez cuando quiera.
        </span>
      </label>

      <BotonEnviar variante="secundario">Cancelar mi suscripción</BotonEnviar>
    </form>
  );
}
/**
 * Editar un evento ya publicado.
 *
 * No lleva la sucursal: mover un evento de local es crearlo en otro sitio, no
 * editarlo. Lo que sí cambia con el tiempo es el nombre, lo que se cuenta, la
 * fecha y la foto.
 */
export function FormularioEditarEvento({
  evento,
  fotos = [],
  urlDeFoto = {},
}: {
  evento: {
    id: string;
    titulo: string;
    subtitulo?: string | null;
    contenido?: string;
    fechaEvento?: string;
  };
  /** Las rutas que ya tiene, para poder quitarlas una por una. */
  fotos?: string[];
  urlDeFoto?: Record<string, string>;
}) {
  const [estado, accion] = useActionState(editarEvento, INICIAL);

  // El input de fecha y hora quiere `2026-09-07T18:00`, sin zona ni segundos.
  const fecha = evento.fechaEvento
    ? new Date(evento.fechaEvento).toISOString().slice(0, 16)
    : "";

  return (
    <form action={accion} className="grid gap-4">
      <input type="hidden" name="evento_id" value={evento.id} />
      <Resultado estado={estado} />

      <Campo
        nombre="titulo"
        etiqueta="Nombre del evento"
        valor={evento.titulo}
      />
      <Campo
        nombre="subtitulo"
        etiqueta="Subtítulo"
        requerido={false}
        valor={evento.subtitulo}
      />
      <Area
        nombre="contenido"
        etiqueta="Descripción"
        valor={evento.contenido}
        ayuda="Hasta 1500 caracteres."
        filas={5}
      />
      <Campo
        nombre="fecha_evento"
        etiqueta="Fecha del evento"
        tipo="datetime-local"
        valor={fecha}
      />

      {/*
        Las fotos se editan como en la comunidad: se quitan una por una y se
        suman otras. Antes solo se podía reemplazar la portada, así que para
        tirar una foto había que subir otra encima.
      */}
      <EditarFotos actuales={fotos} urlDe={urlDeFoto} obligatoria={false} />

      <BotonEnviar>Guardar cambios</BotonEnviar>
    </form>
  );
}
