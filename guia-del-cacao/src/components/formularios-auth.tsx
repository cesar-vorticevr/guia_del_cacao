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

  return (
    <form className="grid gap-4">
      <Aviso>{estado.error}</Aviso>

      <button
        formAction={accion}
        name="rol"
        value="cliente"
        className="rounded-3xl border-2 border-selva/20 bg-white p-5 text-left transition-colors hover:border-selva"
      >
        <span className="block font-display text-xl font-semibold text-selva-2">
          Soy cliente
        </span>
        <span className="mt-1 block text-cacao">
          Quiero explorar el directorio, dejar reseñas y juntar puntos.
        </span>
      </button>

      <button
        formAction={accion}
        name="rol"
        value="negocio"
        className="rounded-3xl border-2 border-selva/20 bg-white p-5 text-left transition-colors hover:border-selva"
      >
        <span className="block font-display text-xl font-semibold text-selva-2">
          Soy negocio
        </span>
        <span className="mt-1 block text-cacao">
          Quiero mi micrositio, publicar y dar puntos a mis clientes.
        </span>
      </button>
    </form>
  );
}
