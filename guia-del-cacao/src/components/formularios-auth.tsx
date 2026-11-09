"use client";

import { useActionState } from "react";
import { Aviso, BotonEnviar, Campo, Selector } from "@/components/formulario";
import { MINIMO_CONTRASENA } from "@/lib/limites";
import {
  cambiarContrasena,
  confirmarConCodigo,
  crearMarca,
  elegirRol,
  iniciarSesion,
  pedirRestablecer,
  registrarCliente,
  registrarNegocio,
  reenviarCodigo,
  type EstadoFormulario,
} from "@/lib/auth/acciones";

const INICIAL: EstadoFormulario = {};

/**
 * El par de contraseñas del alta y del restablecimiento.
 *
 * El segundo cuadro no es burocracia: una errata al teclear deja fuera de su
 * propia cuenta a quien se acaba de registrar, y el error no se descubre hasta
 * el siguiente intento de entrar, cuando ya nadie recuerda qué escribió.
 */
function ParDeContrasenas({ nueva = false }: { nueva?: boolean }) {
  return (
    <>
      <Campo
        nombre="contrasena"
        etiqueta={nueva ? "Contraseña nueva" : "Contraseña"}
        tipo="password"
        autoComplete="new-password"
        ayuda={`Mínimo ${MINIMO_CONTRASENA} caracteres.`}
      />
      <Campo
        nombre="contrasena2"
        etiqueta="Repite la contraseña"
        tipo="password"
        autoComplete="new-password"
        ayuda="Para confirmar que quedó como querías."
      />
    </>
  );
}

export type Categoria = { id: number; nombre: string };

function opcionesDe(categorias: Categoria[]) {
  return [
    { valor: "", texto: "Elige una categoría…" },
    ...categorias.map((c) => ({ valor: String(c.id), texto: c.nombre })),
  ];
}

export function FormularioLogin({ volver = null }: { volver?: string | null }) {
  const [estado, accion] = useActionState(iniciarSesion, INICIAL);

  return (
    <form action={accion} className="grid gap-4">
      {volver && <input type="hidden" name="volver" value={volver} />}
      <Aviso>{estado.error}</Aviso>
      <Campo nombre="correo" etiqueta="Correo" tipo="email" autoComplete="email" />
      <Campo
        nombre="contrasena"
        etiqueta="Contraseña"
        tipo="password"
        autoComplete="current-password"
      />
      <BotonEnviar>Entrar</BotonEnviar>
    </form>
  );
}

export function FormularioCliente() {
  const [estado, accion] = useActionState(registrarCliente, INICIAL);

  return (
    <form action={accion} className="grid gap-4">
      <Aviso>{estado.error}</Aviso>
      <Campo nombre="nombre" etiqueta="Tu nombre" autoComplete="name" />
      <Campo nombre="correo" etiqueta="Correo" tipo="email" autoComplete="email" />
      <ParDeContrasenas />
      <BotonEnviar>Crear mi cuenta</BotonEnviar>
    </form>
  );
}

export function FormularioNegocio({ categorias }: { categorias: Categoria[] }) {
  const [estado, accion] = useActionState(registrarNegocio, INICIAL);

  return (
    <form action={accion} className="grid gap-4">
      <Aviso>{estado.error}</Aviso>
      <Campo nombre="nombre" etiqueta="Tu nombre" autoComplete="name" />
      <Campo nombre="correo" etiqueta="Correo" tipo="email" autoComplete="email" />
      <ParDeContrasenas />

      <hr className="my-2 border-selva/15" />

      <Campo nombre="nombre_comercial" etiqueta="Nombre comercial del negocio" />
      <Selector
        nombre="categoria_id"
        etiqueta="Categoría"
        opciones={opcionesDe(categorias)}
      />

      <BotonEnviar>Crear mi cuenta de negocio</BotonEnviar>
    </form>
  );
}

export function FormularioMarca({ categorias }: { categorias: Categoria[] }) {
  const [estado, accion] = useActionState(crearMarca, INICIAL);

  return (
    <form action={accion} className="grid gap-4">
      <Aviso>{estado.error}</Aviso>
      <Campo nombre="nombre_comercial" etiqueta="Nombre comercial del negocio" />
      <Selector
        nombre="categoria_id"
        etiqueta="Categoría"
        opciones={opcionesDe(categorias)}
      />
      <BotonEnviar>Continuar</BotonEnviar>
    </form>
  );
}

