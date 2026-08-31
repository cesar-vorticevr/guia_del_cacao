import type { Metadata } from "next";
import { FormularioEvento } from "@/components/negocio/formularios";
import { NuevoEvento } from "@/components/negocio/eventos";
import { AgendaBuscable } from "@/components/publico/agenda-buscable";
import { MisEventos } from "@/components/publico/mis-eventos";
import { SubeAPremier } from "@/components/publico/sube-a-premier";
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

  // Publicar es del plan Premier y la sucursal tiene que estar en el directorio;
  // lo mismo que exige la base al insertar, para no ofrecer un formulario que
  // va a ser rechazado al guardar.
  const conPremier = sucursales.filter(
    (s) => s.tier_id === 3 && s.estado === "publicado",
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
  const ocultos = new Set(conPremier.length === 0 ? mios.map((e) => e.id) : []);
  const enAgenda = (lista: typeof proximos) =>
    lista.filter((evento) => !ocultos.has(evento.id));

  return (
    <>
      <h1 className="pt-8 font-display text-3xl">Eventos</h1>
      <p className="mt-2 max-w-prose text-cacao">
        Catas, ferias y talleres de los negocios del cacao en Tabasco.
      </p>

      {esNegocio && (
        <>
          <div className="pt-5">
            {conPremier.length === 0 ? (
              <SubeAPremier que="eventos" />
            ) : (
              <NuevoEvento>
                <FormularioEvento sucursales={conPremier} />
              </NuevoEvento>
            )}
          </div>

          <MisEventos
            eventos={mios}
            slugs={slugs}
            fechas={fechas}
            fotos={fotos}
            puedePublicar={conPremier.length > 0}
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
