"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Area, Aviso, BotonEnviar, Campo, Selector } from "@/components/formulario";
import {
  agregarAGaleria,
  cambiarFotoPublicacion,
  crearEvento,
  crearNoticia,
  crearSucursal,
  eliminarPublicacion,
  guardarMicrositio,
  publicarSucursal,
  subirImagen,
  type EstadoAccion,
} from "@/lib/negocio/acciones";
import { pesos, type Sucursal, type Tier } from "@/lib/tipos";
import { cancelarPlan, contratarPlan } from "@/lib/negocio/plan";
import { LIMITES } from "@/lib/limites";
import { ACEPTA, MEDIDAS, PESO } from "@/lib/imagenes";
import { RANGOS } from "@/lib/vocabulario";

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
      {continuarA && <input type="hidden" name="continuar_a" value={continuarA} />}
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
        <Campo nombre="telefono" etiqueta="Teléfono" tipo="tel" requerido={false} valor={sucursal.telefono} />
        <Campo nombre="whatsapp" etiqueta="WhatsApp" tipo="tel" requerido={false} valor={sucursal.whatsapp} />
        <Campo
          nombre="correo_contacto"
          etiqueta="Correo de contacto"
          tipo="email"
          requerido={false}
          valor={sucursal.correo_contacto}
        />
        <Campo nombre="facebook" etiqueta="Facebook" requerido={false} valor={sucursal.facebook} />
        <Campo nombre="instagram" etiqueta="Instagram" requerido={false} valor={sucursal.instagram} />
        <Campo nombre="youtube" etiqueta="YouTube" requerido={false} valor={sucursal.youtube} />
        <Campo nombre="tiktok" etiqueta="TikTok" requerido={false} valor={sucursal.tiktok} />
      </fieldset>

      <BotonEnviar>
        {continuarA ? "Guardar y continuar" : "Guardar cambios"}
      </BotonEnviar>
    </form>
  );
}

/**
 * Campo de archivo con las medidas a la vista.
 *
 * La medida es una recomendación, no un requisito: la plataforma acepta
 * cualquier imagen y la recorta. Se dice de todos modos porque una foto en la
 * proporción correcta se ve bien sola, sin que nadie tenga que adivinar por
 * qué su logo salió cortado.
 */
function CampoImagen({
  etiqueta,
  medida,
  varias = false,
}: {
  etiqueta: string;
  medida: string;
  /** Para el carrusel: se eligen todas de un jalón, no una por una. */
  varias?: boolean;
}) {
  // Vive dentro del `<form>`, así que puede saber si el envío está en curso.
  const { pending } = useFormStatus();

  return (
    <label className="block">
      <span className="mb-1.5 block font-bold text-selva-2">{etiqueta}</span>
      <input
        type="file"
        name="archivo"
        accept={ACEPTA}
        multiple={varias}
        /*
          Elegir el archivo es la orden: se sube solo. El botón de "Subir" era un
          segundo paso que nadie pedía y que se olvidaba a media captura — la foto
          se veía elegida en el campo y en realidad no estaba guardada.

          El input no se deshabilita mientras sube, aunque se vea la tentación:
          un campo deshabilitado no se serializa, y hacerlo aquí correría el
          riesgo de mandar el formulario sin el archivo.
        */
        onChange={(evento) => {
          if (evento.currentTarget.files?.length) {
            evento.currentTarget.form?.requestSubmit();
          }
        }}
        className="w-full rounded-2xl border-2 border-dashed border-selva/25 bg-white px-4 py-3 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-selva file:px-4 file:py-2 file:font-bold file:text-crema"
      />

      {pending ? (
        <span role="status" className="mt-1.5 block text-sm font-bold text-selva">
          Subiendo…
        </span>
      ) : (
        <>
          <span className="mt-1.5 block text-sm text-cacao/70">{medida}</span>
          <span className="block text-sm text-cacao/70">{PESO}</span>
        </>
      )}
    </label>
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

      <CampoImagen etiqueta={etiqueta} medida={`${uso} ${medida}`} />
    </form>
  );
}

