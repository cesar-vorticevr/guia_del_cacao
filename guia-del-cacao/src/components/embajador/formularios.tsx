"use client";

import { useActionState, useState } from "react";
import { Area, Aviso, BotonEnviar, Campo } from "@/components/formulario";
import {
  borrarProspecto,
  cambiarEtapa,
  guardarDatosDeCobro,
  guardarMiNombre,
  guardarProspecto,
  type EstadoEmbajador,
} from "@/lib/embajador/acciones";
import { DESCUENTO_DE_EMBAJADOR, MESES_DE_DESTACADO } from "@/lib/precios";
import { ETAPAS, type Prospecto } from "@/lib/ventas";

const INICIAL: EstadoEmbajador = {};

function Listo({ children }: { children?: string }) {
  if (!children) return null;
  return (
    <p role="status" className="rounded-2xl border-2 border-lima/60 bg-lima/20 px-4 py-3 font-bold text-selva-2">
      {children}
    </p>
  );
}

/** El nombre del vendedor: lo único de su cuenta que puede cambiar. */
export function MiNombre({ nombre }: { nombre: string }) {
  const [estado, enviar] = useActionState(guardarMiNombre, INICIAL);

  return (
    <form action={enviar} className="grid gap-4">
      <Campo nombre="nombre" etiqueta="Tu nombre" valor={nombre} autoComplete="name" limite={80} />
      <Aviso>{estado.error}</Aviso>
      <Listo>{estado.ok}</Listo>
      <BotonEnviar variante="secundario">Guardar nombre</BotonEnviar>
    </form>
  );
}

/** A dónde se le transfiere: titular, banco y CLABE. */
export function DatosDeCobro({
  titular,
  banco,
  clabe,
}: {
  titular: string | null;
  banco: string | null;
  clabe: string | null;
}) {
  const [estado, enviar] = useActionState(guardarDatosDeCobro, INICIAL);

  return (
    <form action={enviar} className="grid gap-4">
      <Campo nombre="titular" etiqueta="A nombre de" valor={titular} autoComplete="name" />
      <Campo nombre="banco" etiqueta="Banco" valor={banco} requerido={false} marcador="BBVA, Banorte, Nu…" />
      <Campo
        nombre="clabe"
        etiqueta="CLABE interbancaria"
        valor={clabe}
        ayuda="Los 18 dígitos. Ahí te transferimos lo que ganes cada mes."
        marcador="012345678901234567"
      />
      <Aviso>{estado.error}</Aviso>
      <Listo>{estado.ok}</Listo>
      <BotonEnviar variante="secundario">Guardar datos de cobro</BotonEnviar>
    </form>
  );
}

/** El botón de copiar: si el navegador no deja, el texto se selecciona a mano. */
function Copiar({ texto, etiqueta }: { texto: string; etiqueta: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto);
          setCopiado(true);
          setTimeout(() => setCopiado(false), 2000);
        } catch {
          // Sin permiso para el portapapeles: se puede seleccionar a mano.
        }
      }}
      className="boton-oro brillo min-h-12 rounded-full px-6 font-bold text-ink"
    >
      {copiado ? "¡Copiado!" : etiqueta}
    </button>
  );
}

/**
 * El código del vendedor, grande y con sus dos salidas: copiarlo y mandarlo
 * por WhatsApp con un mensaje ya escrito. El mensaje dice qué gana el negocio,
 * que es lo que hace que lo use.
 */
