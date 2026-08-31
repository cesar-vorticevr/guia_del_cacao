import Link from "next/link";
import type { Metadata } from "next";
import { FormularioTema } from "@/components/publico/foro";
import { AvisosDeMonedas } from "@/components/negocio/avisos-de-monedas";
import { MuroComunidad } from "@/components/publico/muro-comunidad";
import { MiPublicacion } from "@/components/publico/mi-publicacion";
import { SubeAPremier } from "@/components/publico/sube-a-premier";
import { perfilActual } from "@/lib/auth/sesion";
import { muroDeComunidad } from "@/lib/datos/comunidad";
import { misSucursales } from "@/lib/datos/sucursales";
import { MONEDA } from "@/lib/vocabulario";

export const metadata: Metadata = { title: "Comunidad · Guía del Cacao" };

/**
 * El muro de la comunidad.
 *
 * Tenía tres formatos —temas, eventos y noticias— con su filtro por clase y su
 * formulario cada uno. Desde fuera eran lo mismo: alguien cuenta algo y los
 * demás comentan. Lo único distinto de verdad era el evento, que tiene fecha y
 * caduca, y se quedó en su agenda. Aquí solo hay publicaciones.
 *
 * Arriba va la última de quien mira, porque lo primero que se viene a ver es si
 * le respondieron; debajo, todo lo demás.
 */
export default async function Comunidad() {
  const perfil = await perfilActual();
  const entradas = await muroDeComunidad(perfil?.id);

  const puedeParticipar =
    perfil?.rol_confirmado &&
    (perfil.rol === "cliente" || perfil.rol === "negocio");
  const esNegocio = perfil?.rol === "negocio";

  // Publicar como negocio es del plan Premier y con la sucursal en el
  // directorio: lo mismo que exige la base, para no ofrecer un formulario que
  // va a ser rechazado al guardar.
  const sucursales = esNegocio ? await misSucursales(perfil.id) : [];
  const conPremier = sucursales.filter(
    (s) => s.tier_id === 3 && s.estado === "publicado",
  );

  const puedePublicar = esNegocio
    ? conPremier.length > 0
    : Boolean(puedeParticipar);
  const ultima = entradas.find((entrada) => entrada.mia);

  return (
    <>
      <AvisosDeMonedas />

      <h1 className="pt-8 font-display text-3xl">Comunidad</h1>
      <p className="mt-2 max-w-prose text-cacao">
        Lo que se está diciendo: publica lo tuyo y comenta lo de los demás.
      </p>

      <div className="pt-5">
        {!perfil ? (
          <p className="rounded-3xl bg-crema-2 p-5 text-cacao">
            <Link
              href="/login?volver=/comunidad"
              className="font-bold text-selva underline"
            >
              Inicia sesión
            </Link>{" "}
            para publicar y comentar.
          </p>
        ) : esNegocio && !puedePublicar ? (
          <SubeAPremier que="noticias" />
        ) : puedePublicar ? (
          <FormularioTema sucursales={conPremier} />
        ) : null}
      </div>

      {perfil && !esNegocio && (
        /*
          El precio se dice antes de escribir, no al fallar el guardado. Es la
          misma mazorca que devuelve un apoyo, así que decirlo aquí también
          explica para qué sirve apoyar.
        */
        <p className="mt-3 text-sm text-cacao/70">
          Publicar cuesta una {MONEDA.singular}. Si a alguien le gusta y te
          apoya, la recuperas.
        </p>
      )}

      {ultima && (
        <section className="pt-8">
          <h2 className="font-display text-2xl">Tu última publicación</h2>
          <MiPublicacion entrada={ultima} />
        </section>
      )}

      <section className="pt-8">
        <h2 className="font-display text-2xl">Todas las publicaciones</h2>
        <MuroComunidad entradas={entradas} haySesion={Boolean(perfil)} />
      </section>
    </>
  );
}
