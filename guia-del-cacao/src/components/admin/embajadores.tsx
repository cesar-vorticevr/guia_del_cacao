"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Aviso, BotonEnviar, Campo } from "@/components/formulario";
import {
  crearCuentaDeVentas,
  editarCuentaDeVentas,
  registrarPagoAEmbajador,
  type EstadoCuentaDeVentas,
  type EstadoPagoEmbajador,
} from "@/lib/admin/embajadores";
import type { EmbajadorParaAdmin } from "@/lib/datos/embajadores";
import { pesos } from "@/lib/tipos";

const INICIAL: EstadoPagoEmbajador = {};
const INICIAL_CUENTA: EstadoCuentaDeVentas = {};

function Listo({ children }: { children?: string }) {
  if (!children) return null;
  return (
    <p role="status" className="rounded-2xl border-2 border-lima/60 bg-lima/20 px-4 py-3 font-bold text-selva-2">
      {children}
    </p>
  );
}

/** La fecha de corte de la comisión: un campo de fecha, que `Campo` no trae. */
function CampoCorte({ valor }: { valor?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-bold text-selva-2">Gana comisión hasta</span>
      <input
        type="date"
        name="comision_hasta"
        defaultValue={valor ?? "2027-04-30"}
        required
        className="min-h-12 w-full rounded-2xl border-2 border-selva/20 bg-white px-4 text-ink"
      />
      <span className="mt-1 block text-sm text-cacao/70">
        Los cobros después de este día ya no le dejan comisión.
      </span>
    </label>
  );
}

/**
 * Alta de una cuenta de ventas: el administrador pone nombre, correo y
 * contraseña, y se la pasa al vendedor. Nace confirmada y con su código.
 */
export function NuevaCuentaDeVentas() {
  const [estado, enviar] = useActionState(crearCuentaDeVentas, INICIAL_CUENTA);

  return (
    <form action={enviar} className="grid gap-4 sm:grid-cols-2">
      <Campo nombre="nombre" etiqueta="Nombre" autoComplete="off" marcador="Jorge Ruiz" />
      <Campo nombre="correo" etiqueta="Correo para entrar" tipo="email" autoComplete="off" marcador="jorge@guiadelcacao.mx" />
      <Campo
        nombre="contrasena"
        etiqueta="Contraseña"
        tipo="password"
        autoComplete="new-password"
        ayuda="Al menos 8 caracteres. Pásasela tú: él no la puede cambiar."
      />
      <CampoCorte />
      <div className="grid gap-3 sm:col-span-2">
        <Aviso>{estado.error}</Aviso>
        <Listo>{estado.ok}</Listo>
        <BotonEnviar>Crear cuenta de ventas</BotonEnviar>
      </div>
    </form>
  );
}

/** Una cuenta de ventas, plegada; al abrirla se editan todos sus datos. */
export function EditarCuentaDeVentas({ cuenta }: { cuenta: EmbajadorParaAdmin }) {
  const [abierta, setAbierta] = useState(false);
  const [estado, enviar] = useActionState(editarCuentaDeVentas, INICIAL_CUENTA);

  if (!abierta) {
    return (
      <button
        type="button"
        onClick={() => setAbierta(true)}
        className="min-h-10 w-fit rounded-full border-2 border-ink/15 px-5 text-sm font-bold transition-colors hover:border-mango hover:text-mango"
      >
        Editar cuenta
      </button>
    );
  }

  return (
    <form action={enviar} className="grid gap-4">
      <input type="hidden" name="perfil_id" value={cuenta.perfilId} />
      <Campo nombre="nombre" etiqueta="Nombre" valor={cuenta.nombre} autoComplete="off" />
      <Campo nombre="correo" etiqueta="Correo para entrar" tipo="email" valor={cuenta.correo} autoComplete="off" />
      <Campo
        nombre="contrasena"
        etiqueta="Contraseña nueva"
        tipo="password"
        requerido={false}
        autoComplete="new-password"
        ayuda="Déjala vacía para no cambiarla."
      />
      <CampoCorte valor={cuenta.comisionHasta} />
      <label className="block">
        <span className="mb-1.5 block font-bold text-selva-2">Código</span>
        <select
          name="estado"
          defaultValue={cuenta.estado === "pausado" ? "pausado" : "activo"}
          className="min-h-12 w-full rounded-2xl border-2 border-selva/20 bg-white px-4 text-ink"
        >
          <option value="activo">Activo: da descuento y suma comisiones</option>
          <option value="pausado">En pausa: ni descuento ni comisiones</option>
        </select>
      </label>
      <Aviso>{estado.error}</Aviso>
      <Listo>{estado.ok}</Listo>
      <div className="flex flex-wrap gap-2">
        <BotonGuardar />
        <button
          type="button"
          onClick={() => setAbierta(false)}
          className="min-h-11 rounded-full border-2 border-ink/15 px-5 font-bold"
        >
          Cerrar
        </button>
      </div>
    </form>
  );
}

function BotonGuardar() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="boton-oro brillo min-h-11 rounded-full px-6 font-bold text-ink disabled:opacity-60"
    >
      {pending ? "Guardando…" : "Guardar"}
    </button>
  );
}

function Boton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="boton-oro brillo min-h-11 shrink-0 rounded-full px-5 font-bold text-ink disabled:opacity-60"
    >
      {pending ? "Registrando…" : children}
    </button>
  );
}

/**
 * «Ya le transferí»: la referencia del SPEI y registrar. El monto no se
 * escribe: es todo lo que se le debía, y lo suma la base.
 */
export function RegistrarPago({ perfilId, monto }: { perfilId: string; monto: number }) {
  const [estado, enviar] = useActionState(registrarPagoAEmbajador, INICIAL);

  if (estado.ok) {
    return <p className="font-bold text-lima">{estado.ok}</p>;
  }

  return (
    <form action={enviar} className="grid gap-2">
      <input type="hidden" name="perfil_id" value={perfilId} />
      <div className="flex flex-wrap gap-2">
        <input
          name="referencia"
          required
          maxLength={120}
          placeholder="Referencia SPEI"
          aria-label="Referencia de la transferencia"
          className="min-h-11 min-w-0 flex-1 rounded-full border-2 border-selva/20 bg-white px-4 text-ink"
        />
        <Boton>Ya le pagué {pesos(monto)}</Boton>
      </div>
      {estado.error && <p className="text-sm font-bold text-guayaba">{estado.error}</p>}
    </form>
  );
}