export function TuCodigo({
  codigo,
  sitio,
  destacado = false,
}: {
  codigo: string;
  sitio: string;
  /** El código destacado (000070): no descuenta, pone al negocio en «Destacados». */
  destacado?: boolean;
}) {
  const mensaje = destacado
    ? `¡Hola! Te invito a poner tu negocio en la Guía del Cacao (${sitio}): tu página con catálogo, reseñas y un QR para tu mostrador. Son 15 días gratis y con mi código ${codigo} tu negocio sale en Destacados de la portada durante ${MESES_DE_DESTACADO} meses.`
    : `¡Hola! Te invito a poner tu negocio en la Guía del Cacao (${sitio}): tu página con catálogo, reseñas y un QR para tu mostrador. Son 15 días gratis y con mi código ${codigo} tienes ${DESCUENTO_DE_EMBAJADOR}% de descuento en tu primer pago.`;

  return (
    <div className="flex flex-col items-center gap-5">
      <p className="texto-oro select-all font-mono text-4xl font-bold tracking-[0.12em] sm:text-6xl">
        {codigo}
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Copiar texto={codigo} etiqueta="Copiar código" />
        <a
          href={`https://wa.me/?text=${encodeURIComponent(mensaje)}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-12 items-center rounded-full border border-mango/50 px-6 font-bold text-crema transition-colors hover:border-mango hover:text-mango"
        >
          Mandar por WhatsApp
        </a>
      </div>
    </div>
  );
}

/** Un mensaje del kit, listo para copiar o mandar por WhatsApp. */
export function MensajeListo({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="grid gap-3 rounded-3xl border-2 border-ink/10 bg-white p-5">
      <strong className="font-display text-lg">{titulo}</strong>
      <p className="whitespace-pre-line text-cacao select-all">{texto}</p>
      <div className="flex flex-wrap gap-2">
        <Copiar texto={texto} etiqueta="Copiar" />
        <a
          href={`https://wa.me/?text=${encodeURIComponent(texto)}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-12 items-center rounded-full border border-mango/50 px-6 font-bold transition-colors hover:border-mango hover:text-mango"
        >
          WhatsApp
        </a>
      </div>
    </div>
  );
}

function SelectorDeEtapa({ valor }: { valor?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-bold text-selva-2">¿En qué va?</span>
      <select
        name="etapa"
        defaultValue={valor ?? "por_contactar"}
        className="min-h-12 w-full rounded-2xl border-2 border-selva/20 bg-white px-4 text-ink"
      >
        {ETAPAS.map((e) => (
          <option key={e.valor} value={e.valor}>
            {e.texto}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Los campos de un prospecto, iguales al apuntarlo y al corregirlo. */
function CamposDeProspecto({ prospecto }: { prospecto?: Prospecto }) {
  return (
    <>
      <Campo nombre="negocio" etiqueta="Negocio" valor={prospecto?.negocio} marcador="Chocolates del Río" limite={120} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo nombre="contacto" etiqueta="Con quién hablaste" valor={prospecto?.contacto} requerido={false} />
        <Campo nombre="telefono" etiqueta="WhatsApp o teléfono" tipo="tel" valor={prospecto?.telefono} requerido={false} />
        <Campo nombre="ciudad" etiqueta="Ciudad" valor={prospecto?.ciudad} requerido={false} />
        <label className="block">
          <span className="mb-1.5 block font-bold text-selva-2">Volver a buscarlo el</span>
          <input
            type="date"
            name="siguiente_en"
            defaultValue={prospecto?.siguienteEn ?? ""}
            className="min-h-12 w-full rounded-2xl border-2 border-selva/20 bg-white px-4 text-ink"
          />
        </label>
      </div>
      <SelectorDeEtapa valor={prospecto?.etapa} />
      <Area nombre="nota" etiqueta="Notas" valor={prospecto?.nota} filas={2} limite={1000} ayuda="Qué le interesó, qué te pidió, qué objeción puso." />
    </>
  );
}

/** «Apuntar un negocio»: plegado, porque quien abre la libreta viene a mirarla. */
export function NuevoProspecto({ abierto: abiertoDeInicio = false }: { abierto?: boolean }) {
  const [abierto, setAbierto] = useState(abiertoDeInicio);
  const [estado, enviar] = useActionState(guardarProspecto, INICIAL);

  if (!abierto) {
    return (
      <div className="grid gap-3">
        <Listo>{estado.ok}</Listo>
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="boton-oro brillo min-h-12 w-fit rounded-full px-6 font-bold text-ink"
        >
          + Apuntar un negocio
        </button>
      </div>
    );
  }

  return (
    // Al acertar el formulario se vacía y se queda abierto: lo siguiente es
    // apuntar otro negocio de la misma calle.
    <form action={enviar} className="grid gap-4 rounded-3xl border-2 border-mango/40 bg-white p-5">
      <CamposDeProspecto />
      <Aviso>{estado.error}</Aviso>
      <Listo>{estado.ok}</Listo>
      <BotonEnviar>Apuntarlo</BotonEnviar>
      <button type="button" onClick={() => setAbierto(false)} className="text-sm font-bold underline">
        Cerrar
      </button>
    </form>
  );
}

const DIA = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", timeZone: "UTC" });

/** Un negocio de la libreta: la etapa se cambia de un toque; lo demás, al editar. */
export function FilaDeProspecto({ prospecto, hoy }: { prospecto: Prospecto; hoy: string }) {
  const [editando, setEditando] = useState(false);
  const [estado, enviar] = useActionState(guardarProspecto, INICIAL);

  if (editando) {
    return (
      <li className="rounded-3xl border-2 border-mango/40 bg-white p-5">
        <form action={enviar} className="grid gap-4">
          <input type="hidden" name="id" value={prospecto.id} />
          <CamposDeProspecto prospecto={prospecto} />
          <Aviso>{estado.error}</Aviso>
          <Listo>{estado.ok}</Listo>
          <BotonEnviar>Guardar cambios</BotonEnviar>
          <button type="button" onClick={() => setEditando(false)} className="text-sm font-bold underline">
            Cerrar
          </button>
        </form>
      </li>
    );
  }

  const tarde = prospecto.siguienteEn !== null && prospecto.siguienteEn <= hoy;
  const telefono = prospecto.telefono?.replace(/\D/g, "") ?? "";
  const whatsapp = telefono.length === 10 ? `52${telefono}` : telefono;

  return (
    <li className="grid gap-3 rounded-3xl border-2 border-ink/10 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <span>
          <strong className="block font-display text-xl">{prospecto.negocio}</strong>
          <span className="text-sm text-cacao/70">
            {[prospecto.contacto, prospecto.ciudad].filter(Boolean).join(" · ")}
          </span>
        </span>
        {prospecto.siguienteEn && (
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${tarde ? "bg-guayaba/20 text-guayaba" : "bg-crema-2 text-cacao"}`}
          >
            {tarde ? "Búscalo hoy" : `Buscarlo el ${DIA.format(new Date(`${prospecto.siguienteEn}T12:00:00Z`))}`}
          </span>
        )}
      </div>
      {prospecto.nota && <p className="text-sm text-cacao">{prospecto.nota}</p>}
      <form action={cambiarEtapa} className="flex flex-wrap gap-1.5">
        <input type="hidden" name="id" value={prospecto.id} />
        {ETAPAS.map((e) => (
          <button
            key={e.valor}
            type="submit"
            name="etapa"
            value={e.valor}
            aria-pressed={prospecto.etapa === e.valor}
            className={`min-h-9 rounded-full px-3 text-xs font-bold transition-colors ${
              prospecto.etapa === e.valor
                ? "boton-oro text-ink"
                : "border border-ink/15 text-cacao hover:border-mango hover:text-mango"
            }`}
          >
            {e.texto}
          </button>
        ))}
      </form>
      <div className="flex flex-wrap items-center gap-3 text-sm font-bold">
        {whatsapp && (
          <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer" className="text-mango underline">
            Escribirle por WhatsApp
          </a>
        )}
        <button type="button" onClick={() => setEditando(true)} className="underline">
          Editar
        </button>
        <form
          action={borrarProspecto}
          onSubmit={(evento) => {
            if (!confirm(`¿Borrar a ${prospecto.negocio} de tu libreta?`)) evento.preventDefault();
          }}
        >
          <input type="hidden" name="id" value={prospecto.id} />
          <button type="submit" className="text-cacao/60 underline hover:text-guayaba">
            Borrar
          </button>
        </form>
      </div>
    </li>
  );
}
