"use client";

import { useActionState } from "react";
import { Aviso, BotonEnviar, Campo, Selector } from "@/components/formulario";
import {
  crearMarca,
  elegirRol,
  iniciarSesion,
  registrarCliente,
  registrarNegocio,
  type EstadoFormulario,
} from "@/lib/auth/acciones";

const INICIAL: EstadoFormulario = {};

export type Categoria = { id: number; nombre: string };

function opcionesDe(categorias: Categoria[]) {
  return [
    { valor: "", texto: "Elige una categoría…" },
    ...categorias.map((c) => ({ valor: String(c.id), texto: c.nombre })),
  ];
}

export function FormularioLogin() {
  const [estado, accion] = useActionState(iniciarSesion, INICIAL);

  return (
    <form action={accion} className="grid gap-4">
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
      <Campo
        nombre="contrasena"
        etiqueta="Contraseña"
        tipo="password"
        autoComplete="new-password"
        ayuda="Mínimo 8 caracteres."
      />
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
      <Campo
        nombre="contrasena"
        etiqueta="Contraseña"
        tipo="password"
        autoComplete="new-password"
        ayuda="Mínimo 8 caracteres."
      />

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
      texto: "Quiero explorar el directorio, dejar reseñas y juntar monedas de chocolate.",
    },
    {
      rol: "negocio",
      titulo: "Soy negocio",
      texto: "Quiero mi micrositio, publicar y dar monedas de chocolate a mis clientes.",
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
