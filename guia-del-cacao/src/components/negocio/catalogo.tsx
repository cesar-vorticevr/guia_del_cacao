"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Area, Aviso, BotonEnviar, Campo } from "@/components/formulario";
import {
  agregarAlCatalogo,
  editarDelCatalogo,
  eliminarDelCatalogo,
  guardarSeleccion,
  type EstadoCatalogo,
} from "@/lib/negocio/catalogo";
import { eliminarSucursal } from "@/lib/negocio/acciones";
import { ACEPTA, MEDIDAS, PESO } from "@/lib/imagenes";
import { LIMITES } from "@/lib/limites";
import { pesos, type Producto } from "@/lib/tipos";

const INICIAL: EstadoCatalogo = {};

/**
 * El aviso de arriba.
 *
 * Cuando el error es de un campo concreto, **aquí no se repite el mensaje**:
 * sale marcado abajo, y decirlo dos veces hace leer dos veces para encontrar
 * una sola cosa. Queda una línea que manda a mirar, porque el formulario puede
 * ser más largo que la pantalla y hace falta saber que algo falló.
 *
 * Con `role="alert"`, además, un lector de pantalla lo anuncia al volver la
 * respuesta; el detalle lo da el propio campo, que ya está enfocado.
 */
function Resultado({ estado }: { estado: EstadoCatalogo }) {
  if (estado.campo) return <Aviso>Revisa lo que está marcado abajo.</Aviso>;
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

/**
 * Los campos de un producto, iguales al alta y a la edición.
 *
 * La foto se sube al elegirla, como el resto de imágenes del sitio, salvo aquí:
 * el producto todavía no existe cuando se está creando, así que viaja con el
 * formulario. En la edición sí podría subirse sola, pero tener dos
 * comportamientos para el mismo campo confunde más de lo que ahorra.
 *
 * **Si el envío falla, los campos se vuelven a pintar con lo que se escribió**
 * y el que hay que corregir sale marcado. Antes se perdía todo: React 19 vacía
 * un formulario no controlado al terminar la acción, así que equivocarse en el
 * precio costaba volver a teclear el nombre, el SKU y la descripción.
 */
function CamposProducto({
  producto,
  estado,
}: {
  producto?: Producto;
  /** Lo que dijo el servidor: qué falló, dónde, y lo que venía escrito. */
  estado?: EstadoCatalogo;
}) {
  const { pending } = useFormStatus();

  /*
    Lo que se pinta: lo que se acaba de mandar si hubo error, y si no, lo que
    está guardado. En ese orden — al corregir un error, lo último que escribió
    la persona manda sobre lo que había en la base.
  */
  const puesto = estado?.valores;
  const deCampo = (campo: keyof NonNullable<EstadoCatalogo["valores"]>) =>
    puesto ? puesto[campo] : undefined;

  /** El mensaje va en su campo, y solo en el que falló. */
  const problemaDe = (campo: EstadoCatalogo["campo"]) =>
    estado && estado.campo === campo ? estado.error : undefined;

  return (
    <>
      <Campo
        nombre="nombre"
        etiqueta="Nombre del producto"
        valor={deCampo("nombre") ?? producto?.nombre}
        problema={problemaDe("nombre")}
      />

      <Campo
        nombre="sku"
        etiqueta="SKU"
        requerido={false}
        valor={deCampo("sku") ?? producto?.sku}
        marcador="BAR-70-100"
        ayuda="Opcional. Tu clave interna, para cruzarlo con tu inventario."
        problema={problemaDe("sku")}
      />

      <Area
        nombre="descripcion"
        etiqueta="Descripción"
        valor={deCampo("descripcion") ?? producto?.descripcion}
        filas={3}
        limite={LIMITES.descripcionProducto}
        problema={problemaDe("descripcion")}
      />

      <Campo
        nombre="precio"
        etiqueta="Precio"
        requerido={false}
        valor={
          deCampo("precio") ??
          (producto?.precio !== null && producto?.precio !== undefined
            ? String(producto.precio)
            : null)
        }
        marcador="120"
        ayuda="Opcional. Déjalo vacío si prefieres no publicarlo."
        problema={problemaDe("precio")}
      />

      <label className="block">
        <span className="mb-1.5 block font-bold text-selva-2">
          Foto del producto{" "}
          <span className="font-normal text-cacao/70">(opcional)</span>
        </span>
        <input
          id="imagen"
          type="file"
          name="imagen"
          accept={ACEPTA}
          className="w-full rounded-2xl border-2 border-dashed border-selva/25 bg-white px-4 py-3 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-selva file:px-4 file:py-2 file:font-bold file:text-crema"
        />
        {pending ? (
          <span role="status" className="mt-1.5 block text-sm font-bold text-selva">
            Subiendo…
          </span>
        ) : (
          <>
            {/*
              El único campo que de verdad se pierde. Un `input file` no se
              puede rellenar desde el código —lo impide el navegador—, así que
              se avisa en vez de dejar que el producto se guarde sin foto sin
              que nadie lo note.
            */}
            {estado?.fotoPerdida && (
              <span className="mt-1.5 block text-sm font-bold text-guayaba">
                La foto no se guardó: vuelve a elegirla.
              </span>
            )}

            {problemaDe("imagen") && (
              <span className="mt-1.5 block text-sm font-bold text-guayaba">
                {problemaDe("imagen")}
              </span>
            )}

            <span className="mt-1.5 block text-sm text-cacao/70">
              Cuadrada. {MEDIDAS.producto}
            </span>
            <span className="block text-sm text-cacao/70">{PESO}</span>
            {producto?.imagen && (
              <span className="block text-sm text-cacao/70">
                Ya tiene foto: elige otra solo si quieres reemplazarla.
              </span>
            )}
          </>
        )}
      </label>
    </>
  );
}

/**
 * La `key` de los campos, y el foco en el que haya que corregir.
 *
 * **La key** es lo que devuelve lo escrito. React 19 vacía un formulario no
 * controlado al terminar la acción, y un `defaultValue` nuevo no se vuelve a
 * leer si el campo sigue montado; cambiando la key se montan de nuevo y
 * estrenan el valor que devolvió el servidor. Se ajusta **en el render** y no
 * en un efecto: en un efecto habría una pintada intermedia con el formulario
 * ya vacío —el parpadeo que se quería quitar— y además es lo que el lint
 * prohíbe.
 *
 * **El foco** sí va en un efecto, porque es lo que es: mover el cursor después
 * de pintar. Sin él, en celular hay que bajar a buscar cuál de los cinco
 * campos salió en rojo; con él, el teclado se abre en el que toca. Los `id` de
 * `Campo` y de `Area` son el nombre del campo, que es justo lo que devuelve la
 * acción.
 */
function useCamposQueVuelven(estado: EstadoCatalogo) {
  const [visto, setVisto] = useState(estado);
  const [intento, setIntento] = useState(0);

  if (visto !== estado) {
    setVisto(estado);
    setIntento((n) => n + 1);
  }

  useEffect(() => {
    if (!estado.campo) return;

    const campo = document.getElementById(estado.campo);
    campo?.focus();
    campo?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [estado]);

  return intento;
}

export function FormularioNuevoProducto() {
  const [estado, accion] = useActionState(agregarAlCatalogo, INICIAL);
  const intento = useCamposQueVuelven(estado);

  return (
    <form action={accion} className="grid gap-4">
      <Resultado estado={estado} />
      <CamposProducto key={intento} estado={estado} />
      <BotonEnviar variante="secundario">Agregar al catálogo</BotonEnviar>
    </form>
  );
}

/**
 * Agregar un producto, plegado tras un botón y **arriba de la lista**.
 *
 * El formulario vivía abierto al final de la página. Con un catálogo de quince
 * productos eso son tres pantallas de retícula antes de llegar a él: agregar
 * algo obligaba a recorrer todo lo que ya estaba hecho para encontrar el sitio
 * donde se hace lo nuevo.
 *
 * Es el mismo trato que «Nuevo evento» en la agenda, y por la misma razón: quien
 * entra a mirar su catálogo no pidió un formulario en blanco, y en celular ese
 * formulario ocupaba más pantalla que los productos.
 *
 * Con el catálogo vacío arranca **abierto**: ahí no hay nada que mirar, y el
 * único paso posible es el que el formulario hace. Pedir un clic de más para
 * llegar a lo único que se puede hacer es pedirlo por nada.
 */
export function NuevoProducto({
  children,
  deEntrada = false,
}: {
  children: React.ReactNode;
  deEntrada?: boolean;
}) {
  const [abierto, setAbierto] = useState(deEntrada);

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="min-h-12 w-fit rounded-full bg-selva px-6 font-bold text-crema shadow-dura-sm transition-transform active:translate-y-0.5"
      >
        Agregar un producto
      </button>
    );
  }

  return (
    <section className="grid max-w-2xl gap-4 rounded-3xl bg-crema-2 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl">Agregar un producto</h2>

        {/* Sin catálogo no se ofrece cerrar: dejaría la pantalla en blanco con
            un botón, que es de donde se venía. */}
        {!deEntrada && (
          <button
            type="button"
            onClick={() => setAbierto(false)}
            className="min-h-10 rounded-full px-4 text-sm font-bold text-cacao underline"
          >
            Cerrar
          </button>
        )}
      </div>

      {children}
    </section>
  );
}

