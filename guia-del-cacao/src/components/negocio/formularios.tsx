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
import { pesos, type Sucursal, type Tier } from "@/lib/tipos";
import {
  DIAS_GRATIS,
  esPlanGratis,
  fechaDeOferta,
  precioDe,
  promocionPara,
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
      <CodigoDeConvenio tiers={tiers} oferta={oferta} alCambiar={setOferta} />

      <ElegirPeriodo periodo={periodo} alCambiar={setPeriodo} />

      {/*
        `Planes` ya trae dentro el radio `tier_id` y el `periodo`. La `key`
        vuelve a elegir al aplicar un código: con la promoción, su plan.
      */}
      <Planes
        key={oferta?.codigo ?? "sin-codigo"}
        tiers={tiers}
        periodo={periodo}
        oferta={oferta}
      />

      <p className="rounded-2xl bg-crema-2 px-4 py-3 text-sm text-cacao">
        {oferta?.cubreHasta
          ? oferta.descuento >= 100
            ? `Con la promoción tienes ${nombreDelPlan(tiers, oferta.planId)} gratis hasta el ${fechaDeOferta(oferta.cubreHasta)}. Con otro plan, lo pruebas sin pagar como siempre.`
            : `Con la promoción pagas un mes de ${nombreDelPlan(tiers, oferta.planId)} al publicar y te cubre hasta el ${fechaDeOferta(oferta.cubreHasta)}. Con otro plan, lo pruebas sin pagar como siempre.`
          : `El plan ${nombreDelPlan(tiers, null)} dura ${DIAS_GRATIS} días. Los de pago los pruebas quince días sin pagar y sin dejar tarjeta.`}{" "}
        Si al terminar no has pagado, tu micrositio sale del directorio, pero no
        se borra nada y vuelve en cuanto pagues.
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
  tiers,
  oferta,
  alCambiar,
}: {
  tiers: Tier[];
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
          {oferta.embajador ? (
          <li>
            ✓ {oferta.descuento}% de descuento en tu primer pago. Los siguientes van
            al precio normal.
          </li>
        ) : oferta.cubreHasta ? (
            <>
              <li>
                {oferta.descuento >= 100 ? (
                  <>
                    ✓ {nombreDelPlan(tiers, oferta.planId)} gratis hasta el{" "}
                    {fechaDeOferta(oferta.cubreHasta)}
                  </>
                ) : (
                  <>
                    ✓ Un mes de {nombreDelPlan(tiers, oferta.planId)}
                    {oferta.descuento > 0 && ` con ${oferta.descuento}% de descuento`}, y
                    te cubre hasta el {fechaDeOferta(oferta.cubreHasta)}
                  </>
                )}
              </li>
              {oferta.quedan !== null && (
                <li className="font-bold">
                  {oferta.quedan === 1
                    ? "¡Queda 1 lugar con este código!"
                    : `Quedan ${oferta.quedan} lugares con este código`}
                </li>
              )}
            </>
          ) : (
            <>
              {oferta.basicoGratisHasta && (
                <li>
                  ✓ {nombreDelPlan(tiers, null)} hasta el{" "}
                  {fechaDeOferta(oferta.basicoGratisHasta)}
                </li>
              )}
              {oferta.descuento > 0 && (
                <li>✓ {oferta.descuento}% de descuento en los planes de pago</li>
              )}
            </>
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
          placeholder="TUCODIGO"
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
        {error ?? "Si te dieron un código de promoción o de un Embajador del Cacao, escríbelo aquí para ver tus precios."}
      </p>
    </div>
  );
}

/** El nombre de un plan; sin id, el del plan Gratis (el más barato). */
function nombreDelPlan(tiers: Tier[], id: number | null) {
  const tier =
    id === null
      ? [...tiers].sort((a, b) => a.precio_mensual - b.precio_mensual)[0]
      : tiers.find((t) => t.id === id);
  return tier?.nombre ?? "el plan";
}

/** Mensual o anual. El anual va con su descuento a la vista. */
function ElegirPeriodo({
  periodo,
  alCambiar,
}: {
  periodo: Periodo;
  alCambiar: (periodo: Periodo) => void;
}) {
  const opciones: { valor: Periodo; texto: string; extra?: string }[] = [
    { valor: "mensual", texto: "Mensual" },
    { valor: "anual", texto: "Anual", extra: "2 meses gratis" },
  ];

  return (
    <fieldset className="mx-auto flex w-fit gap-1 rounded-full border-2 border-selva/15 bg-white p-1 shadow-dura-sm">
      <legend className="sr-only">Cómo quieres pagar</legend>
      {opciones.map((opcion) => (
        <label
          key={opcion.valor}
          className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-full px-5 text-sm font-bold transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-mango ${
            periodo === opcion.valor
              ? "bg-selva text-crema"
              : "text-selva-2 hover:bg-selva/5"
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
          {opcion.extra && (
            <span
              className={`font-mono text-[0.7rem] ${periodo === opcion.valor ? "text-mango" : "text-selva"}`}
            >
              {opcion.extra}
            </span>
          )}
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
 * Los planes, lado a lado, para elegir uno.
 *
 * Es el mismo listado que usa el alta y el cambio de plan: la diferencia entre
 * las dos pantallas es a qué acción apunta y qué dice el botón, no cómo se
 * pinta un plan. Duplicarlo garantizaba que un día uno enseñara una ventaja que
 * el otro no.
 *
 * Se pintan como tarjetas que se comparan de un vistazo —nombre, precio grande
 * y lo que trae cada uno—, con el de arriba resaltado. Fue una fila de botones
 * con el elegido debajo; se veía ordenado pero no daba ganas de subir de plan,
 * y para comparar había que ir tocando uno por uno.
 *
 * Cada tarjeta es la etiqueta de un radio oculto: es lo que viaja en el
 * formulario y lo que hace que las flechas del teclado recorran los planes.
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
  /** Cuál viene elegido. Sin él, el que ya se tiene, o el de arriba. */
  inicial?: number;
  periodo?: Periodo;
  /** El convenio aplicado, si hay: cambia los precios que se enseñan. */
  oferta?: Oferta | null;
}) {
  // Los que ya no se ofrecen solo salen para quien todavía los paga.
  const ordenados = [...tiers]
    .filter((tier) => tier.se_ofrece || tier.id === actual)
    .sort((a, b) => a.precio_mensual - b.precio_mensual);
  const masAlto = ordenados[ordenados.length - 1];
  const conPromocion = ordenados.find((tier) => promocionPara(tier, oferta));

  const [elegido, setElegido] = useState(
    inicial ?? actual ?? conPromocion?.id ?? masAlto?.id,
  );

  if (ordenados.length === 0) return null;

  return (
    <fieldset className="grid gap-4">
      <legend className="sr-only">Elige un plan</legend>
      <input type="hidden" name="periodo" value={periodo} />

      <div
        className={`grid gap-4 pt-3 ${ordenados.length === 2 ? "mx-auto w-full max-w-3xl md:grid-cols-2" : "md:grid-cols-3"}`}
      >
        {ordenados.map((tier, lugar) => (
          <TarjetaDePlan
            key={tier.id}
            tier={tier}
            tiers={ordenados}
            lema={
              lugar === 0
                ? LEMAS[0]
                : lugar === ordenados.length - 1
                  ? LEMAS[LEMAS.length - 1]
                  : (LEMAS[lugar] ?? "")
            }
            periodo={periodo}
            oferta={oferta}
            elegido={tier.id === elegido}
            esActual={tier.id === actual}
            sello={
              tier.id === conPromocion?.id
                ? "Promoción de apertura"
                : !conPromocion && tier.id === masAlto?.id
                  ? "Todo incluido"
                  : null
            }
            alElegir={() => setElegido(tier.id)}
          />
        ))}
      </div>
    </fieldset>
  );
}

/** Para quién es cada plan, del más barato al más caro. */
const LEMAS = ["Para conocer la guía", "Para tu negocio", "Todo para tu negocio"];

function TarjetaDePlan({
  tier,
  tiers,
  lema,
  periodo,
  oferta,
  elegido,
  esActual,
  sello,
  alElegir,
}: {
  tier: Tier;
  tiers: Tier[];
  lema: string;
  periodo: Periodo;
  oferta: Oferta | null;
  elegido: boolean;
  esActual: boolean;
  /** La cinta de arriba: la promoción, o el plan más completo. */
  sello: string | null;
  alElegir: () => void;
}) {
  const precio = precioDe(tier, tiers, periodo, oferta);
  const gratis = esPlanGratis(tier, tiers);
  const resaltado = sello !== null;

  /*
    Ya no se anuncia un tope de sucursales: desde la spec v2 el cobro es por
    sucursal y no hay tope. "Hasta 20 sucursales" en un plan que se paga por
    cada una prometía un permiso que no es del plan.
  */
  const ventajas: { hay: boolean; texto: React.ReactNode }[] = [
    {
      hay: true,
      texto: (
        <>
          Tu <strong>micrositio</strong> en el directorio
        </>
      ),
    },
    {
      hay: true,
      texto: (
        <>
          <strong>Catálogo</strong> y botones de contacto
        </>
      ),
    },
    gratis
      ? {
          hay: true,
          texto: precio.gratisHasta ? (
            <>
              Activo hasta el <strong>{fechaDeOferta(precio.gratisHasta)}</strong>
            </>
          ) : (
            <>
              Activo <strong>{DIAS_GRATIS} días</strong>
            </>
          ),
        }
      : { hay: true, texto: "Sin vencimiento mientras pagues" },
    {
      hay: tier.permite_resenas,
      texto: (
        <>
          <strong>Reseñas</strong> de tus clientes, y les respondes
        </>
      ),
    },
    // Las mazorcas están apagadas: anunciarlas como ventaja de un plan sería
    // cobrar por algo que nadie puede usar todavía.
    ...(FUNCIONES.mazorcas
      ? [{ hay: tier.puede_dar_puntos, texto: "Da mazorcas de cacao a tus clientes" }]
      : []),
    {
      hay: tier.puede_publicar_contenido,
      texto: (
        <>
          Anuncia tus <strong>catas y talleres</strong> en la agenda
        </>
      ),
    },
    {
      hay: tier.en_banner_principal,
      texto: (
        <>
          En el <strong>banner de la portada</strong> y destacado en el directorio
        </>
      ),
    },
  ];

  // Lo que va debajo del precio: hasta cuándo, o qué es ese número.
  const nota = gratis
    ? "Sin tarjeta y sin pagar nada"
    : precio.soloPrimerPago
      ? `Tu primer pago, con el código de ${oferta?.embajador}. Después, ${textoDePrecio(precio.despues ?? 0, precio.periodo)}.`
      : precio.cubreHasta
      ? precio.cobro === 0
        ? `Gratis hasta el ${fechaDeOferta(precio.cubreHasta)}. Después, ${textoDePrecio(precio.despues ?? 0, precio.periodo)}.`
        : `Un solo pago: cubre hasta el ${fechaDeOferta(precio.cubreHasta)}. Después, ${textoDePrecio(precio.despues ?? 0, precio.periodo)}.`
      : precio.periodo === "anual"
        ? `Equivale a ${textoDePrecio(Math.round(precio.cobro / 12), "mensual")}, en un pago al año`
        : "Al mes, por micrositio";

  return (
    <label
      className={`relative flex cursor-pointer flex-col rounded-[1.75rem] border-2 p-5 transition-all has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-mango ${
        elegido
          ? resaltado
            ? "border-mango bg-selva-2 text-crema shadow-[0_0_0_4px_rgb(255_183_3/0.25),0_7px_0_0_rgb(12_82_54/0.25)] md:-translate-y-2"
            : "border-selva bg-white shadow-dura-alta md:-translate-y-2"
          : resaltado
            ? "border-mango/70 bg-selva-2 text-crema shadow-dura hover:-translate-y-1"
            : "border-selva/15 bg-white shadow-dura-sm hover:-translate-y-1 hover:border-selva/40"
      }`}
    >
      <input
        type="radio"
        name="tier_id"
        value={tier.id}
        checked={elegido}
        onChange={alElegir}
        className="sr-only"
      />

      {sello && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-mango px-3 py-1 font-mono text-[0.7rem] font-bold uppercase tracking-wide text-ink shadow-dura-sm">
          {sello}
        </span>
      )}

      <span className="flex items-center justify-between gap-2">
        <span
          className={`font-display text-2xl font-semibold ${resaltado ? "text-crema" : "text-selva-2"}`}
        >
          {tier.nombre}
        </span>
        {esActual && (
          <span className="rounded-full bg-lima px-2.5 py-0.5 font-mono text-xs font-bold text-selva-2">
            Tu plan
          </span>
        )}
      </span>
      <span className={`text-sm ${resaltado ? "text-crema/75" : "text-cacao/70"}`}>
        {lema}
      </span>

      <span className="mt-4 flex flex-wrap items-baseline gap-x-2">
        {precio.antes !== null && (
          <span
            className={`font-mono text-base line-through ${resaltado ? "text-crema/50" : "text-cacao/50"}`}
          >
            {pesos(precio.antes)}
          </span>
        )}
        <span
          className={`font-display text-5xl font-bold leading-none ${resaltado ? "text-mango" : "text-selva"}`}
        >
          {pesos(precio.cobro)}
        </span>
        {!gratis && !precio.cubreHasta && (
          <span className={`font-mono text-sm ${resaltado ? "text-crema/75" : "text-cacao/70"}`}>
            /{precio.periodo === "anual" ? "año" : "mes"}
          </span>
        )}
      </span>
      <span
        className={`mt-1.5 min-h-10 text-xs ${resaltado ? "text-crema/75" : "text-cacao/70"}`}
      >
        {nota}
      </span>

      <span
        aria-hidden="true"
        className={`mt-4 flex min-h-11 items-center justify-center rounded-full px-4 text-sm font-bold transition-colors ${
          elegido
            ? resaltado
              ? "bg-mango text-ink"
              : "bg-selva text-crema"
            : resaltado
              ? "border-2 border-mango/60 text-mango"
              : "border-2 border-selva/25 text-selva-2"
        }`}
      >
        {elegido ? `✓ Elegiste ${tier.nombre}` : `Elegir ${tier.nombre}`}
      </span>

      <ul
        className={`mt-5 grid gap-2 border-t pt-4 text-sm ${resaltado ? "border-crema/15" : "border-selva/10"}`}
      >
        {ventajas.map((ventaja, i) => (
          <li
            key={i}
            className={`flex gap-2 ${
              ventaja.hay ? "" : resaltado ? "text-crema/35 line-through" : "text-cacao/35 line-through"
            }`}
          >
            <span
              aria-hidden="true"
              className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-full text-[0.6rem] font-bold ${
                ventaja.hay
                  ? resaltado
                    ? "bg-mango text-ink"
                    : "bg-lima text-selva-2"
                  : "bg-transparent"
              }`}
            >
              {ventaja.hay ? "✓" : "—"}
            </span>
            <span className="sr-only">{ventaja.hay ? "Incluye:" : "No incluye:"}</span>
            <span>{ventaja.texto}</span>
          </li>
        ))}
      </ul>
    </label>
  );
}

export function FormularioCambiarPlan({
  tiers,
  cobroReal = false,
  porPagar = false,
  tierActual,
  preseleccion,
  oferta = null,
}: {
  tiers: Tier[];
  /** Hay Stripe: «Pagar ahora» lleva a su página de pago. */
  cobroReal?: boolean;
  /** Alguna sucursal todavía no paga con tarjeta: se le ofrece pagar ya. */
  porPagar?: boolean;
  tierActual?: number;
  /**
   * Con cuál abrir. Llegando desde "cámbiate a Pro" es Pro: quien tocó
   * ese anuncio ya eligió, y hacerle elegir otra vez desde su plan actual es
   * pedirle la misma decisión dos veces.
   */
  preseleccion?: number;
  /** El convenio con el que entró, para enseñar sus precios. */
  oferta?: Oferta | null;
}) {
  const [estado, accion] = useActionState(contratarPlan, INICIAL);
  const [periodo, setPeriodo] = useState<Periodo>("mensual");
  // Un código nuevo manda sobre el convenio con el que entró.
  const [codigoNuevo, setCodigoNuevo] = useState<Oferta | null>(null);
  // Cuál de los dos botones se pulsó: «Cambiar de plan» o «Pagar ahora».
  const [pagar, setPagar] = useState(false);
  // La promoción ya usada no se repite al cambiar de plan: su precio solo se
  // enseña con el código escrito otra vez.
  const vigente = codigoNuevo ?? (oferta?.planId ? null : oferta);

  return (
    <form action={accion} className="grid gap-4">
      <input type="hidden" name="codigo_convenio" value={codigoNuevo?.codigo ?? ""} />
      <input type="hidden" name="pagar" value={pagar ? "si" : ""} />
      <Resultado estado={estado} />

      <CodigoDeConvenio tiers={tiers} oferta={codigoNuevo} alCambiar={setCodigoNuevo} />

      <ElegirPeriodo periodo={periodo} alCambiar={setPeriodo} />

      <Planes
        key={codigoNuevo?.codigo ?? "sin-codigo"}
        tiers={tiers}
        actual={tierActual}
        inicial={codigoNuevo?.cubreHasta ? (codigoNuevo.planId ?? undefined) : preseleccion}
        periodo={periodo}
        oferta={vigente}
      />

      {cobroReal && porPagar && !(codigoNuevo?.cubreHasta) ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="submit"
            onClick={() => setPagar(true)}
            className="min-h-14 rounded-full bg-selva px-6 font-display text-lg font-semibold text-crema"
          >
            Pagar ahora con tarjeta
          </button>
          <button
            type="submit"
            onClick={() => setPagar(false)}
            className="min-h-14 rounded-full border-2 border-selva/25 bg-white px-6 font-bold text-selva-2"
          >
            Solo cambiar de plan
          </button>
          <p className="text-sm text-cacao/70 sm:col-span-2">
            El pago se hace en la página segura de Stripe; tu tarjeta no pasa
            por la Guía. Mientras estés en prueba, cambiar de plan no cobra
            nada.
          </p>
        </div>
      ) : (
        <BotonEnviar>
          {codigoNuevo?.cubreHasta && codigoNuevo.descuento < 100
            ? cobroReal
              ? "Ir a pagar con tarjeta"
              : "Pagar y cambiar de plan"
            : "Cambiar de plan"}
        </BotonEnviar>
      )}
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
