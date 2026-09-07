import Link from "next/link";
import type { Metadata } from "next";
import { FormularioEvento } from "@/components/negocio/formularios";
import { NuevoEvento } from "@/components/negocio/eventos";
import { AgendaBuscable } from "@/components/publico/agenda-buscable";
import { MisEventos } from "@/components/publico/mis-eventos";
import { perfilActual } from "@/lib/auth/sesion";
import { listarEventos } from "@/lib/datos/publico";
import { misPublicaciones, misSucursales } from "@/lib/datos/sucursales";
import { urlImagen } from "@/lib/imagenes";

export const metadata: Metadata = { title: "Eventos · Guía del Cacao" };

const CUANDO = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * La agenda, y —para quien tiene negocio— sus propios eventos.
 *
 * Los del negocio vivían en una pestaña del panel. Se editaba en un sitio y se
 * leía en otro, así que comprobar cómo había quedado un evento era irse a otra
 * pantalla. Aquí se manejan donde se ven, y se sigue viendo la agenda de todos
 * debajo.
 */
export default async function Eventos() {
  const [{ proximos, pasados }, perfil] = await Promise.all([
    listarEventos(),
    perfilActual(),
  ]);

  const esNegocio = perfil?.rol === "negocio";
  const sucursales = esNegocio ? await misSucursales(perfil.id) : [];

  /*
    Quien puede anunciar un evento lo dice la bandera de su plan, no su número:
    desde la migración 000035 la tienen los tres, y dejar el 3 escrito a mano
    aquí haría que la pantalla escondiera un formulario que la base sí acepta.

    La sucursal tiene que estar publicada, que es lo mismo que exige el trigger
    al insertar: así no se ofrece un formulario destinado a ser rechazado.
  */
  const puedenPublicar = sucursales.filter(
    (s) => s.tiers?.puede_publicar_contenido && s.estado === "publicado",
  );

  // Los ya publicados se buscan sobre todas sus sucursales, no solo las Premier:
  // si la cuenta bajó de plan, sus eventos siguen ahí —ocultos— y tiene que
  // poder verlos.
  const mios = esNegocio
    ? (await misPublicaciones(sucursales.map((s) => s.id))).eventos
    : [];

  const porSucursal = new Map(
    sucursales
      .filter((s) => s.estado === "publicado")
      .map((s) => [s.nombre_sucursal, s.slug]),
  );

  // Fechas y fotos se resuelven aquí: el componente que las pinta es de cliente
  // y formatear allí daría una pintada distinta a la del servidor.
  const fechas = Object.fromEntries(
    mios.map((e) => [e.id, CUANDO.format(new Date(e.fecha))]),
  );
  const fotos = Object.fromEntries(
    mios.map((e) => [e.id, urlImagen(e.imagenes[0])]),
  );
  const slugs = Object.fromEntries(
    mios.map((e) => [e.id, porSucursal.get(e.sucursal) ?? null]),
  );

  /*
    Lo propio que está oculto no sale en la agenda de abajo. El dueño lo ve por
    RLS —es suyo—, pero verlo entre los de los demás se lee como publicado, que
    es justo lo contrario. Arriba, en «Tus eventos», sí sale y con su aviso.
  */
  const ocultos = new Set(puedenPublicar.length === 0 ? mios.map((e) => e.id) : []);
  const enAgenda = (lista: typeof proximos) =>
    lista.filter((evento) => !ocultos.has(evento.id));

  return (
    <>
      <h1 className="pt-8 font-display text-3xl">Eventos</h1>
      <p className="mt-2 max-w-prose text-cacao">
        Catas, ferias y talleres de los negocios del cacao en México.
      </p>

      {esNegocio && (
        <>
          <div className="pt-5">
            {/*
              Anunciar un evento ya no depende del plan: lo tienen los tres.
              Lo único que falta cuando no se puede es tener el micrositio en el
              directorio, y eso es lo que hay que decir — mandar aquí a comprar
              un plan más caro sería cobrar por algo que ya está incluido.
            */}
            {puedenPublicar.length === 0 ? (
              <div className="max-w-2xl rounded-3xl border-2 border-mango/50 bg-mango/15 p-6">
                <p className="font-display text-xl font-semibold text-selva-2">
                  Llena tu cata sin pagar publicidad
                </p>
                <p className="mt-2 text-cacao">
                  Tus catas, talleres y ferias salen en esta agenda, delante de
                  gente que ya anda buscando qué hacer con el cacao este fin de
                  semana. Va incluido en tu plan.
                </p>
                <p className="mt-2 text-cacao">
                  Para anunciar el primero, publica tu micrositio en el
                  directorio.
                </p>
                <Link
                  href="/negocio/panel"
                  className="mt-4 inline-block min-h-12 rounded-full bg-mango px-6 py-3 font-bold text-ink shadow-dura-sm transition-transform active:translate-y-0.5"
                >
                  Ir a mis sucursales
                </Link>
              </div>
            ) : (
              <NuevoEvento>
                <FormularioEvento sucursales={puedenPublicar} />
              </NuevoEvento>
            )}
          </div>

          <MisEventos
            eventos={mios}
            slugs={slugs}
            fechas={fechas}
            fotos={fotos}
            puedePublicar={puedenPublicar.length > 0}
          />

          <hr className="mt-8 border-t-2 border-ink/10" />
        </>
      )}

      <AgendaBuscable
        proximos={enAgenda(proximos)}
        pasados={enAgenda(pasados)}
      />
    </>
  );
}