export function FormularioElegirRol() {
  const [estado, accion] = useActionState(elegirRol, INICIAL);

  const OPCIONES = [
    {
      rol: "cliente",
      titulo: "Soy cliente",
      texto: "Quiero explorar el directorio, dejar reseñas y juntar mazorcas de cacao.",
    },
    {
      rol: "negocio",
      titulo: "Soy negocio",
      texto: "Quiero mi micrositio, publicar y dar mazorcas de cacao a mis clientes.",
    },
  ];

  /**
   * Un formulario por opción, con el rol en un campo oculto.
   *
   * No sirve poner `name`/`value` en el botón: React los descarta cuando el
   * botón lleva un `formAction` con función, así que el rol llegaría vacío y
   * quien entra con Google no podría terminar de registrarse.
   */
  return (
    <div className="grid gap-4">
      <Aviso>{estado.error}</Aviso>

      {OPCIONES.map((opcion) => (
        <form key={opcion.rol} action={accion}>
          <input type="hidden" name="rol" value={opcion.rol} />
          <button
            type="submit"
            className="w-full rounded-3xl border-2 border-selva/20 bg-white p-5 text-left transition-colors hover:border-selva"
          >
            <span className="block font-display text-xl font-semibold text-selva-2">
              {opcion.titulo}
            </span>
            <span className="mt-1 block text-cacao">{opcion.texto}</span>
          </button>
        </form>
      ))}
    </div>
  );
}

/**
 * Pedir el correo para restablecer.
 *
 * El mensaje de éxito no dice si el correo existía. Es a propósito: si dijera
 * "esa cuenta no existe", cualquiera podría averiguar quién está registrado
 * probando direcciones.
 */
export function FormularioRecuperar() {
  const [estado, accion] = useActionState(pedirRestablecer, INICIAL);

  if (estado.enviado) {
    return (
      <p
        role="status"
        className="rounded-3xl border-2 border-lima/50 bg-lima/15 p-5 text-cacao"
      >
        <strong className="text-selva-2">Correo enviado.</strong> Si esa dirección
        tiene una cuenta, en un momento te llega un enlace para poner una
        contraseña nueva. Revisa también la carpeta de correo no deseado; el
        enlace sirve una sola vez.
      </p>
    );
  }

  return (
    <form action={accion} className="grid gap-4">
      <Aviso>{estado.error}</Aviso>
      <Campo
        nombre="correo"
        etiqueta="Tu correo"
        tipo="email"
        autoComplete="email"
        ayuda="El mismo con el que te registraste."
      />
      <BotonEnviar>Enviarme el enlace</BotonEnviar>
    </form>
  );
}

/** La contraseña nueva, ya con la sesión que abrió el enlace del correo. */
export function FormularioContrasenaNueva() {
  const [estado, accion] = useActionState(cambiarContrasena, INICIAL);

  return (
    <form action={accion} className="grid gap-4">
      <Aviso>{estado.error}</Aviso>
      <ParDeContrasenas nueva />
      <BotonEnviar>Guardar mi contraseña</BotonEnviar>
    </form>
  );
}

/**
 * El código del correo (6 u 8 dígitos, según `otp_length` del proyecto). Grande y numérico: en el stand se dicta
 * desde el celular de quien se registra y se teclea en la tablet, y en un
 * teléfono `one-time-code` deja que el teclado lo ofrezca solo.
 */
export function CampoCodigo() {
  return (
    <label className="block">
      <span className="mb-1.5 block font-bold text-selva-2">Código del correo</span>
      <input
        name="codigo"
        required
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9 -]{6,12}"
        maxLength={12}
        placeholder="12345678"
        className="block w-full rounded-2xl border-2 border-selva/20 bg-white px-4 py-3 text-center font-mono text-3xl tracking-[0.4em] text-ink focus:border-mango focus:outline-none"
      />
    </label>
  );
}

/**
 * Confirmar la cuenta recién creada con el código del correo, y pedir otro.
 * Sin la cookie del alta (otro dispositivo, o pasó una hora) se pide también
 * el correo.
 */
export function FormularioCodigo({ correo }: { correo: string | null }) {
  const [estado, accion] = useActionState(confirmarConCodigo, INICIAL);
  const [reenvio, reenviar] = useActionState(reenviarCodigo, INICIAL);

  return (
    // Un solo formulario con dos botones: así «mandarme otro» usa el mismo
    // correo que se escribió arriba. Ese botón no valida, porque para pedir
    // otro código todavía no se tiene ninguno.
    <form action={accion} className="grid gap-4">
      <Aviso>{estado.error ?? reenvio.error}</Aviso>
      {!correo && (
        <Campo nombre="correo" etiqueta="Tu correo" tipo="email" autoComplete="email" />
      )}
      <CampoCodigo />
      <BotonEnviar>Confirmar mi cuenta</BotonEnviar>

      {reenvio.enviado ? (
        <p role="status" className="text-center text-cacao">
          Te mandamos un código nuevo. El anterior ya no sirve.
        </p>
      ) : (
        <button
          formAction={reenviar}
          formNoValidate
          className="min-h-12 w-full rounded-full border-2 border-mango/40 bg-white px-6 font-bold text-selva-2 hover:border-mango hover:text-mango"
        >
          Mandarme otro código
        </button>
      )}
    </form>
  );
}
