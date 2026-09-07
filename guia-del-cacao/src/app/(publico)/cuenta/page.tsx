import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { perfilActual } from "@/lib/auth/sesion";
import { cerrarSesion } from "@/lib/auth/acciones";
import {
  misEstrellasPorSucursal,
  misResenas,
  misSolicitudes,
  pasaporteDe,
} from "@/lib/datos/puntos";
import { calificacionesDe, nombrarNegocio } from "@/lib/datos/publico";
import { Promedio } from "@/components/publico/estrellas";
import { Estrellas } from "@/components/publico/estrellas";
import { Medio } from "@/components/publico/medio";
import { BUCKET_RESENAS, urlImagen } from "@/lib/imagenes";
import { FUNCIONES } from "@/lib/funciones";
import { MONEDA, monedas, rango as nombreRango, siguienteRango } from "@/lib/vocabulario";

export const metadata: Metadata = { title: "Mi cuenta · Guía del Cacao" };

const CUANDO = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const ESTADO_SOLICITUD = {
  pendiente: { texto: "Pendiente", tono: "bg-mango/25 text-cacao" },
  aprobada: { texto: "Aprobada", tono: "bg-lima/35 text-selva-2" },
  rechazada: { texto: "Rechazada", tono: "bg-guayaba/20 text-cacao" },
};

