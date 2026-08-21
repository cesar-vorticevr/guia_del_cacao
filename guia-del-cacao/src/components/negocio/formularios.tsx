"use client";

import { useActionState } from "react";
import { Area, Aviso, BotonEnviar, Campo, Selector } from "@/components/formulario";
import {
  agregarAGaleria,
  agregarProducto,
  crearEvento,
  crearNoticia,
  crearSucursal,
  guardarMicrositio,
  publicarSucursal,
  subirImagen,
  type EstadoAccion,
} from "@/lib/negocio/acciones";
import { pesos, type Sucursal, type Tier } from "@/lib/tipos";
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

export function FormularioMicrositio({ sucursal }: { sucursal: Sucursal }) {
  const [estado, accion] = useActionState(guardarMicrositio, INICIAL);

  return (
    <form action={accion} className="grid gap-4">
      <input type="hidden" name="sucursal_id" value={sucursal.id} />
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

      <BotonEnviar>Guardar cambios</BotonEnviar>
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
}: {
  etiqueta: string;
  medida: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-bold text-selva-2">{etiqueta}</span>
      <input
        type="file"
        name="archivo"
        accept={ACEPTA}
        className="w-full rounded-2xl border-2 border-dashed border-selva/25 bg-white px-4 py-3 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-selva file:px-4 file:py-2 file:font-bold file:text-crema"
      />
      <span className="mt-1.5 block text-sm text-cacao/70">{medida}</span>
      <span className="block text-sm text-cacao/70">{PESO}</span>
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

      <BotonEnviar variante="secundario">Subir</BotonEnviar>
    </form>
  );
}

export function FormularioProducto({ sucursalId }: { sucursalId: string }) {
  const [estado, accion] = useActionState(agregarProducto, INICIAL);

  return (
    <form action={accion} className="grid gap-4">
      <input type="hidden" name="sucursal_id" value={sucursalId} />
      <Resultado estado={estado} />

      <Campo nombre="nombre" etiqueta="Producto o servicio" />
      <Campo nombre="descripcion" etiqueta="Descripción" requerido={false} />
      <Campo
        nombre="precio"
        etiqueta="Precio"
        requerido={false}
        marcador="120"
        ayuda="Opcional. Déjalo vacío si prefieres no publicarlo."
      />

      <BotonEnviar variante="secundario">Agregar al catálogo</BotonEnviar>
    </form>
  );
}

export function FormularioPublicar({
  sucursalId,
  tiers,
}: {
  sucursalId: string;
  tiers: Tier[];
}) {
  const [estado, accion] = useActionState(publicarSucursal, INICIAL);

  return (
    <form action={accion} className="grid gap-4">
      <input type="hidden" name="sucursal_id" value={sucursalId} />
      <Resultado estado={estado} />

      <fieldset className="grid gap-3">
        <legend className="sr-only">Elige un plan</legend>

        {tiers.map((tier, indice) => (
          <label
            key={tier.id}
            className="grid cursor-pointer gap-1 rounded-3xl border-2 border-selva/20 bg-white p-5 has-[:checked]:border-selva has-[:checked]:bg-crema-2"
          >
            <span className="flex items-baseline justify-between gap-3">
              <span className="font-display text-xl font-semibold text-selva-2">
                <input
                  type="radio"
                  name="tier_id"
                  value={tier.id}
                  defaultChecked={indice === 0}
                  className="mr-2 size-5 align-middle accent-selva"
                />
                {tier.nombre}
              </span>
              <span className="font-mono text-lg font-bold text-selva">
                {pesos(tier.precio_mensual)}
                <span className="text-sm font-normal text-cacao/70">/mes</span>
              </span>
            </span>

            <ul className="mt-1 ml-7 grid gap-0.5 text-cacao">
              <li>{tier.puede_dar_puntos
                  ? "✓ Da monedas de chocolate a tus clientes"
                  : "— Sin monedas de chocolate"}</li>
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
        ))}
      </fieldset>

      <BotonEnviar>Pagar y enviar a revisión</BotonEnviar>
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
        etiqueta="Agregar foto"
        medida={`Hasta 8 fotos, en el orden en que las subes. ${MEDIDAS.galeria}`}
      />

      <BotonEnviar variante="secundario">Subir foto</BotonEnviar>
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

      <BotonEnviar>Publicar noticia</BotonEnviar>
    </form>
  );
}