export function FormularioEditarProducto({ producto }: { producto: Producto }) {
  const [estado, accion] = useActionState(editarDelCatalogo, INICIAL);
  const intento = useCamposQueVuelven(estado);

  return (
    <form action={accion} className="grid gap-4">
      <input type="hidden" name="producto_id" value={producto.id} />
      <Resultado estado={estado} />
      <CamposProducto key={intento} producto={producto} estado={estado} />
      <BotonEnviar>Guardar cambios</BotonEnviar>
    </form>
  );
}

/**
 * Borrar un producto del catálogo, avisando a cuántas sucursales afecta.
 *
 * La confirmación va en un `<dialog>` y no en un `confirm()` del navegador: ahí
 * cabe decir de cuántas sucursales va a desaparecer, que es la información que
 * hace falta para decidir. "¿Seguro?" no la da.
 */
export function BotonEliminarProducto({
  producto,
  enSucursales,
}: {
  producto: Producto;
  enSucursales: number;
}) {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="min-h-10 rounded-full border-2 border-guayaba/40 px-4 text-sm font-bold text-cacao transition-colors hover:bg-guayaba/10"
      >
        Eliminar
      </button>

      {abierto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Eliminar ${producto.nombre}`}
          className="fixed inset-0 z-50 grid place-items-center bg-ink/50 p-4"
        >
          <div className="w-full max-w-md rounded-3xl border-2 border-ink/10 bg-crema p-6 shadow-dura-alta">
            <h2 className="font-display text-xl text-selva-2">
              ¿Eliminar «{producto.nombre}»?
            </h2>

            <p className="mt-2 text-cacao">
              {enSucursales > 0 ? (
                <>
                  Se quita del catálogo y deja de aparecer en{" "}
                  <strong className="text-selva-2">
                    {enSucursales === 1
                      ? "la sucursal que lo maneja"
                      : `las ${enSucursales} sucursales que lo manejan`}
                  </strong>
                  .
                </>
              ) : (
                "Todavía no lo maneja ninguna sucursal, así que solo desaparece del catálogo."
              )}{" "}
              Esto no se deshace.
            </p>

            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setAbierto(false)}
                className="min-h-11 rounded-full border-2 border-selva/25 bg-white px-5 font-bold text-selva-2"
              >
                Mejor no
              </button>

              <form action={eliminarDelCatalogo}>
                <input type="hidden" name="producto_id" value={producto.id} />
                <button
                  type="submit"
                  className="min-h-11 rounded-full bg-guayaba px-5 font-bold text-ink"
                >
                  Sí, eliminar
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Qué productos del catálogo maneja esta sucursal.
 *
 * "Seleccionar todos" no es un adorno: lo normal al abrir una sucursal nueva es
 * que venda casi lo mismo que las demás, así que marcar todo y quitar dos es
 * menos trabajo que marcar quince.
 */
export function SeleccionDeProductos({
  sucursalId,
  catalogo,
  elegidos,
}: {
  sucursalId: string;
  catalogo: Producto[];
  elegidos: string[];
}) {
  const [estado, accion] = useActionState(guardarSeleccion, INICIAL);
  const [marcados, setMarcados] = useState<string[]>(elegidos);

  const todos = marcados.length === catalogo.length;

  return (
    <form action={accion} className="grid gap-4">
      <input type="hidden" name="sucursal_id" value={sucursalId} />
      <Resultado estado={estado} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-bold text-selva-2">
          {marcados.length} de {catalogo.length} elegidos
        </p>

        <button
          type="button"
          onClick={() => setMarcados(todos ? [] : catalogo.map((p) => p.id))}
          className="min-h-10 rounded-full border-2 border-selva/25 bg-white px-4 text-sm font-bold text-selva-2"
        >
          {todos ? "Quitar todos" : "Seleccionar todos"}
        </button>
      </div>

      <ul className="grid gap-2">
        {catalogo.map((producto) => (
          <li key={producto.id}>
            <label className="flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-selva/15 bg-white p-4 has-[:checked]:border-selva has-[:checked]:bg-crema-2">
              <input
                type="checkbox"
                name="producto"
                value={producto.id}
                checked={marcados.includes(producto.id)}
                onChange={(evento) =>
                  setMarcados((antes) =>
                    evento.target.checked
                      ? [...antes, producto.id]
                      : antes.filter((id) => id !== producto.id),
                  )
                }
                className="size-5 shrink-0 accent-selva"
              />

              <span className="min-w-0 flex-1">
                <span className="block font-bold text-selva-2">{producto.nombre}</span>
                {producto.descripcion && (
                  <span className="block truncate text-sm text-cacao">
                    {producto.descripcion}
                  </span>
                )}
              </span>

              {producto.precio !== null && (
                <span className="font-mono font-bold text-selva">
                  {pesos(producto.precio)}
                </span>
              )}
            </label>
          </li>
        ))}
      </ul>

      <BotonEnviar variante="secundario">Guardar los productos de esta sucursal</BotonEnviar>
    </form>
  );
}

/**
 * Borrar una sucursal desde el panel, sin ir a la pantalla de suscripción.
 *
 * La ventana repite los dos cerrojos de siempre —entender qué se pierde y
 * escribir el nombre—, porque el atajo no puede ser también un camino más fácil
 * de equivocarse. Lo que ahorra es el viaje, no la confirmación.
 */
export function BotonEliminarSucursal({
  sucursalId,
  nombre,
  publicada,
}: {
  sucursalId: string;
  nombre: string;
  publicada: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion] = useActionState(eliminarSucursal, {} as EstadoCatalogo);

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="min-h-11 rounded-full border-2 border-guayaba/40 bg-white px-5 py-2.5 text-sm font-bold text-cacao transition-colors hover:bg-guayaba/10"
      >
        Eliminar
      </button>

      {abierto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Eliminar ${nombre}`}
          className="fixed inset-0 z-50 grid place-items-center bg-ink/50 p-4"
        >
          <div className="w-full max-w-md rounded-3xl border-2 border-ink/10 bg-crema p-6 shadow-dura-alta">
            <h2 className="font-display text-xl text-selva-2">
              ¿Eliminar «{nombre}»?
            </h2>

            <p className="mt-2 text-cacao">
              Se borran para siempre sus fotos, sus eventos y sus reseñas.
              {publicada && " Tu suscripción se cancela en el mismo paso."} Esto no
              se deshace.
            </p>

            <p className="mt-2 text-cacao">
              Si solo quieres dejar de pagar,{" "}
              <Link
                href={`/negocio/panel/sucursal/${sucursalId}/suscripcion`}
                className="font-bold text-selva underline"
              >
                cancela la suscripción
              </Link>{" "}
              y tu micrositio se queda guardado.
            </p>

            <form action={accion} className="mt-4 grid gap-3">
              <input type="hidden" name="sucursal_id" value={sucursalId} />
              {/* La casilla de la otra pantalla se da por marcada: aquí lo que
                  se lee arriba es la misma advertencia, y el nombre escrito
                  sigue siendo el cerrojo que impide el accidente. */}
              <input type="hidden" name="entendido" value="si" />

              <Resultado estado={estado} />

              <label className="block">
                <span className="mb-1.5 block text-sm font-bold text-selva-2">
                  Escribe «{nombre}» para confirmar
                </span>
                <input
                  name="confirmacion"
                  required
                  autoComplete="off"
                  placeholder={nombre}
                  className="min-h-12 w-full rounded-2xl border-2 border-selva/20 bg-white px-4 text-ink"
                />
              </label>

              <div className="flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setAbierto(false)}
                  className="min-h-11 rounded-full border-2 border-selva/25 bg-white px-5 font-bold text-selva-2"
                >
                  Mejor no
                </button>
                <button
                  type="submit"
                  className="min-h-11 rounded-full bg-guayaba px-5 font-bold text-ink"
                >
                  Sí, eliminar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