export default async function Cuenta() {
  const perfil = await perfilActual();

  if (!perfil) redirect("/login");
  if (!perfil.rol_confirmado) redirect("/elegir-rol");

  const anio = new Date().getFullYear();

  // Con las mazorcas apagadas, el marcador y las solicitudes no se pintan: no
  // tiene sentido ir a buscarlos a la base para tirarlos después.
  const [pasaporte, solicitudes, resenas] = await Promise.all([
    FUNCIONES.mazorcas
      ? pasaporteDe(perfil.id, anio)
      : Promise.resolve({ puntos: 0, nivel: 1 }),
    FUNCIONES.mazorcas ? misSolicitudes(perfil.id) : Promise.resolve([]),
    misResenas(perfil.id),
  ]);

  const { puntos, nivel } = pasaporte;

  // Cada negocio que aparece en esta pantalla —en las solicitudes y en las
  // reseñas— se enseña con su promedio, igual que en el directorio. Se piden
  // todos de una vez y sin repetir ids.
  const negocios = [...solicitudes, ...resenas]
    .map((fila) => fila.sucursales?.id)
    .filter((id): id is string => Boolean(id));

  const promedios = await calificacionesDe([...new Set(negocios)]);

  // Las estrellas que puse yo, para que mi resena salga con su nota.
  const misNotas = await misEstrellasPorSucursal(perfil.id);

  const pendientes = solicitudes.filter((s) => s.estado === "pendiente").length;

  const promedio = (sucursalId: string | undefined) =>
    sucursalId ? (promedios.get(sucursalId) ?? null) : null;
  const actual = nombreRango(nivel);
  const siguiente = siguienteRango(nivel);
  const faltan = siguiente ? siguiente.desde - puntos : 0;

  return (
    <div className="mx-auto grid max-w-2xl gap-8 py-8">
        <h1 className="font-display text-3xl">Hola, {perfil.nombre}</h1>

        {FUNCIONES.mazorcas && (
        <section className="rounded-3xl bg-crema-2 p-6">
          <p className="font-bold text-selva-2">Tu cuenta {anio}</p>

          <p className="mt-2 font-mono text-5xl font-bold text-selva">{puntos}</p>
          <p className="mt-1 text-cacao">
            {monedas(puntos)} · {actual.nombre}
          </p>

          {siguiente && (
            <div className="mt-5">
              <div
                className="h-3 overflow-hidden rounded-full bg-white"
                role="img"
                aria-label={`Te faltan ${faltan} ${monedas(faltan, true)} para ser ${siguiente.nombre}`}
              >
                <div
                  className="h-full rounded-full bg-lima"
                  style={{
                    width: `${Math.min(100, Math.round((puntos / siguiente.desde) * 100))}%`,
                  }}
                />
              </div>
              <p className="mt-2 text-cacao">
                Te {faltan === 1 ? "falta" : "faltan"} <strong>{faltan}</strong>{" "}
                {monedas(faltan, true)} para ser {siguiente.nombre}.
              </p>
            </div>
          )}

          <p className="mt-4 text-sm text-cacao/70">
            Cada negocio decide qué beneficio te da según tu rango. Tus{" "}
            {MONEDA.variasCortas} se reinician el 1 de enero.
          </p>
        </section>
        )}

        {/* Las pendientes van arriba y aparte: son mazorcas que ya pediste y
            todavía no cuentan en el marcador, y no saberlo se siente como que
            se perdieron. */}
        {FUNCIONES.mazorcas && pendientes > 0 && (
          <p
            role="status"
            className="rounded-3xl border-2 border-turquesa/40 bg-turquesa/15 p-5 text-cacao"
          >
            <strong className="block font-display text-lg text-selva-2">
              {pendientes === 1
                ? "Tienes 1 solicitud pendiente"
                : `Tienes ${pendientes} solicitudes pendientes`}
            </strong>
            Todavía no suman a tu marcador: el negocio tiene que revisarlas y
            decidir cuántas {MONEDA.variasCortas} te toca.
          </p>
        )}

        {FUNCIONES.mazorcas && (
        <section className="grid gap-4">
          <h2 className="font-display text-2xl">Tus solicitudes</h2>

          {solicitudes.length === 0 ? (
            <p className="rounded-3xl bg-crema-2 p-6 text-cacao">
              Todavía no has pedido {MONEDA.variasCortas}. Escanea el QR de cualquier negocio
              del{" "}
              <Link href="/directorio" className="font-bold text-selva underline">
                directorio
              </Link>{" "}
              después de comprar.
            </p>
          ) : (
            <ul className="grid gap-3">
              {solicitudes.map((solicitud) => {
                const estado = ESTADO_SOLICITUD[solicitud.estado];

                return (
                  <li
                    key={solicitud.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4"
                  >
                    <div>
                      <p className="font-bold text-selva-2">
                        {nombrarNegocio(solicitud.sucursales).marca ?? "Negocio"}
                      </p>
                      {nombrarNegocio(solicitud.sucursales).sucursal && (
                        <p className="text-sm text-cacao/70">
                          {nombrarNegocio(solicitud.sucursales).sucursal}
                        </p>
                      )}

                      {promedio(solicitud.sucursales?.id) && (
                        <p className="mt-0.5">
                          <Promedio
                            promedio={promedio(solicitud.sucursales?.id)!.promedio}
                            total={promedio(solicitud.sucursales?.id)!.total}
                          />
                        </p>
                      )}

                      <p className="font-mono text-xs text-cacao/70">
                        {CUANDO.format(new Date(solicitud.fecha_solicitud))}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      {solicitud.puntos_otorgados !== null && (
                        <span className="font-mono font-bold text-selva">
                          +{solicitud.puntos_otorgados}
                        </span>
                      )}
                      <span
                        className={`rounded-full px-3 py-1 text-sm font-bold ${estado.tono}`}
                      >
                        {estado.texto}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        )}

        {/*
          Las reseñas se enseñan siempre, incluso vacías: sin las mazorcas son
          lo que la cuenta hace, y una pantalla que solo saluda por el nombre no
          explica para qué sirve haberse registrado.
        */}
        <section className="grid gap-4">
          <h2 className="font-display text-2xl">Tus reseñas</h2>

          {resenas.length === 0 && (
            <p className="rounded-3xl bg-crema-2 p-6 text-cacao">
              Todavía no has reseñado nada. Cuando visites un negocio del{" "}
              <Link href="/directorio" className="font-bold text-selva underline">
                directorio
              </Link>
              , cuéntale a los demás cómo te fue.
            </p>
          )}

          {resenas.length > 0 && (
            <ul className="grid gap-3">
              {resenas.map((resena) => (
                <li key={resena.id} className="rounded-2xl bg-white p-4 shadow-dura">
                  <Link
                    href={`/marca/${resena.sucursales?.slug}`}
                    className="font-bold text-selva-2 underline"
                  >
                    {nombrarNegocio(resena.sucursales).marca}
                  </Link>
                  {nombrarNegocio(resena.sucursales).sucursal && (
                    <span className="ml-1.5 text-sm text-cacao/70">
                      {nombrarNegocio(resena.sucursales).sucursal}
                    </span>
                  )}

                  {promedio(resena.sucursales?.id) && (
                    <p className="mt-0.5">
                      <Promedio
                        promedio={promedio(resena.sucursales?.id)!.promedio}
                        total={promedio(resena.sucursales?.id)!.total}
                      />
                    </p>
                  )}

                  {misNotas.get(resena.sucursales?.id ?? "") && (
                    <p className="mt-1 flex items-center gap-2">
                      <Estrellas valor={misNotas.get(resena.sucursales!.id)!} />
                      <span className="font-mono text-sm font-bold text-cacao">
                        {misNotas.get(resena.sucursales!.id)}/5
                      </span>
                    </p>
                  )}

                  <p className="mt-1 text-cacao">{resena.texto}</p>

                  <Medio
                    ruta={urlImagen(resena.foto, BUCKET_RESENAS)}
                    alt="Lo que subiste con esta reseña"
                    className="mt-2 max-h-56 w-full rounded-2xl object-cover"
                  />
                  {resena.respuesta_marca && (
                    <p className="mt-2 rounded-xl bg-crema-2 p-3 text-cacao">
                      <span className="block font-bold text-selva-2">Te respondieron</span>
                      {resena.respuesta_marca}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

      {/*
        Salir vive aquí, al final de la cuenta, y ya no en una barra propia:
        esta pantalla ahora usa el mismo armazón que el resto del sitio, con su
        encabezado arriba y su barra de navegación abajo. Tener dos encabezados
        era lo que hacía que al entrar a la cuenta se perdiera la navegación.
      */}
      <form action={cerrarSesion}>
        <button
          type="submit"
          className="min-h-14 w-full rounded-full border-2 border-selva/25 bg-white px-6 font-display text-lg font-semibold text-selva-2 transition-colors hover:border-selva"
        >
          Cerrar sesión
        </button>
      </form>
    </div>
  );
}