export function FormularioPublicar({ sucursalId }: { sucursalId: string }) {
  const [estado, accion] = useActionState(publicarSucursal, INICIAL);

  return (
    <form action={accion} className="grid gap-4">
      <input type="hidden" name="sucursal_id" value={sucursalId} />
      <Resultado estado={estado} />

      <BotonEnviar>Publicar en el directorio</BotonEnviar>
    </form>
  );
}

export function FormularioGaleria({ sucursalId }: { sucursalId: string }) {
  const [estado, accion] = useActionState(agregarAGaleria, INICIAL);

  return (
    <form action={accion} className="grid gap-3">
      <input type="hidden" name="sucursal_id" value={sucursalId} />
      <Resultado estado={estado} />

      <CampoImagen
        etiqueta="Agregar fotos"
        varias
        medida={`Puedes elegir varias de una vez. Hasta 8 en total, en el orden en que las subes. ${MEDIDAS.galeria}`}
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
        opciones={sucursales.map((s) => ({ valor: s.id, texto: s.nombre_sucursal }))}
      />

      <Campo nombre="titulo" etiqueta="Título" />
      <Campo nombre="subtitulo" etiqueta="Subtítulo" requerido={false} />
      <Area
        nombre="contenido"
        etiqueta="Contenido"
        ayuda="Hasta 1500 caracteres."
        filas={5}
      />

      <label className="block">
        <span className="mb-1.5 block font-bold text-selva-2">
          Foto <span className="font-normal text-cacao/70">(opcional)</span>
        </span>
        <input
          type="file"
          name="imagen"
          accept={ACEPTA}
          className="w-full rounded-2xl border-2 border-dashed border-selva/25 bg-white px-4 py-3 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-selva file:px-4 file:py-2 file:font-bold file:text-crema"
        />
        <span className="mt-1.5 block text-sm text-cacao/70">{MEDIDAS.publicacion}</span>
        <span className="block text-sm text-cacao/70">{PESO}</span>
      </label>
      <Campo nombre="fecha_evento" etiqueta="Fecha del evento" tipo="datetime-local" />
      <Selector
        nombre="rango_exclusivo"
        etiqueta="¿Exclusivo para algún rango?"
        requerido={false}
        opciones={[
          { valor: "", texto: "Abierto a todos" },
          ...RANGOS.filter((r) => r.nivel > 1).map((r) => ({
            valor: String(r.nivel),
            texto:
              r.nivel === 4 ? `Solo ${r.plural}` : `${r.plural} o más`,
          })),
        ]}
      />

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
        opciones={sucursales.map((s) => ({ valor: s.id, texto: s.nombre_sucursal }))}
      />

      <Campo nombre="titulo" etiqueta="Título" />
      <Campo nombre="subtitulo" etiqueta="Subtítulo" requerido={false} />
      <Area
        nombre="contenido"
        etiqueta="Contenido"
        ayuda="Hasta 1500 caracteres."
        filas={5}
      />


      <label className="block">
        <span className="mb-1.5 block font-bold text-selva-2">
          Foto <span className="font-normal text-cacao/70">(opcional)</span>
        </span>
        <input
          type="file"
          name="imagen"
          accept={ACEPTA}
          className="w-full rounded-2xl border-2 border-dashed border-selva/25 bg-white px-4 py-3 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-selva file:px-4 file:py-2 file:font-bold file:text-crema"
        />
        <span className="mt-1.5 block text-sm text-cacao/70">{MEDIDAS.publicacion}</span>
        <span className="block text-sm text-cacao/70">{PESO}</span>
      </label>

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
}: {
  publicacion: { id: string; titulo: string; fecha: string; sucursal: string; paso?: boolean };
  clase: "evento" | "noticia";
  /** URL de la portada, ya armada por el servidor. */
  foto: string | null;
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

      <Resultado estado={estado} />

      <form action={accion} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="clase" value={clase} />
        <input type="hidden" name="publicacion_id" value={publicacion.id} />

        <input
          type="file"
          name="imagen"
          accept={ACEPTA}
          className="min-w-0 flex-1 rounded-2xl border-2 border-dashed border-selva/25 bg-white px-3 py-2 text-sm file:mr-2 file:rounded-full file:border-0 file:bg-selva file:px-3 file:py-1.5 file:font-bold file:text-crema"
        />

        <BotonEnviarChico>{foto ? "Cambiar foto" : "Subir foto"}</BotonEnviarChico>
      </form>

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
function Planes({ tiers, actual }: { tiers: Tier[]; actual?: number }) {
  return (
    <fieldset className="grid gap-3">
      <legend className="sr-only">Elige un plan</legend>

      {tiers.map((tier, indice) => {
        // Lo que se gana al subir se marca; el plan de abajo no se pinta como
        // una pérdida. Un cuadro rojo diciendo "pierdes el banner" convierte
        // elegir en arrepentirse, y aquí lo que interesa es que se vea el paso
        // siguiente.
        const mejora = actual !== undefined && tier.id > actual;

        return (
        <label
          key={tier.id}
          className={`relative grid cursor-pointer gap-1 rounded-3xl border-2 bg-white p-5 has-[:checked]:bg-crema-2 ${
            mejora
              ? "border-mango has-[:checked]:border-selva"
              : "border-selva/20 has-[:checked]:border-selva"
          }`}
        >
          {mejora && (
            <span className="absolute -top-3 right-5 rounded-full bg-mango px-3 py-0.5 font-mono text-xs font-bold text-ink">
              Subir de plan
            </span>
          )}
          <span className="flex items-baseline justify-between gap-3">
            <span className="font-display text-xl font-semibold text-selva-2">
              <input
                type="radio"
                name="tier_id"
                value={tier.id}
                defaultChecked={actual ? tier.id === actual : indice === 0}
                className="mr-2 size-5 align-middle accent-selva"
              />
              {tier.nombre}
              {tier.id === actual && (
                <span className="ml-2 rounded-full bg-lima/40 px-2.5 py-0.5 align-middle font-mono text-xs font-bold text-selva-2">
                  Tu plan
                </span>
              )}
            </span>
            <span className="font-mono text-lg font-bold text-selva">
              {pesos(tier.precio_mensual)}
              <span className="text-sm font-normal text-cacao/70">/mes</span>
            </span>
          </span>

          <ul className="mt-1 ml-7 grid gap-0.5 text-cacao">
            <li>
              ✓{" "}
              {tier.max_sucursales === 1
                ? "Una sucursal"
                : `Hasta ${tier.max_sucursales} sucursales`}
            </li>
            <li>
              {tier.puede_dar_puntos
                ? "✓ Da monedas de chocolate a tus clientes"
                : "— Sin monedas de chocolate"}
            </li>
            <li>
              {tier.puede_publicar_contenido
                ? "✓ Publica eventos y noticias"
                : "— Sin eventos ni noticias"}
            </li>
            <li>
              {tier.en_banner_principal
                ? "✓ Aparece en el banner de la portada"
                : "— Fuera del banner"}
            </li>
          </ul>
        </label>
        );
      })}
    </fieldset>
  );
}

export function FormularioCambiarPlan({
  tiers,
  tierActual,
}: {
  tiers: Tier[];
  tierActual?: number;
}) {
  const [estado, accion] = useActionState(contratarPlan, INICIAL);

  return (
    <form action={accion} className="grid gap-4">
      <Resultado estado={estado} />

      <Planes tiers={tiers} actual={tierActual} />

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
          Entiendo que al cancelar <strong>dejo de aparecer en el directorio</strong>{" "}
          y que no se me volverá a cobrar. Mi micrositio vuelve a borrador con
          todo lo que armé, y puedo publicarlo otra vez cuando quiera.
        </span>
      </label>

      <BotonEnviar variante="secundario">Cancelar mi suscripción</BotonEnviar>
    </form>
  );
}